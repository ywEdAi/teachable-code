#!/usr/bin/env python3
"""Build one self-contained Code Anatomy page from a page folder.

page folder layout
  repos.json   {"<key>": {"name": ..., "root": "/abs/path/to/clone", "url": "https://github.com/o/r/blob/<sha>/"}}
  runs.json    {"<dotted.key>": "runs/<file>.json"}   -> becomes RUN.<dotted.key> in the page
  graphs/*.js  graph files, loaded in name order; they call def({...}) and may set PAGE/PROFILE/FRAMES/ROUTES

What it checks (fails on any error unless --allow-errors)
  * every code reference (node.code, aiio input/output/parsed with f/a/b, node.files with p/a) points to a real file
    and a real line range in the pinned clone
  * every edge connects two existing nodes; every scenario step names an existing edge or node;
    every drill target, jump target, frame graph and route frame exists
Then it injects the referenced source lines (so the page shows the repo's own code) and writes one HTML file.

usage: build.py PAGE_DIR --out page.html [--assets ../assets] [--allow-errors]
"""
import argparse, glob, json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ap = argparse.ArgumentParser()
ap.add_argument("page_dir"); ap.add_argument("--out", required=True)
ap.add_argument("--assets", default=os.path.join(HERE, "..", "assets"))
ap.add_argument("--allow-errors", action="store_true")
a = ap.parse_args()
P, A = os.path.abspath(a.page_dir), os.path.abspath(a.assets)

repos = json.load(open(os.path.join(P, "repos.json")))
RUN = {}
runs_path = os.path.join(P, "runs.json")
if os.path.exists(runs_path):
    for key, rel in json.load(open(runs_path)).items():
        cur = RUN; parts = key.split(".")
        for k in parts[:-1]: cur = cur.setdefault(k, {})
        cur[parts[-1]] = json.load(open(os.path.join(P, rel)))

GH = {k: v["url"] for k, v in repos.items()}
head_js = "const GH = " + json.dumps(GH) + ";\nconst RUN = " + json.dumps(RUN, ensure_ascii=False) + ";\n"
prelude = open(os.path.join(A, "prelude.js")).read()
views = "".join(open(f).read() + "\n" for f in sorted(glob.glob(os.path.join(A, "views", "*.js"))))
graphs = "".join(f"\n/* ---- {os.path.basename(f)} ---- */\n" + open(f).read() + "\n" for f in sorted(glob.glob(os.path.join(P, "graphs", "*.js"))))
data_js = head_js + prelude + views + graphs

# ---- collect references and structural facts with node (graph files may compute nodes) ----
probe = data_js + r"""
const refs = [], errs = [];
for (const g of Object.values(GRAPHS)) {
  const ids = new Set((g.nodes || []).map(n => n.id));
  for (const n of (g.nodes || [])) {
    if (n.code) refs.push([g.repo, n.code, `${g.id}/${n.id}.code`]);
    if (n.aiio) for (const k of ["input", "output", "parsed"]) { const r = n.aiio[k]; if (r && r.f) refs.push([g.repo, { f: r.f, a: r.a, b: r.b }, `${g.id}/${n.id}.aiio.${k}`]); }
    if (n.files) for (const f of n.files) if (f.p && !/\s/.test(f.p)) refs.push([g.repo, { f: f.p, a: f.a || 1, b: f.a || 1, exists: true }, `${g.id}/${n.id}.files`]);
    if (n.drill && !GRAPHS[n.drill]) errs.push(`${g.id}/${n.id}: drill target "${n.drill}" is not a graph`);
    if (n.jump && !GRAPHS[n.jump.g]) errs.push(`${g.id}/${n.id}: jump target "${n.jump.g}" is not a graph`);
  }
  const eids = new Set();
  for (const e of (g.edges || [])) {
    if (!ids.has(e.from) || !ids.has(e.to)) errs.push(`${g.id}: edge ${e.from} -> ${e.to} names a missing node`);
    eids.add(e.id || (e.from + ">" + e.to));
  }
  for (const s of (g.scenarios || [])) for (const st of (s.steps || [])) for (const one of (st.par || [st])) {
    if (one.e && !eids.has(one.e)) errs.push(`${g.id} / scenario "${s.name}": step edge "${one.e}" does not exist`);
    if (one.n && !ids.has(one.n)) errs.push(`${g.id} / scenario "${s.name}": step node "${one.n}" does not exist`);
  }
}
const fids = new Set(FRAMES.map(f => f.id));
for (const f of FRAMES) if (!GRAPHS[f.g]) errs.push(`frame "${f.id}": graph "${f.g}" does not exist`);
for (const [goal, list] of Object.entries(ROUTES)) for (const id of list) if (!fids.has(id)) errs.push(`route "${goal}": frame "${id}" does not exist`);
for (const goal of PROFILE.goals || []) if (!ROUTES[goal.id]) errs.push(`goal "${goal.id}" has no route`);
console.log(JSON.stringify({ refs, errs, graphs: Object.keys(GRAPHS).length, frames: FRAMES.length, page: PAGE }));
"""
os.makedirs(os.path.dirname(os.path.abspath(a.out)) or ".", exist_ok=True)
probe_file = os.path.abspath(a.out) + ".probe.js"
open(probe_file, "w").write(probe)
try:
    res = json.loads(subprocess.check_output(["node", probe_file], stderr=subprocess.STDOUT))
except subprocess.CalledProcessError as ex:
    print(ex.output.decode()[-3000:]); sys.exit("graph files failed to evaluate in node")
finally:
    os.remove(probe_file)

errors = list(res["errs"]); SRC = {}
def nb_source(path, c):
    src = "".join(json.load(open(path))["cells"][c["cell"]]["source"])
    if c.get("from"):
        i = src.find(c["from"]); src = src[i:] if i >= 0 else src
    if c.get("until"):
        j = src.find(c["until"]); src = src[:j].rstrip() if j > 0 else src
    if c.get("maxChars"): src = src[:c["maxChars"]]
    return src
for repo, c, where in res["refs"]:
    if repo not in repos: errors.append(f"{where}: repo key '{repo}' missing from repos.json"); continue
    root = repos[repo]["root"]
    if "nb" in c:
        path = os.path.join(root, c["nb"])
        if not os.path.exists(path): errors.append(f"{where}: notebook not found {c['nb']}"); continue
        SRC[f"{repo}|nb|{c['nb']}|{c['cell']}"] = nb_source(path, c); continue
    path = os.path.join(root, c["f"])
    if not os.path.exists(path): errors.append(f"{where}: file not found {c['f']}"); continue
    lines = open(path, errors="replace").read().split("\n")
    if c["a"] < 1 or c["b"] > len(lines) or c["a"] > c["b"]:
        errors.append(f"{where}: lines {c['a']}-{c['b']} outside {c['f']} ({len(lines)} lines)"); continue
    if not c.get("exists"): SRC[f"{repo}|{c['f']}|{c['a']}|{c['b']}"] = "\n".join(lines[c["a"] - 1:c["b"]])

print(f"graphs {res['graphs']} · frames {res['frames']} · code refs {len(res['refs'])} · snippets {len(SRC)}")
if errors:
    print(f"\n{len(errors)} problem(s):"); [print("  -", e) for e in errors]
    if not a.allow_errors: sys.exit(1)

shell = open(os.path.join(A, "shell.html")).read()
page = res["page"]
out = (shell.replace("__TITLE__", page.get("title", "Code Anatomy")).replace("__H1__", page.get("h1", "Code Anatomy"))
       .replace("/*__DATA__*/", data_js.replace(prelude, prelude + "\nconst SRC = " + json.dumps(SRC, ensure_ascii=False) + ";\n", 1))
       .replace("/*__ENGINE__*/", open(os.path.join(A, "engine.js")).read()))
# escape "</script" inside the inline scripts (keep the real closing tags)
parts = out.split("\n</script>"); out = "\n</script>".join(p.replace("</script", "<\\/script") for p in parts)
open(a.out, "w").write(out)
print(f"wrote {a.out} ({len(out.encode()) // 1024} KB)")
