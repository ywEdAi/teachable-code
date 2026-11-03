"""Run the notebook's own best_split / binarize_entropy / create_Xs_and_ys + sklearn LogisticRegression
on SYNTHETIC hidden states (no GPU/LLM available here). Purpose: exercise the procedure, not reproduce numbers."""
import json, sys, numpy as np, torch_stub
nb = json.load(open(sys.argv[1]))
src = {i: "".join(c["source"]) for i, c in enumerate(nb["cells"])}
import matplotlib; matplotlib.use("Agg")
from matplotlib import pyplot as plt
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
g = {"np": np, "plt": plt, "train_test_split": train_test_split, "torch": torch_stub}
exec(src[12], g)   # create_Xs_and_ys
exec(src[16], g)   # best_split, binarize_entropy
rng = np.random.default_rng(0)
N, L, D = 1200, 32, 96
# semantic entropy values: mixture of "sure" (near 0) and "confabulating" (~1-1.6)
se = np.where(rng.random(N) < 0.55, np.abs(rng.normal(0, 0.15, N)), rng.uniform(0.6, 1.8, N))
acc = (rng.random(N) < np.where(se < 0.5, 0.85, 0.3)).astype(int)
direction = rng.normal(size=D); direction /= np.linalg.norm(direction)
snr = 0.15 + 1.6 * np.exp(-((np.arange(L) - 20) / 7.0) ** 2)   # assumed: signal strongest in mid-late layers
X = np.stack([rng.normal(size=(N, D)) + np.outer(snr[l] * (se - se.mean()), direction) for l in range(L)])
split = g["best_split"](torch_stub.tensor(se))
b = g["binarize_entropy"](torch_stub.tensor(se), split).numpy()
Xtr, Xva, Xte, ytr, yva, yte = g["create_Xs_and_ys"](X, b)
aurocs_se, aurocs_acc = [], []
for l in range(L):
    m = LogisticRegression(max_iter=1000).fit(Xtr[l], ytr[l])
    aurocs_se.append(roc_auc_score(yte[l], m.predict_proba(Xte[l])[:, 1]))
    # SEP used to predict hallucination: high P(high-SE) -> predicts wrong answer
    _, Xt2, _, acc_te = train_test_split(X[l], acc, test_size=0.1, random_state=42)
    aurocs_acc.append(roc_auc_score(1 - acc_te, m.predict_proba(Xt2)[:, 1]))
res = dict(best_split=float(split), frac_high=float(b.mean()), auroc_se_by_layer=[round(a, 3) for a in aurocs_se],
           auroc_halluc_by_layer=[round(a, 3) for a in aurocs_acc], N=N, L=L, D=D)
print(json.dumps({k: v for k, v in res.items()}, indent=0)[:900])
json.dump(res, open(sys.argv[2], "w"))
