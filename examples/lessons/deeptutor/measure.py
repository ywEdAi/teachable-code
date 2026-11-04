#!/usr/bin/env python3
"""Copy real prompt text out of DeepTutor at the pinned commit and measure it. Reads YAML and Python as text; runs none of the repo's code.
usage: measure.py CLONE   writes runs/parts.json"""
import json, os, re, sys
R = sys.argv[1]; HERE = os.path.dirname(os.path.abspath(__file__)); y = open(os.path.join(R, "deeptutor/agents/chat/prompts/en/agentic_chat.yaml"), encoding="utf-8").read().split("\n")
def block(key, indent=0):
    pre = " " * indent + key + ": |-"; i = y.index(pre); out = []; body = indent + 2
    for l in y[i + 1:]:
        if l.strip() == "": out.append(""); continue
        if len(l) - len(l.lstrip()) < body: break
        out.append(l[body:])
    return "\n".join(out).rstrip()
tool = open(os.path.join(R, "deeptutor/tools/builtin/__init__.py"), encoding="utf-8").read()
m = re.search(r'name="rag",\s*description=\(\s*((?:"[^"]*"\s*)+)\)', tool); rag = "".join(re.findall(r'"([^"]*)"', m.group(1)))
hints = dict(re.findall(r'^(\w+): "(.*)"$', open(os.path.join(R, "deeptutor/tools/prompting/hints/en/rag.yaml"), encoding="utf-8").read(), re.M))
out = {"general": block("general"), "runtime_policy": block("runtime_policy"), "snapshot": block("runtime_snapshot_policy"), "tool_call": block("tool_call_policy"), "loop": block("system", 2), "kb_header": "\n".join(l.strip() for l in y[y.index("  header: |-") + 1:y.index("  header: |-") + 5]), "rag": rag, "rag_hints": hints}
json.dump(out, open(os.path.join(HERE, "runs", "parts.json"), "w"), indent=1, ensure_ascii=False)
print({k: len(v) for k, v in out.items()})
