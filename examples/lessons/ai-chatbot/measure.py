#!/usr/bin/env python3
"""Copy the real prompt text and tool descriptions out of the pinned ai-chatbot clone, as text. usage: measure.py REPO OUT.json"""
import json, re, sys, glob, os
R = sys.argv[1]; p = open(R + "/lib/ai/prompts.ts").read()
out = {"regular": re.search(r"regularPrompt = `(.*?)`;", p, re.S).group(1), "artifacts": re.search(r"artifactsPrompt = `(.*?)`;\n", p, re.S).group(1).replace("\\`", "`").strip(), "tools": {}}
for f in sorted(glob.glob(R + "/lib/ai/tools/*.ts")):
    m = re.search(r'description:\s*\n?\s*(["`])(.*?)\1', open(f).read(), re.S)
    if m: out["tools"][os.path.basename(f)[:-3]] = m.group(2)
json.dump(out, open(sys.argv[2], "w"), ensure_ascii=False, indent=1); print({k: len(v) for k, v in out["tools"].items()}, len(out["regular"]), len(out["artifacts"]))
