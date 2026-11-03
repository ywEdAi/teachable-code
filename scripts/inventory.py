#!/usr/bin/env python3
"""Inventory a repository: every source file with its line count and top-level definitions.

usage: inventory.py REPO_DIR --out inventory.json [--summary] [--include-tests]
Output: [{"path", "lines", "lang", "defs": [[name, line], ...]}, ...] plus folder entries for data/results dirs
({"path": "dir/", "files": n}). --summary prints the shape signals used to choose the diagram:
size by top-level folder, entry points, notebooks, and hints (training loop, server, agents, prompts).
Python defs come from `ast`; TS/JS defs from a regex over top-level export/function/class lines.
"""
import argparse, ast, json, os, re, subprocess, sys
from collections import Counter

ap = argparse.ArgumentParser(); ap.add_argument("repo"); ap.add_argument("--out", required=True)
ap.add_argument("--summary", action="store_true"); ap.add_argument("--include-tests", action="store_true")
a = ap.parse_args(); R = os.path.abspath(a.repo)
SRC_EXT = {".py": "python", ".ts": "ts", ".tsx": "ts", ".js": "js", ".mjs": "js", ".sh": "shell", ".ipynb": "notebook",
           ".cu": "cuda", ".cuh": "cuda", ".cpp": "cpp", ".cc": "cpp", ".h": "cpp", ".rs": "rust", ".go": "go", ".md": "md"}
DATA_DIRS = re.compile(r"(^|/)(data|datasets|results|outputs|checkpoints|assets|fixtures)(/|$)")
TEST = re.compile(r"(^|/)(tests?|e2e|__tests__|__snapshots__)(/|$)|\.(test|spec)\.")
try: files = subprocess.check_output(["git", "-C", R, "ls-files"], text=True).splitlines()
except Exception: files = [os.path.relpath(os.path.join(d, f), R) for d, _, fs in os.walk(R) if "/.git" not in d for f in fs]
TS_DEF = re.compile(r"^(?:export\s+(?:default\s+)?)?(?:async\s+)?(?:function\s*\*?\s*(\w+)|class\s+(\w+)|(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?(?:\(|function|\w+\s*=>))")
out, data_dirs = [], Counter()
for rel in sorted(files):
    m = DATA_DIRS.search(rel)
    if m and not rel.endswith((".py", ".ts", ".sh")):
        data_dirs[rel[:m.end()].rstrip("/") + "/"] += 1; continue
    ext = os.path.splitext(rel)[1]; lang = SRC_EXT.get(ext)
    if not lang or (TEST.search(rel) and not a.include_tests): continue
    p = os.path.join(R, rel)
    try: src = open(p, errors="ignore").read()
    except Exception: continue
    defs = []
    if lang == "python":
        try: defs = [[n.name, n.lineno] for n in ast.parse(src).body if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef))]
        except SyntaxError: pass
    elif lang in ("ts", "js"):
        for i, line in enumerate(src.split("\n"), 1):
            mm = TS_DEF.match(line)
            if mm: defs.append([next(g for g in mm.groups() if g), i])
    elif lang == "notebook":
        try: src = "\n".join("".join(c.get("source", "")) for c in json.loads(src).get("cells", []))
        except Exception: pass
    out.append({"path": rel, "lines": src.count("\n") + 1, "lang": lang, "defs": defs})
for d, n in sorted(data_dirs.items()):
    if not any(d.startswith(o) and o != d for o in data_dirs): out.append({"path": d, "lines": 0, "lang": "data", "defs": [], "files": n})
json.dump(out, open(a.out, "w"), indent=0)
print(f"{len([o for o in out if o['lang'] != 'data'])} source files · {sum(o['lines'] for o in out)} lines → {a.out}")
if a.summary:
    by_top = Counter(); by_lang = Counter()
    for o in out: by_top[o["path"].split("/")[0]] += o["lines"]; by_lang[o["lang"]] += o["lines"]
    print("\nlines by top-level folder:"); [print(f"  {k:30s} {v:8d}") for k, v in by_top.most_common(15)]
    print("lines by language:", dict(by_lang.most_common()))
    hints = {"training loop": r"\.backward\(|optimizer\.step|Trainer\(|SFTTrainer", "inference server": r"FastAPI|uvicorn|zmq|@app\.(get|post)|express\(",
             "LLM prompts": r"system_prompt|\{\{\w+\}\}|You are an? ", "multi-agent": r"call_agent|\bdirector\b|orchestrat|persona", "GPU kernels": r"__global__|triton\.jit|cuda",
             "reward / RL": r"reward|ppo|grpo|policy", "notebook": r"."}
    found = {}
    for o in out:
        if o["lang"] in ("data", "md"): continue
        try: s = open(os.path.join(R, o["path"]), errors="ignore").read()
        except Exception: continue
        for k, rx in hints.items():
            if (k == "notebook") != (o["lang"] == "notebook"): continue
            if re.search(rx, s, re.I): found.setdefault(k, []).append(o["path"])
    print("shape signals (files matching):"); [print(f"  {k:18s} {len(v):4d}  e.g. {', '.join(v[:3])}") for k, v in found.items()]
    entries = [o["path"] for o in out if re.search(r"(^|/)(main|train|launch|server|app|cli|run)\w*\.(py|ts|js)$|scripts/.*\.sh$", o["path"])]
    print("likely entry points:", ", ".join(entries[:15]))
