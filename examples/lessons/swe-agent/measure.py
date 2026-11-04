#!/usr/bin/env python3
"""Read one recorded SWE-agent run committed to the repo and measure it. Reads JSON as data; runs none of the repo's code.
usage: measure.py CLONE   writes runs/traj.json. The elision is our own copy of LastNObservations(n=5) from history_processors.py."""
import json, os, sys, subprocess
R = sys.argv[1]; HERE = os.path.dirname(os.path.abspath(__file__))
fs = [f for f in subprocess.check_output(["git", "-C", R, "ls-files", "trajectories/demonstrations"], text=True).split("\n") if "marshmallow-1867" in f and "__function_calling__install" in f]
P = fs[0]; d = json.load(open(os.path.join(R, P)))
def text(m):
    c = m.get("content", "")
    return c if isinstance(c, str) else "".join(x.get("text", "") for x in c)
h = d["history"]; msgs = [{"role": m.get("role"), "agent": m.get("agent"), "type": m.get("message_type"), "chars": len(text(m)), "text": text(m), "action": m.get("action"), "thought": m.get("thought"), "lines": text(m).count("\n") + 1, "tool": (m.get("tool_calls") or [{}])[0].get("function", {}).get("name") if m.get("tool_calls") else None} for m in h]
obs = [i for i, m in enumerate(msgs) if m["type"] == "observation"]
def elided(upto, n=5):
    """Characters sent to the model at a turn, with and without elision. Same rule as _get_omit_indices."""
    vis = msgs[:upto]; o = [i for i in obs if i < upto]; omit = set(o[1:max(0, len(o) - n)]); full = sum(m["chars"] for m in vis); short = sum(len(f"Old environment output: ({m['lines']} lines omitted)") if i in omit else m["chars"] for i, m in enumerate(vis)); return full, short, sorted(omit)
growth = []
for i, m in enumerate(msgs):
    if m["role"] == "assistant": f, s, om = elided(i); growth.append({"turn": len(growth) + 1, "full": f, "short": s, "omitted": len(om)})
tr = d["trajectory"]; info = d["info"]
out = {"path": P, "n_history": len(msgs), "msgs": [{k: (v[:1500] if isinstance(v, str) else v) for k, v in m.items()} for m in msgs], "chars": [m["chars"] for m in msgs], "growth": growth, "exit": info.get("exit_status"), "patch": info.get("submission"), "stats": info.get("model_stats"), "steps": len(tr)}
json.dump(out, open(os.path.join(HERE, "runs", "traj.json"), "w"), indent=0)
print(P); print("model_stats", out["stats"], "exit", out["exit"], "steps", out["steps"])
for i, m in enumerate(msgs): print(i, m["role"], m["type"], m["chars"], (m["tool"] or ""), "|", (m["action"] or text(h[i])[:60]).replace("\n", " ")[:90])
print(growth); print(out["patch"][:900] if out["patch"] else None)
