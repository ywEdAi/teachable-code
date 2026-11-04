#!/usr/bin/env python3
"""Route any repo: what kind of system is it, and what should its lesson show? Reads text only, stdlib only.

usage: classify_repo.py REPO_DIR [--json]
Prints each signal's share of source files, with example files, so a person can overrule it. This is a starting
guess for the interview. A repo can be several kinds; each gets its own lesson.
"""
import json, os, re, subprocess, sys
R = os.path.abspath(sys.argv[1]); EXT = {".py", ".ts", ".tsx", ".js", ".mjs", ".go", ".rs", ".c", ".cc", ".cpp", ".h", ".hpp", ".java", ".kt", ".rb", ".php", ".cs", ".swift", ".ipynb", ".cu", ".scala", ".ex"}
SKIP = re.compile(r"(^|/)(tests?|e2e|__tests__|spec|examples?|docs?|vendor|third_party|deps|node_modules|dist|build)(/|$)|\.(test|spec|min)\.")
SIG = {
  "tensor": [r"\btorch\.nn\b|\bnn\.Module\b|\bnn\.Linear\b", r"\.backward\(\)|optimizer\.step\(\)|\boptim\.\w+\(", r"\bimport (jax|tensorflow)\b|\bfrom (jax|tensorflow)\b|\bflax\.linen\b|\btf\.keras\b", r"\bAutoModel\w*\.from_pretrained\b", r"\btorch\.(cat|stack|tensor|matmul)\(", r"^\s*(import torch|from torch\b|from (transformers|peft|trl)\b|import (jax|tensorflow)\b)"],
  "llm_call": [r"\bstreamText\(|\bgenerateText\(|\bgenerateObject\(|\bchat\.completions\b|\bmessages\.create\(|\bChatOpenAI\b|\bChatAnthropic\b|\bllm\.invoke\(", r"from ['\"]ai['\"]|from ['\"]@ai-sdk/|\bfrom (openai|anthropic|langchain\w*|litellm)\b|\bimport (openai|anthropic|litellm)\b", r"\bsystem_?[pP]rompt\b|\brole['\"]?\s*:\s*['\"]system['\"]", r"\btool_choice\b|\binputSchema\b|\btool_calls?\b|\bfunction_call\b"],
  "web_app": [r"from ['\"]next/|from ['\"]react['\"]|from ['\"]vue['\"]|@angular/core", r"\bexpress\(\)|\bapp\.(get|post|put)\(['\"]/|\bAPIRouter\b|\bFastAPI\(|\bFlask\(|\bdjango\.|\b@app\.route\b|@(Get|Post)Mapping\b|\bexport async function (GET|POST)\b", r"\bdrizzle-orm\b|\bsqlalchemy\b|\bprisma\b|\bsqlmodel\b|\bmodels\.Model\b|\bcreateTable\b|\bpgTable\b"],
  "systems": [r"\bepoll_\w+\(|\bpthread_create\(|\bsocket\(AF_|\bkqueue\(|\bmmap\(|\baeCreate\w+\(", r"\btokio::|\bgo func\(|\bsync\.Mutex\b|\bstd::thread\b|\basyncio\.(Queue|gather)\b|\bzmq\.|\bmultiprocessing\.\w+", r"\bcuda\.|\bpage_table\b|\bscheduler\b|\bwrite-ahead\b|\breplication\b|\bconsensus\b"],
}
LESSON = {"tensor": ("3d", "tensor-flow"), "llm_call": ("2d", "llm-call"), "web_app": ("2d", "request-path"), "systems": ("2d", "system-trace"), "library": ("2d", "call-path")}
THRESH = {"tensor": .05, "llm_call": .012, "web_app": .10, "systems": .03}
try: files = subprocess.check_output(["git", "-C", R, "ls-files"], text=True).splitlines()
except Exception: files = [os.path.relpath(os.path.join(d, f), R) for d, _, fs in os.walk(R) for f in fs if ".git" not in d]
src = [f for f in files if os.path.splitext(f)[1] in EXT and not SKIP.search(f)]
hits = {k: {} for k in SIG}; lines = 0
for f in src:
    try: t = open(os.path.join(R, f), errors="ignore").read()
    except Exception: continue
    if len(t) > 800_000: continue
    lines += t.count("\n")
    for k, ps in SIG.items():
        m = sum(1 for p in ps if re.search(p, t, re.M))
        if m: hits[k][f] = m
n = max(1, len(src)); share = {k: round(sum(1 for f, m in v.items() if m >= (2 if k == "systems" else 1)) / n, 3) for k, v in hits.items()}
LOW = {".c", ".cc", ".cpp", ".h", ".hpp", ".rs", ".go", ".cu"}; low = sum(os.path.splitext(f)[1] in LOW for f in src) / n
if low >= .5: share["systems"] = max(share["systems"], round(low, 3))  # low-level languages with no web layer: treat as a system
kinds = sorted([k for k in SIG if share[k] >= THRESH[k]], key=lambda k: -share[k] / THRESH[k]) or ["library"]
exemplar = lambda k: [f for f, _ in sorted(hits.get(k, {}).items(), key=lambda x: -x[1])[:3]]
out = {"repo": os.path.basename(R), "source_files": len(src), "lines": lines, "signal_share": share, "kinds": kinds,
       "lessons": [{"kind": k, "stage": LESSON[k][0], "template": LESSON[k][1], "start_at": exemplar(k)} for k in kinds],
       "note": "A guess from text patterns. Confirm it with the learner before building."}
if "--json" in sys.argv: print(json.dumps(out, indent=1))
else:
    print(f"{out['repo']:26} {len(src):5} files  " + "  ".join(f"{k}={share[k]:.1%}" for k in SIG)); print(" " * 26, "→", ", ".join(f"{l['template']} ({l['stage']})" for l in out["lessons"]))
