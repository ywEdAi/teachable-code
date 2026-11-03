"""Run SEAL's real E-step (_top_k from build_SFT_dataset.py) on SEAL's own committed iter0 results,
and compare with the paper's reward definition (r=1 only if adaptation beats the base model)."""
import json, sys, importlib.util, statistics as st
R = sys.argv[1]
spec = importlib.util.spec_from_file_location("em", R + "/general-knowledge/src/EM/build_SFT_dataset.py")
em = importlib.util.module_from_spec(spec); spec.loader.exec_module(em)
res = {}
for it in ["rank_iter0", "rank_iter1"]:
    d = json.load(open(f"{R}/general-knowledge/results/query_server/3B/train/{it}.json"))
    arts = d["articles"]; picked = []; ties = 0; nonpos = 0; degenerate = 0
    for a in arts:
        comps = [{"text": c["text"], "stats": c["stats"]} for c in a["completions"]]
        best = em._top_k(comps, 1, "adapter_mean")[0]
        bi = [c["text"].strip() for c in comps].index(best)
        top = max(c["stats"]["adapter_mean"] for c in comps)
        nt = sum(1 for c in comps if abs(c["stats"]["adapter_mean"] - top) < 1e-9)
        ties += nt > 1
        g = comps[bi]["stats"]["gain_mean"]; nonpos += g <= 0
        lines = [l for l in best.splitlines() if l.strip()]
        dup = 1 - len(set(lines)) / max(1, len(lines))
        degenerate += dup > 0.3
        picked.append({"title": a["title"], "picked": bi, "n_tied_top": nt, "gain": round(g, 3), "dup_ratio": round(dup, 2)})
    res[it] = {"overall": d["overall"], "n": len(arts), "ties_at_top": ties, "picked_gain_le_0": nonpos, "picked_degenerate": degenerate,
               "lora": d["lora_params"], "picked": picked}
    print(it, "articles", len(arts), "| top ties", ties, "| picked with gain<=0 (paper would give r=0):", nonpos, "| picked degenerate (>30% duplicate lines):", degenerate)
    print("   overall:", d["overall"])
# eval: base vs iter2 on val
for f in ["base", "iter2"]:
    d = json.load(open(f"{R}/general-knowledge/results/query_server/3B/eval/{f}.json"))
    res["eval_" + f] = d["overall"]; print("eval", f, d["overall"])
# keep the Crimean War example in full
a = json.load(open(f"{R}/general-knowledge/results/query_server/3B/train/rank_iter0.json"))["articles"][0]
res["example"] = {"title": a["title"], "context": a["context"], "prompt": a["prompt"],
  "completions": [{"text": c["text"], "stats": c["stats"]} for c in a["completions"]],
  "questions": [{k: q[k] for k in ("question","answer","baseline_answer","adapter_answer","baseline_correct","adapter_correct")} for q in a["completions"][1]["questions"][:6]]}
comps = [{"text": c["text"], "stats": c["stats"]} for c in a["completions"]]
res["example"]["picked"] = [c["text"].strip() for c in comps].index(em._top_k(comps, 1, "adapter_mean")[0])
print("Crimean War picked completion index:", res["example"]["picked"])
json.dump(res, open(sys.argv[2], "w"), ensure_ascii=False, indent=1)
