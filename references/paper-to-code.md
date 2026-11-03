# Paper → code

Reproduction fails most often where people assume the code does what the paper says. This view makes every correspondence explicit.

## Build it

1. Read the paper's method section and list its algorithm lines, numbered equations, design choices ("we tried GRPO and PPO but found training unstable") and headline results. Use the paper's HTML version when the PDF is hard to read; quote numbers exactly.
2. For each item, find the code that implements it (or the committed result that reports it).
3. Assign a status and write one sentence of evidence:

| Status | Edge kind | Meaning |
|---|---|---|
| 一致 match | `match` (green) | the code does what the paper says |
| 近似 approx | `approx` (yellow) | same intent, different detail (continuous accuracy instead of a 0/1 reward; loss also on padding) |
| 偏离 diverge | `diverge` (red) | the code does something the paper's definition excludes (keeps the top self-edit even when it does not beat the baseline) |
| 不可比 nocompare | `nocompare` (grey dots) | numbers or settings that cannot be compared (paper uses 7B, committed results are in a `3B` folder) |

4. Put the evidence in the paper node's `maps`, with numbers you measured:

```js
{ id: "p_eq2", label: "式 (2) · 二值奖励", sub: "r = 1 当且仅当超过基线", kind: "paper", tag: "Eq. 2", w: 460,
  maps: [ { s: "diverge", to: "k_topk", why: "…", evidence: "实跑 _top_k 于提交的第 0 轮数据：50 篇里有 7 篇…" } ] }
```

5. Add one scenario ("逐条核对") that walks the edges top to bottom.

## Rules

- Only claim a divergence you verified, by reading the line or running the function on real data. Otherwise call it "未核实" in the text and use `approx`.
- When the paper itself admits the variant (a footnote), say so: the divergence may be intended. The useful finding is whether the code enforces the paper's condition.
- Red and yellow edges are the entry points to intervention: link each to a lever card when one exists.
