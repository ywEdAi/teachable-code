"""Intervention previews on SEAL's own committed iter0 results (no GPU needed for A-C):
 A  paper-faithful threshold: keep the top self-edit only if it beats the base model (paper Eq. 2)
 B  tie-break on gain_mean, then reject self-edits with >30% duplicate lines
 C  reward noise: is the top-1 distinguishable from the runner-up given 3 evaluations?
Each lever is applied to a copy of the repo's real _top_k, never to the repo itself."""
import json, sys, math, importlib.util
R = sys.argv[1]
spec = importlib.util.spec_from_file_location("em", R + "/general-knowledge/src/EM/build_SFT_dataset.py")
em = importlib.util.module_from_spec(spec); spec.loader.exec_module(em)
d = json.load(open(f"{R}/general-knowledge/results/query_server/3B/train/rank_iter0.json"))
def dup(t):
    ls = [l.strip() for l in t.splitlines() if l.strip()]; return 1 - len(set(ls)) / max(1, len(ls))
arts = []
for a in d["articles"]:
    comps = [{"text": c["text"], "stats": c["stats"]} for c in a["completions"]]
    texts = [c["text"].strip() for c in comps]
    base = texts.index(em._top_k(comps, 1, "adapter_mean")[0])
    # A
    keepA = comps[base]["stats"]["gain_mean"] > 0
    # B: sort by (adapter_mean, gain_mean), skip degenerate
    order = sorted(range(5), key=lambda i: (comps[i]["stats"]["adapter_mean"], comps[i]["stats"]["gain_mean"]), reverse=True)
    pickB = next((i for i in order if dup(comps[i]["text"]) <= 0.3), order[0])
    # C: standard error of each mean over 3 evals
    se = [c["stats"]["adapter_std"] / math.sqrt(3) for c in comps]
    m = [c["stats"]["adapter_mean"] for c in comps]
    o = sorted(range(5), key=lambda i: m[i], reverse=True)
    distinct = (m[o[0]] - m[o[1]]) > (se[o[0]] + se[o[1]])
    arts.append({"title": a["title"], "base": round(a["stats"]["baseline_accuracy"], 3),
                 "comps": [{"m": round(m[i], 3), "sd": round(c["stats"]["adapter_std"], 3), "gain": round(c["stats"]["gain_mean"], 3), "dup": round(dup(c["text"]), 2)} for i, c in enumerate(comps)],
                 "pick": base, "keepA": keepA, "pickB": pickB, "distinctC": distinct})
summary = {"n": len(arts), "A_dropped": sum(not a["keepA"] for a in arts), "B_changed": sum(a["pick"] != a["pickB"] for a in arts),
           "C_indistinct": sum(not a["distinctC"] for a in arts),
           "within_sd": d["overall"]["mean_adapter_std_within_completions"], "between_sd": d["overall"]["mean_adapter_std_over_completions"]}
print(summary)
json.dump({"summary": summary, "articles": arts}, open(sys.argv[2], "w"), ensure_ascii=False)
