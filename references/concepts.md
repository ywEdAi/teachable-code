# The knowledge layer

Code is procedural knowledge; reading it needs declarative knowledge the code never states. The knowledge layer puts those ideas on the same canvas as the code, so the reader sees both what runs and why.

## Choosing concepts

- 8–12 per repo. Pick the ideas without which a specific node cannot be understood, not the field's syllabus.
- Every concept must point at least one purple edge to a code node ("用在这里"). A concept that touches no node does not belong on this page.
- Add prerequisite edges between concepts (`kind:"prereq"`) so the layer forms a path from the most basic idea (often "next-token probability") to the repo's key method.
- Include one concept for each place the evidence surprised you (e.g. "奖励噪声" when real data shows the reward cannot separate candidates). These are where understanding turns into intervention.

## Writing a concept node

```js
{ id: "c_restem", label: "ReST-EM", sub: "只在好样本上做 SFT", kind: "concept", layer: "concept",
  def: "E 步：采样很多输出，按奖励筛出好的；M 步：只在这些好输出上做 SFT。",          // one or two plain sentences
  formula: "奖励 r ∈ {0,1} 时，式 (4) 里 r=0 的项消失 → 等价于只在 r=1 的样本上 SFT",   // HTML allowed (<sub>, <sup>)
  here: "how THIS repo uses it, with its real numbers and settings",
  trap: "the misconception a newcomer is most likely to form",
  mini: "rest",                                          // MINIS.rest = () => small inline SVG, ideally real data
  prereq: ["c_pg", "c_sft"] }
```

- `def` stays field-general; `here` is repo-specific and quotes real settings (rank 32, 10 epochs, lr 1e-3).
- `trap` is the most useful field. Write the wrong belief the code or data would correct ("最好的那个不等于好的").
- A `mini` visual beats a paragraph. Best: a tiny chart of the repo's real data (the five real self-edits and their rewards); otherwise a size comparison or a token-mask strip.

## Depth by background

| Background (from the interview) | Show |
|---|---|
| 刚接触 | all fields, mini visual, prerequisites expanded, concept route scenario first |
| 懂概念没读过代码 | def + here + trap; formula when it maps to a line of code |
| 写过类似代码 | here + trap only; knowledge layer off by default |
| Concepts marked known | collapsed in the card ("展开" button), dimmed on the canvas, skipped by the concept route |

## The concept route

Add a scenario named like "从零读懂 · 概念顺序" that walks prerequisite edges and, after each concept, a "用在这里" edge to the code. The engine skips steps into concepts the learner marked as known, and prediction mode asks where each concept is used.
