"""SEAL file inventory: path, lines, top-level defs with line numbers (via ast)."""
import ast, json, os, sys
R = sys.argv[1]; out = []
for root, dirs, files in os.walk(R):
    dirs[:] = sorted(d for d in dirs if d not in (".git", "data", "results", "assets", "__pycache__"))
    for f in sorted(files):
        if not f.endswith((".py", ".sh", ".md")) or f == "__init__.py": continue
        p = os.path.join(root, f); rel = os.path.relpath(p, R); src = open(p, errors="ignore").read()
        defs = []
        if f.endswith(".py"):
            try:
                for n in ast.parse(src).body:
                    if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)): defs.append([n.name, n.lineno])
            except SyntaxError: pass
        out.append({"path": rel, "lines": src.count("\n") + 1, "defs": defs})
for extra in ["general-knowledge/results", "general-knowledge/data", "few-shot/data"]:
    n = sum(len(fs) for _, _, fs in os.walk(os.path.join(R, extra)))
    out.append({"path": extra + "/", "lines": 0, "defs": [], "files": n})
json.dump(out, open(sys.argv[2], "w"), indent=0)
print(len(out)); [print(o["lines"], o["path"], [d[0] for d in o["defs"]][:6]) for o in out if "general-knowledge" in o["path"]]
