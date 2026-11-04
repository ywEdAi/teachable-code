#!/usr/bin/env python3
"""Replay mini-sglang's prefix-cache rules in our own small simulation, and measure what they save.
Own code, standard library + numpy. It follows radix_cache.py and scheduler/cache.py by hand. It does not import or run mini-sglang.
Writes runs/cache.json. page_size = 1, the repo's default. Pool holds 26 slots so that eviction shows up."""
import json, os, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); DIM = 12; CAP = 26
rng = np.random.default_rng(7); EMB, QW, KW, VW = {}, rng.normal(size=(DIM, DIM)) / 3, rng.normal(size=(DIM, DIM)) / 3, rng.normal(size=(DIM, DIM)) / 3
def emb(t):
    if t not in EMB: EMB[t] = rng.normal(size=DIM)
    return EMB[t]
def softmax(x): e = np.exp(x - x.max()); return e / e.sum()
def layer(tokens, past_k=None, past_v=None):
    """One attention layer. tokens are the new ones; past_k/past_v are saved results for earlier tokens. Same maths either way."""
    n0 = 0 if past_k is None else len(past_k); K = [] if past_k is None else list(past_k); V = [] if past_v is None else list(past_v); out, att = [], []
    for t in tokens:
        x = emb(t) ; K.append(KW @ x); V.append(VW @ x)
        w = softmax(np.array(K) @ (QW @ x) / np.sqrt(DIM)); att.append(w); out.append(w @ np.array(V))
    return np.array(K), np.array(V), np.array(out), att

class Node:
    def __init__(s, key, val, tic): s.key, s.val, s.tic, s.kids, s.parent, s.ref = list(key), list(val), tic, {}, None, 0
class Cache:
    def __init__(s): s.root = Node([], [], 0); s.root.ref = 1; s.free = list(range(CAP)); s.tic = 0; s.evictable = 0
    def walk(s, ids):
        s.tic += 1; node, pre = s.root, 0
        while pre < len(ids):
            ch = node.kids.get(ids[pre])
            if ch is None: return node, pre
            m = 0
            while m < len(ch.key) and pre + m < len(ids) and ch.key[m] == ids[pre + m]: m += 1
            pre += m
            if m != len(ch.key):   # split_at
                top = Node(ch.key[:m], ch.val[:m], ch.tic); top.parent = node; node.kids[top.key[0]] = top; top.ref = ch.ref
                ch.key, ch.val = ch.key[m:], ch.val[m:]; ch.parent = top; top.kids[ch.key[0]] = ch; top.tic = s.tic; return top, pre
            ch.tic = s.tic; node = ch
        return node, pre
    def slots(s, node):
        out = []
        while node.parent: out = node.val + out; node = node.parent
        return out
    def match(s, ids):   # match_req: the last input token is always recomputed
        node, pre = s.walk(ids[:-1]); return node, pre
    def insert(s, ids, vals):
        node, pre = s.walk(ids)
        if pre != len(ids):
            n = Node(ids[pre:], vals[pre:], s.tic); n.parent = node; node.kids[n.key[0]] = n; s.evictable += len(n.key)
        return pre
    def alloc(s, n):
        ev = []
        if n > len(s.free): ev = s.evict(n - len(s.free))
        a, s.free = s.free[:n], s.free[n:]; return a, ev
    def evict(s, size):
        got, names = 0, []
        def leaves(x):
            if not x.kids: return [x] if x.ref == 0 else []
            return [l for c in x.kids.values() for l in leaves(c)]
        while got < size:
            n = min(leaves(s.root), key=lambda x: x.tic); got += len(n.key); s.free += n.val; pool[n.val] = 0; names.append(" ".join(n.key)); del n.parent.kids[n.key[0]]
        return names
    def tree(s):
        def f(n): return {"tokens": n.key, "slots": n.val, "kids": [f(c) for c in n.kids.values()]}
        return [f(c) for c in s.root.kids.values()]

c = Cache(); pool = np.zeros((CAP, DIM)); events = []; KV = {}
def ev(name, **k): events.append({"name": name, "pool": np.round(pool, 3).tolist(), "tree": c.tree(), "free": len(c.free), **k})
def run(tokens, gen, name, snapshot_each=False):
    node, hit = c.match(tokens); cached = c.slots(node)[:hit]; ev(name + ":match", tokens=tokens, hit=hit, computed=0, shared=cached)
    new = tokens[hit:]; slots, evicted = c.alloc(len(new))
    past_k = [KV[s][0] for s in cached] or None; past_v = [KV[s][1] for s in cached] or None
    K, V, out, att = layer(new, past_k, past_v)
    for i, sl in enumerate(slots): KV[sl] = (K[hit + i], V[hit + i]); pool[sl] = K[hit + i]
    _, _, full, att_full = layer(tokens); diff = float(np.abs(full[-1] - out[-1]).max())
    ev(name + ":compute", tokens=tokens, hit=hit, computed=len(new), new_slots=slots, evicted=evicted, diff=diff, without_cache=len(tokens), att=[np.round(a, 3).tolist() for a in att_full])
    seq, sl = list(tokens), cached + slots
    for g in gen[:-1]:   # decode: each generated token but the last is fed back and saved
        a, ev2 = c.alloc(1); K2, V2, _, _ = layer([g], [KV[x][0] for x in sl], [KV[x][1] for x in sl]); KV[a[0]] = (K2[-1], V2[-1]); pool[a[0]] = K2[-1]; seq.append(g); sl += a
        ev(name + ":decode", token=g, slot=a[0], tokens=list(seq))
    return seq, sl, hit
def finish(seq, sl, hit):
    pre = c.insert(seq, sl); dup = sl[hit:pre] if pre > hit else []
    c.free += dup
    for d in dup: pool[d] = 0
    return dup

base = "You are a helpful tutor . Explain".split()
A = base + ["KV", "cache"]; seq, sl, hit = run(A, ["It", "stores", "pairs"], "A"); finish(seq, sl, hit); ev("A:saved", dup=[])
B = base + ["radix", "tree"]; seq, sl, hit = run(B, ["A"], "B"); finish(seq, sl, hit); ev("B:saved", dup=[])
# C and D arrive together: both look up before either has saved anything (prefill.py matches each request while building one batch)
j = "You are a strict judge . Score this".split(); C = j + ["essay"]; D = j + ["poem"]
nc, hc = c.match(C); nd, hd = c.match(D); hits = [hc, hd]
sc = c.slots(nc)[:hc]; sd = c.slots(nd)[:hd]; ev("CD:match", hits=hits, c=C, d=D)
ac, _ = c.alloc(len(C) - hc); ad, _ = c.alloc(len(D) - hd)
for t, a, h, tok in ((C, ac, hc, sc), (D, ad, hd, sd)):
    K, V, _, _ = layer(t[h:], [KV[x][0] for x in tok], [KV[x][1] for x in tok])
    for i, s_ in enumerate(a): KV[s_] = (K[h + i], V[h + i]); pool[s_] = K[h + i]
ev("CD:compute", computed=[len(ac), len(ad)], slots=[ac, ad])
dc = finish(C, sc + ac, hc); dd = finish(D, sd + ad, hd); ev("CD:saved", dup=[dc, dd], wasted=len(dd))
E = "Translate this short note into French for me please".split(); seq, sl, hit = run(E, ["Bien"], "E"); finish(seq, sl, hit); ev("E:saved", dup=[])
json.dump({"capacity": CAP, "dim": DIM, "events": events}, open(os.path.join(HERE, "runs", "cache.json"), "w"), indent=0)
for e in events: print(e["name"], {k: v for k, v in e.items() if k in ("hit", "computed", "hits", "evicted", "diff", "dup", "wasted", "free", "new_slots", "slot", "without_cache")})
def show(n, d=0):
    print("  " * d, " ".join(n["tokens"]), n["slots"]); [show(k, d + 1) for k in n["kids"]]
[show(n) for n in events[-1]["tree"]]
