"""Helpers to run a Python research repo's own functions on CPU without its heavy dependencies.

    import sys; sys.path.insert(0, "<skill>/scripts"); from pyrun import stub, load
    stub("torch", "transformers", "wandb", "openai")          # empty modules so imports succeed
    stub("torch", cuda=types.SimpleNamespace(is_available=lambda: False))   # with attributes
    se = load("se", "/repo/pkg/uncertainty/semantic_entropy.py")             # import one file by path
    nb = notebook_cell("/repo/x.ipynb", 16)                                    # source of one notebook cell

Rules that keep results honest:
  * only stub what the function under test does not compute with; if a stub stands in for a model
    (an NLI judge, an LLM), label every output that depends on it as "toy" or "synthetic" in the page
  * never edit the repo; patch a copy or monkeypatch in your runner
  * save outputs as JSON next to the page (runs/*.json) and load them through runs.json
"""
import importlib.util, json, sys, types

def stub(*names, **attrs):
    for name in names:
        parts = name.split(".")
        for i in range(1, len(parts) + 1):
            sub = ".".join(parts[:i])
            if sub not in sys.modules:
                m = types.ModuleType(sub); m.__path__ = []; sys.modules[sub] = m
                if i > 1: setattr(sys.modules[".".join(parts[:i - 1])], parts[i - 1], m)
        for k, v in attrs.items(): setattr(sys.modules[name], k, v)
    return sys.modules[names[-1]] if names else None

def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec); sys.modules[name] = mod; spec.loader.exec_module(mod); return mod

def notebook_cell(path, i):
    return "".join(json.load(open(path))["cells"][i]["source"])

def exec_cell(path, i, env):
    exec(notebook_cell(path, i), env); return env
