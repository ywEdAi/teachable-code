#!/usr/bin/env python3
"""Record a real trace from a tiny GPT for the nanoGPT lesson.

This is our own small model written to follow nanoGPT's model.py. It does not import or execute nanoGPT.
usage: run_trace.py INPUT_TXT OUT_JSON   (input: tiny Shakespeare, see nanoGPT/data/shakespeare_char/prepare.py)
"""
import json, math, sys
import torch, torch.nn as nn, torch.nn.functional as F

SEED, N_LAYER, N_HEAD, N_EMBD, BLOCK, BATCH, LR, ITERS = 1337, 2, 2, 16, 16, 32, 1e-3, 3000
SNAPS = [0, 50, 200, 500, 1000, 2000, 3000]; PROMPT = "ROMEO:"
torch.manual_seed(SEED); text = open(sys.argv[1]).read()
chars = sorted(set(text)); stoi = {c: i for i, c in enumerate(chars)}; itos = dict(enumerate(chars))
ids = torch.tensor([stoi[c] for c in text]); n = int(.9 * len(ids)); train, val = ids[:n], ids[n:]
r = lambda t, d=3: [round(float(v), d) for v in t.flatten().tolist()] if t.dim() == 1 else [r(x, d) for x in t]

class Attn(nn.Module):
    def __init__(s):
        super().__init__(); s.c_attn = nn.Linear(N_EMBD, 3 * N_EMBD, bias=False); s.c_proj = nn.Linear(N_EMBD, N_EMBD, bias=False)
        s.register_buffer("mask", torch.tril(torch.ones(BLOCK, BLOCK))); s.last = None
    def forward(s, x):
        B, T, C = x.size(); q, k, v = s.c_attn(x).split(N_EMBD, dim=2); h = C // N_HEAD
        q, k, v = [a.view(B, T, N_HEAD, h).transpose(1, 2) for a in (q, k, v)]
        att = (q @ k.transpose(-2, -1)) / math.sqrt(h); att = att.masked_fill(s.mask[:T, :T] == 0, float("-inf")); att = F.softmax(att, dim=-1)
        s.last = {"att": att.detach(), "q": q.detach(), "k": k.detach(), "v": v.detach()}
        return s.c_proj((att @ v).transpose(1, 2).contiguous().view(B, T, C))
class MLP(nn.Module):
    def __init__(s):
        super().__init__(); s.a = nn.Linear(N_EMBD, 4 * N_EMBD, bias=False); s.b = nn.Linear(4 * N_EMBD, N_EMBD, bias=False)
    def forward(s, x): return s.b(F.gelu(s.a(x)))
class Block(nn.Module):
    def __init__(s):
        super().__init__(); s.ln1 = nn.LayerNorm(N_EMBD); s.attn = Attn(); s.ln2 = nn.LayerNorm(N_EMBD); s.mlp = MLP()
    def forward(s, x): x = x + s.attn(s.ln1(x)); return x + s.mlp(s.ln2(x))
class GPT(nn.Module):
    def __init__(s):
        super().__init__(); s.wte = nn.Embedding(len(chars), N_EMBD); s.wpe = nn.Embedding(BLOCK, N_EMBD)
        s.h = nn.ModuleList(Block() for _ in range(N_LAYER)); s.ln = nn.LayerNorm(N_EMBD); s.head = nn.Linear(N_EMBD, len(chars), bias=False)
        s.apply(lambda m: isinstance(m, (nn.Linear, nn.Embedding)) and nn.init.normal_(m.weight, 0, .02)); s.head.weight = s.wte.weight
    def forward(s, idx, y=None, keep=None):
        tok, pos = s.wte(idx), s.wpe(torch.arange(idx.size(1))); x = tok + pos
        if keep is not None: keep.update(tok=tok.detach(), pos=pos.detach(), x0=x.detach(), blocks=[])
        for b in s.h:
            x = b(x)
            if keep is not None: keep["blocks"].append(x.detach())
        logits = s.head(s.ln(x)); loss = None if y is None else F.cross_entropy(logits.view(-1, logits.size(-1)), y.view(-1))
        return logits, loss
def batch(d, bs=BATCH):
    i = torch.randint(len(d) - BLOCK, (bs,)); return torch.stack([d[j:j + BLOCK] for j in i]), torch.stack([d[j + 1:j + 1 + BLOCK] for j in i])
@torch.no_grad()
def est(m): return {k: round(float(sum(m(*batch(d))[1] for _ in range(40)) / 40), 4) for k, d in (("train", train), ("val", val))}
@torch.no_grad()
def gen(m, p, k=120, seed=7):
    g = torch.Generator().manual_seed(seed); x = torch.tensor([[stoi[c] for c in p]]); steps = []
    for _ in range(k):
        pr = F.softmax(m(x[:, -BLOCK:])[0][:, -1], -1); nx = torch.multinomial(pr, 1, generator=g); x = torch.cat((x, nx), 1)
    return "".join(itos[i] for i in x[0].tolist())
def forward_snapshot(m, p):
    x = torch.tensor([[stoi[c] for c in p]]); keep = {}
    with torch.no_grad(): lg, _ = m(x, keep=keep)
    pr = F.softmax(lg[0, -1], -1); top = torch.topk(pr, 10); a = m.h[0].attn.last
    return {"tok": r(keep["tok"][0]), "pos": r(keep["pos"]), "x0": r(keep["x0"][0]), "blocks": [r(b[0]) for b in keep["blocks"]], "q": r(a["q"][0, 0]), "k": r(a["k"][0, 0]), "v": r(a["v"][0, 0]), "att": r(a["att"][0, 0]), "att_block2": r(m.h[1].attn.last["att"][0, 0]), "top": [[itos[i], round(float(v), 4)] for v, i in zip(top.values, top.indices.tolist())]}

m = GPT(); opt = torch.optim.AdamW(m.parameters(), lr=LR); out = {"meta": {"seed": SEED, "n_layer": N_LAYER, "n_head": N_HEAD, "n_embd": N_EMBD, "block_size": BLOCK, "batch": BATCH, "lr": LR, "iters": ITERS, "vocab": len(chars), "params": sum(p.numel() for p in m.parameters()), "corpus_chars": len(text), "torch": torch.__version__}, "chars": chars, "prompt": PROMPT, "prompt_ids": [stoi[c] for c in PROMPT]}
out["snaps"] = []; out["curve"] = []; emb = []
for it in range(ITERS + 1):
    if it in SNAPS or it % 100 == 0:
        e = est(m); out["curve"].append([it, e["train"], e["val"]])
    if it in SNAPS:
        emb.append(m.wte.weight.detach().clone()); out["snaps"].append({"iter": it, **e, "sample": gen(m, PROMPT), "top": forward_snapshot(m, PROMPT)["top"][:6], "att": forward_snapshot(m, PROMPT)["att"]})
    if it == ITERS: break
    X, Y = batch(train); _, loss = m(X, Y)
    if it == 1000:   # one fully recorded training step, on one window from the batch
        before = m.wte.weight.detach().clone(); opt.zero_grad(set_to_none=True); loss.backward(); g = m.wte.weight.grad.clone(); c = stoi["e"]
        grads = {n: round(float(p.grad.norm()), 4) for n, p in m.named_parameters() if n in ("wte.weight", "wpe.weight", "h.0.attn.c_attn.weight", "h.1.mlp.b.weight")}
        opt.step(); out["step"] = {"iter": it, "x": "".join(itos[i] for i in X[0].tolist()), "y": "".join(itos[i] for i in Y[0].tolist()), "loss": round(float(loss.detach()), 4), "char": "e", "w_before": r(before[c]), "grad": r(g[c], 5), "w_after": r(m.wte.weight.detach()[c]), "grad_norms": grads}
        continue
    opt.zero_grad(set_to_none=True); loss.backward(); opt.step()
final = forward_snapshot(m, PROMPT); out["forward"] = final
# autoregressive loop, recorded token by token at the final weights
g = torch.Generator().manual_seed(7); x = torch.tensor([[stoi[c] for c in PROMPT]]); loop = []
with torch.no_grad():
    for _ in range(12):
        pr = F.softmax(m(x[:, -BLOCK:])[0][:, -1], -1); nx = torch.multinomial(pr, 1, generator=g); t = torch.topk(pr[0], 3)
        loop.append({"context": "".join(itos[i] for i in x[0].tolist()), "next": itos[int(nx)], "p": round(float(pr[0, nx]), 3), "top": [[itos[i], round(float(v), 3)] for v, i in zip(t.values, t.indices.tolist())]}); x = torch.cat((x, nx), 1)
out["loop"] = loop
# PCA on final char embeddings; all snapshots projected onto the same 3 axes, so motion is comparable
E_ = torch.stack(emb); mu = E_[-1].mean(0); _, S_, V = torch.linalg.svd(E_[-1] - mu); ax = V[:3]
out["cloud"] = {"explained": r(S_[:3] ** 2 / (S_ ** 2).sum(), 3), "frames": [r((f - mu) @ ax.T, 3) for f in E_]}
json.dump(out, open(sys.argv[2], "w"), ensure_ascii=False, separators=(",", ":"))
print(out["meta"]); print(out["step"]["loss"], out["curve"][0], out["curve"][-1]); [print(s["iter"], s["train"], s["val"], repr(s["sample"][:70])) for s in out["snaps"]]; print([ (l["next"],l["p"]) for l in loop]); print(final["top"]); print(out["cloud"]["explained"])
