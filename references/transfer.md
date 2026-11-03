# Transfer: patterns across repos and experiments elsewhere

Transfer is the most open-ended capability and the easiest to overclaim. Keep it concrete: every pattern is grounded in specific nodes, every difference is stated, and every transfer question ends in an experiment someone could run in two weeks.

## Finding patterns

Put the repos side by side and look for the same move made for different reasons:
- **Sample many → score → select or aggregate** (SEP aggregates 10 answers into an entropy; SEAL keeps the top of 5 self-edits; OpenMAIC samples once and relies on rules).
- **A model as judge** (NLI for equivalence; GPT-4.1 for correctness that becomes a reward; an LLM judge only in offline evals).
- **Repairing model text into structure** (keyword search in the first 30 characters; splitting on `---`; parse → jsonrepair → partial-json).

Lay them out as rows: pattern → one node per repo (with a `jump` to the real node) → a transfer question. Each repo node's `role` says what differs. Label the whole graph "探索性": the patterns are your synthesis, not something the code states.

## From question to experiment

Give each question node an `experiment`:

```js
experiment: { hyp: "one falsifiable sentence", minimal: "the smallest build or run, concrete steps",
              metric: "what to measure", cost: "time / compute", risk: "the most likely way this transfer fails" }
```

Prefer experiments that reuse the repos' own data and functions (cluster SEAL's committed self-edits with SEP's `get_semantic_ids`), so the first step needs no new infrastructure.

## The learner's own target

Give the patterns graph a `transfer` block. The learner types where they want to use the ideas (from the interview's round-2 answer or the page's onboarding), and the page asks Claude for three experiment cards grounded in the pattern nodes. Write an `example` target and three cards yourself as the fallback.

```js
GRAPHS.patterns.transfer = { placeholder: "…", example: { target: "…", cards: [ { title, pattern, from, hypothesis, minimal_experiment, metric, cost, risk } ] } };
```
