"""Run SEAL's pure-Python pieces on CPU: self-edit -> training sequences (GK), E-step selection (GK),
and ARC self-edit config -> augmenters (FS). Model calls (vLLM, LoRA training, GPT-4.1 grading) are NOT run."""
import sys, types, json, ast, importlib.util, numpy as np
R = sys.argv[1]; out = {}
sys.modules["openai"] = types.SimpleNamespace(OpenAI=object)
def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path); m = importlib.util.module_from_spec(spec)
    sys.modules[name] = m; spec.loader.exec_module(m); return m
U = load("gk_utils", R + "/general-knowledge/src/utils.py")
MK = load("gk_make", R + "/general-knowledge/src/data_generation/make_squad_data.py")
title = "Apollo 11"
context = "Apollo 11 was the first crewed mission to land on the Moon. Neil Armstrong and Buzz Aldrin landed the lunar module Eagle on July 20, 1969, while Michael Collins remained in lunar orbit."
prompt = MK.MAKE_SQUAD_DATA_TEMPLATES_BASE["implications"].format(title=title, context=context)
# a hand-written stand-in for what Qwen2.5-7B would generate as a self-edit
completion = """1. The first crewed Moon landing happened in 1969.
2. Neil Armstrong and Buzz Aldrin were the two astronauts who walked on the Moon during Apollo 11.
3. Michael Collins did not land on the Moon; he stayed in orbit.
4. The lunar module of Apollo 11 was named Eagle."""
seqs_default = U.build_train_sequences(completion, context, title)
seqs_split = U.build_train_sequences(completion, context, title, split_newlines=True)
out["gk"] = dict(prompt=prompt, completion=completion, seqs_default=seqs_default, seqs_split=seqs_split)
print("prompt:\n" + prompt); print("n seqs default:", len(seqs_default), "| split_newlines:", len(seqs_split))
for s in seqs_split: print("  ·", s.replace("\n", " ⏎ "))
EM = load("gk_em", R + "/general-knowledge/src/EM/build_SFT_dataset.py")
comps = [{"text": "self-edit A (restates passage)", "stats": {"adapter_mean": 0.33}},
         {"text": "self-edit B (lists implications)", "stats": {"adapter_mean": 0.67}},
         {"text": "self-edit C (off-topic)", "stats": {"adapter_mean": 0.00}},
         {"text": "self-edit D (Q&A pairs)", "stats": {"adapter_mean": 0.56}},
         {"text": "self-edit E (very long)", "stats": {"adapter_mean": 0.44}}]
best = EM._top_k(comps, 1, "adapter_mean")
allzero = EM._top_k([{"text": "x", "stats": {"adapter_mean": 0.0}}, {"text": "y", "stats": {"adapter_mean": 0.0}}], 1, "adapter_mean")
out["em"] = dict(comps=comps, best=best, allzero=allzero)
print("E-step top-1:", best, "| when every reward is 0 it still keeps:", allzero)
# --- few-shot ARC
sys.path.insert(0, R + "/few-shot")
import arclib.augmenters as A
from arclib.arc import Example, Task
src = open(R + "/few-shot/self-edit.py").read()
fn = next(n for n in ast.parse(src).body if isinstance(n, ast.FunctionDef) and n.name == "get_augmenters")
ns = {k: getattr(A, k) for k in dir(A)}; ns["List"] = list
exec(compile(ast.Module([fn], []), "self-edit.py:get_augmenters", "exec"), ns)
counts = {}
for combo in [(1,0,0,0),(1,1,0,0),(1,1,1,0),(1,1,1,1),(0,0,0,0)]:
    augs = ns["get_augmenters"](*map(bool, combo)); counts["".join(map(str, combo))] = [str(a) for a in augs]
grid = np.array([[1,1,0],[0,2,0],[0,0,0]])
rng = np.random.RandomState(0)
shown = {}
for a in [A.Rotate(90), A.Flip(0), A.Transpose(), A.IncreaseResolution(2), A.Chain([A.Rotate(90), A.IncreaseResolution(2)])]:
    shown[str(a)] = a.apply_to_grid(grid, rng=rng).tolist()
out["arc"] = dict(grid=grid.tolist(), aug_counts={k: len(v) for k, v in counts.items()}, aug_names=counts["1111"], shown=shown)
print("augmenters per config (basic,size,chain,repeat):", out["arc"]["aug_counts"])
for k, v in shown.items(): print(" ", k, v)
json.dump(out, open(sys.argv[2], "w"), indent=1, ensure_ascii=False)
