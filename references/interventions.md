# Interventions: levers, previews and feature requests

Intervention means knowing which part to change to test a specific hypothesis, and what changing it would cost.

## Where levers come from

1. **Paper↔code gaps**: every red or yellow edge in the paper→code view.
2. **Silent repairs**: code that quietly fixes model output (JSON repair, default values, "MANUAL NEUTRAL", fallback scripts). Each hides a failure rate.
3. **Real-data surprises**: ties at the top, degenerate outputs selected, noise larger than the differences being ranked.
4. **Hard-coded assumptions**: token ids, model-family-specific masks, Chinese-only heuristics, missing `target_modules`.
5. **Unused fields**: a `priority` that is printed but never computed with.

## Intervention cards

Each lever becomes a card in the inspector:

```
title       按论文：没有提升就不要
hypothesis  one sentence that could be false
diff        the smallest code change, as a diff against the pinned file (applied to a copy, never the repo)
measure     what to compare before/after
cost        CPU minutes / GPU hours / API calls
result      what the preview on real data shows (or "needs GPU, not previewed")
```

## Previewing on real data

If the repo commits real outputs (results JSON, eval logs), run the modified logic on them before anyone touches a GPU:
- load the repo's own function (`scripts/pyrun.py` `load(...)`), run it and the modified copy on the same data, count what changes;
- show the effect on a canvas (which samples drop out, which picks change) with the card beside it;
- label rough statistics as rough ("按两倍标准误粗略判断").

The SEAL example: the threshold lever removes 7/50 training samples; the tie-break lever changes 1 pick (the degenerate keyword list); the noise check finds 45/50 articles where the top two cannot be separated.

## Feature requests from natural language

Give a system graph an `intervene` block. The learner writes one sentence, clicks related components (anchor mode), and the page asks Claude (the `sample` capability) for a feature request grounded in the graph:

```js
GRAPHS.maic.intervene = {
  repo: "owner/repo @ sha",
  placeholder: "例如：…",
  conventions: [ "rules from AGENTS.md / CONTRIBUTING.md that constrain any change" ],
  facts: [ "findings from your reading that matter for changes" ],
  files: RUN.repoFiles,          // every file path at the pinned commit (for checking the answer)
  example: { prompt, anchors: [nodeIds], result: { title, summary, grounding, new_components, edges, flow, changes, contracts, risks, tests, eval, open_questions } }
};
```

What the page does with the answer:
- keeps only edges between existing or newly proposed node ids, and only flow steps along real edges (it reports how many it dropped);
- marks each changed file as present in the repo, a new file in an existing folder, or not found (a warning);
- draws new components as dashed magenta nodes below the graph and adds a playable scenario of the proposed data flow;
- offers "复制为 Markdown" for an issue or PR description.

Always write the `example` yourself from the code. It shows a grounded proposal, and it is the fallback when a viewer has not allowed live calls. Ground it in the repo's own evals where possible: a proposal that names how to measure success is worth more than one that only names files.
