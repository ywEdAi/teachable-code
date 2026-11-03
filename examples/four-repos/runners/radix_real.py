"""Run mini-sglang's REAL RadixPrefixCache (kvcache/radix_cache.py) on CPU with a numpy-backed torch shim.
Only torch tensor plumbing + the CUDA key-compare kernel are stubbed; tree logic is the repo's own code."""
import sys, types, json, importlib.util, numpy as np
root = sys.argv[1]
class TT(np.ndarray):
    def clone(self): return self.copy()
def as_t(x): return np.asarray(x, dtype=np.int32).view(TT)
torch = types.ModuleType("torch"); torch.Tensor = TT; torch.device = str; torch.int32 = np.int32
torch.empty = lambda n, dtype=None, device=None: as_t(np.empty(n))
torch.cat = lambda xs: as_t(np.concatenate(xs))
sys.modules["torch"] = torch
def fast_compare_key(a, b):
    n = min(len(a), len(b)); d = np.nonzero(np.asarray(a[:n]) != np.asarray(b[:n]))[0]
    return int(d[0]) if len(d) else n
for n in ["minisgl", "minisgl.kernel", "minisgl.core", "minisgl.utils", "minisgl.kvcache"]:
    sys.modules[n] = types.ModuleType(n)
sys.modules["minisgl.kvcache"].__path__ = [root + "/kvcache"]
sys.modules["minisgl.kernel"].fast_compare_key = fast_compare_key
PAGE = int(sys.argv[3]) if len(sys.argv) > 3 else 1
sys.modules["minisgl.core"].get_global_ctx = lambda: types.SimpleNamespace(page_size=PAGE)
sys.modules["minisgl.utils"].align_down = lambda a, b: (a // b) * b
def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path); m = importlib.util.module_from_spec(spec)
    sys.modules[name] = m; spec.loader.exec_module(m); return m
load("minisgl.kvcache.base", root + "/kvcache/base.py")
rc = load("minisgl.kvcache.radix_cache", root + "/kvcache/radix_cache.py")

vocab = {}
def tok(s): return as_t([vocab.setdefault(w, len(vocab) + 100) for w in s.split()])
cache = rc.RadixPrefixCache("cpu")
next_slot = [0]
def dump(node, words):
    out = []
    for ch in sorted(node.children.values(), key=lambda n: n.uuid):
        out.append({"tokens": [words[int(t)] for t in ch._key], "slots": [int(v) for v in ch.value], "ref": ch.ref_count,
                    "children": dump(ch, words)})
    return out
inv = lambda: {v: k for k, v in vocab.items()}
trace = []
SYS = "You are a helpful tutor ."
reqs = [SYS + " Explain KV cache", SYS + " Explain radix tree", SYS + " Explain KV cache eviction", "Hi there"]
for i, text in enumerate(reqs):
    ids = tok(text)
    m = cache.match_prefix(ids); h = m.cuda_handle if hasattr(m, "cuda_handle") else m[0]
    hit = h.cached_len
    new = len(ids) - hit
    slots = np.concatenate([np.asarray(h.get_matched_indices()) if hit else np.zeros(0, int), np.arange(next_slot[0], next_slot[0] + new)])
    next_slot[0] += new
    cache.lock_handle(h)
    res = cache.insert_prefix(ids, as_t(slots))
    cache.lock_handle(h, unlock=True)
    trace.append({"step": f"req{i+1}", "text": text, "n_tokens": len(ids), "prefix_hit": int(hit), "new_kv_slots_computed": int(new),
                  "size": cache.size_info._asdict(), "tree": dump(cache.root_node, inv())})
    print(f"req{i+1}: {len(ids)} tokens, prefix hit {hit}, computed {new}, sizes {cache.size_info}")
ev = cache.evict(3)
trace.append({"step": "evict(3)", "evicted_slots": [int(x) for x in ev], "size": cache.size_info._asdict(), "tree": dump(cache.root_node, inv())})
print("evict(3) freed slots", list(map(int, ev)), cache.size_info)
json.dump(trace, open(sys.argv[2], "w"), indent=1)
