#!/usr/bin/env python3
"""Build a step lesson into one HTML page.

usage: build_lesson.py LESSON_DIR --repo REPO_CLONE [--out index.html] [--standalone]
LESSON_DIR holds lesson.js (sets LESSON, may read RUN) and optional runs.json {name: path}. See references/lessons.md.
Refuses a clone at the wrong commit or with changes, and fails on broken code refs, missing input/output,
a flow between objects that are not on stage, or a map part with no real files. It reads the repo as text and never runs it.
"""
import argparse, json, os, re, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__)); AS = os.path.join(HERE, "..", "assets", "lesson")
THREE = '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>'
ap = argparse.ArgumentParser(); ap.add_argument("lesson"); ap.add_argument("--repo", required=True); ap.add_argument("--out"); ap.add_argument("--standalone", action="store_true"); a = ap.parse_args()
D = os.path.abspath(a.lesson); R = os.path.abspath(a.repo); errs = []; warns = []
def git(*x): return subprocess.check_output(["git", "-C", R, *x], text=True).strip()
runs = {}; rp = os.path.join(D, "runs.json")
if os.path.exists(rp):
    for k, p in json.load(open(rp)).items(): runs[k] = json.load(open(os.path.join(D, p)))
js = "const RUN=%s;var LESSON;\n%s\n;process.stdout.write(JSON.stringify(LESSON))" % (json.dumps(runs), open(os.path.join(D, "lesson.js"), encoding="utf-8").read())
p = subprocess.run(["node", "-"], input=js, text=True, capture_output=True)
if p.returncode: sys.exit("lesson.js failed:\n" + p.stderr[-1500:])
L = json.loads(p.stdout)

for k in ("id", "title", "question", "repo", "kind", "stage", "steps", "limits"):
    if not L.get(k): errs.append(f"missing {k}")
if errs: sys.exit("\n".join(errs))
commit = L["repo"].get("commit", "")
head = git("rev-parse", "HEAD")
if head != commit: errs.append(f"repo is at {head}, lesson is pinned to {commit}")
if git("status", "--porcelain"): errs.append("repo clone has local changes")
files = set(git("ls-files").split("\n")); O = L["stage"].get("objects", {}); mode = L["stage"].get("mode")
if mode not in ("2d", "3d"): errs.append("stage.mode must be 2d or 3d")
# the map: every part of the system is permanent, belongs somewhere, and names real files
ST = L["stage"].get("stations", {}) if mode == "3d" else {k: v for k, v in O.items() if v.get("type") != "group"}
stationOf = (lambda x: O.get(x, {}).get("at")) if mode == "3d" else (lambda x: x)
stFiles = set()
if not ST: errs.append("stage needs parts: stations in 3d, nodes in 2d")
for k, st in ST.items():
    if mode == "3d" and not (isinstance(st.get("box"), list) and len(st["box"]) == 4): errs.append(f"station {k}: box must be [x, z, w, d]")
    if not st.get("label"): errs.append(f"station {k}: no label")
    if not st.get("note") and not st.get("sub"): warns.append(f"station {k}: no plain-language note")
    if "files" not in st: errs.append(f"station {k}: no files (use [] only for a part outside the repo)")
    for f in st.get("files", []):
        if f not in files: errs.append(f"station {k}: {f} is not in the repo")
        stFiles.add(f)
if mode == "3d":
    for k, o in O.items():
        if o.get("at") not in ST: errs.append(f"object {k}: `at` must name a station")
    for w in L["stage"].get("wires", []):
        if w[0] not in ST or w[1] not in ST: errs.append(f"wire {w}: unknown station")
vis = set(); used = set(); touched = {}
def need_val(i, name, v):
    if not v: errs.append(f"step {i+1}: no {name}"); return
    if name != "transform" and v.get("prov") not in ("ran", "read", "illustrative"): errs.append(f"step {i+1}: {name} needs prov ran|read|illustrative")
for i, s in enumerate(L["steps"]):
    for k in ("title", "plain", "log", "chapter"):
        if not s.get(k): errs.append(f"step {i+1}: no {k}")
    for n in ("input", "transform", "output"): need_val(i, n, s.get(n))
    hide = list(vis) if s.get("hide") == "all" else s.get("hide", [])
    for x in hide: vis.discard(x)
    for x in s.get("show", []):
        if x not in O: errs.append(f"step {i+1}: unknown object {x}")
        vis.add(x); used.add(x)
    for x in s.get("focus") or []:
        if x not in vis: errs.append(f"step {i+1}: focus on {x}, which is not on stage")
    lit = (s.get("focus") or s.get("show") or [e for fl in s.get("flow", []) for e in (fl["from"], fl["to"])])
    if not any(stationOf(x) in ST for x in lit): errs.append(f"step {i+1}: lights up no part of the map")
    for fl in s.get("flow", []):
        for e in (fl["from"], fl["to"]):
            if e not in vis: errs.append(f"step {i+1}: flow touches {e}, which is not on stage")
    for k, v in (s.get("set") or {}).items():
        if k not in O: errs.append(f"step {i+1}: set on unknown {k}")
    c = s.get("code")
    if not c: warns.append(f"step {i+1}: no code reference"); continue
    if c["f"] not in files: errs.append(f"step {i+1}: {c['f']} is not in the repo"); continue
    src = open(os.path.join(R, c["f"]), encoding="utf-8", errors="replace").read().split("\n")
    if not (1 <= c["a"] <= c["b"] <= len(src)): errs.append(f"step {i+1}: lines {c['a']}-{c['b']} out of range for {c['f']}"); continue
    c["text"] = "\n".join(src[c["a"]-1:c["b"]])
    if not c.get("must"): errs.append(f"step {i+1}: code ref needs `must`, text that proves the lines are the right ones")
    elif c["must"] not in c["text"]: errs.append(f"step {i+1}: `{c['must']}` not found in {c['f']}:{c['a']}-{c['b']}")
    touched.setdefault(c["f"], []).append(i)
    if len(re.sub(r"<[^>]+>", "", s.get("plain", "")).split()) > 75: warns.append(f"step {i+1}: plain text is long")
for k in O:
    if k not in used: warns.append(f"object {k} is never shown")

# folder tree: open along touched or annotated paths, collapse everything else with a file count
notes = L.get("folders", {})
for n in notes:
    if n.rstrip("/") not in files and not any(f.startswith(n.rstrip("/") + "/") for f in files): errs.append(f"folders: {n} is not in the repo")
tree = {}
for f in sorted(files):
    t = tree
    for part in f.split("/")[:-1]: t = t.setdefault(part + "/", {})
    t[f.split("/")[-1]] = f
def count(t): return sum(count(v) if isinstance(v, dict) else 1 for v in t.values())
opened = set()
for f in list(touched) + list(stFiles):
    parts = f.split("/")
    for k in range(1, len(parts) + 1): opened.add("/".join(parts[:k]))
def conv(t, pre=""):
    dirs, plain = [], []
    for k in sorted(t):
        v = t[k]; path = pre + k.rstrip("/")
        if isinstance(v, dict):
            n = {"dir": True, "name": k.rstrip("/"), "files": count(v)}
            if path in notes or path + "/" in notes: n["note"] = notes.get(path) or notes.get(path + "/")
            if path in opened: n["kids"] = conv(v, path + "/")
            dirs.append(n)
        else:
            n = {"name": k, "path": v}
            if v in touched: n["steps"] = touched[v]
            if v in notes: n["note"] = notes[v]
            plain.append(n)
    return dirs + plain
L["tree"] = {"kids": conv(tree)}
for w in warns: print("warning:", w)
if errs: sys.exit("build failed:\n  " + "\n  ".join(errs))
data = json.dumps(L, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
shell = open(os.path.join(AS, "shell.html"), encoding="utf-8").read(); rt = open(os.path.join(AS, "runtime.js"), encoding="utf-8").read()
html = shell.replace("__TITLE__", L["title"]).replace("__THREE__", THREE if mode == "3d" else "").replace("__LESSON__", data).replace("__RUNTIME__", rt.replace("</script", "<\\/script"))
out = a.out or os.path.join(D, "index.html")
if a.standalone: html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + html + "</body></html>"
open(out, "w", encoding="utf-8").write(html)
print(f"{L['id']}: {mode} · {len(L['steps'])} steps · {len(O)} objects · {len(touched)} files cited · {len(html)//1024} KB → {out}")
