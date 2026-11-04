# Step lessons: teach any repo

A lesson follows one concrete piece of data through a system, one step at a time. Every step shows what went in, what changed it and what came out, in the same format. It is written for a reader who does not code.

**The whole system is always on screen.** A lesson is one fixed map, not a sequence of scenes. Parts of the system and the wires between them stay in place from step 1; a step only lights up what it uses and changes the data sitting there. The canvas, folder, data trail, step text, input and output share one screen with no page scrolling on a desktop-sized window (under 1100px wide the panels stack and the page scrolls).

## Route first

```bash
python3 scripts/classify_repo.py REPO
```

This is a guess from text patterns, so confirm it with the learner. A repo can be several kinds, and each kind gets its own lesson.

| Kind | Stage | Follow this | Typical chapters |
|---|---|---|---|
| `tensor`: model or training code | 3D | A short real input, then one training step | One prediction · Keep writing · Learning |
| `llm_call`: an app that calls a model | 2D | One user message that uses a tool | You press send · What the model reads (system, context, tools) · The model loop · Back to you |
| `web_app`: software with routes and storage | 2D | One user action, end to end | Request · Checks · Data · Response |
| `systems`: services, databases, schedulers | 2D, or 3D if layout in memory or space is the point | One operation under one interesting condition | Arrive · Queue · Do the work · Failure or concurrency case |
| `library` or CLI | 2D | One public call | Call · Internal steps · Return |

Use 3D when the shape of the data is the lesson: tensors, weights, attention, memory layouts. Use 2D when the connections are the lesson. Do not use 3D for decoration.

## Evidence

Prefer real values. Capture them with the following, in order:

1. Run the repo with a trace, if it is allowed and affordable.
2. Run a small reimplementation of your own, and say so on the page. See `examples/lessons/nanogpt/run_trace.py`.
3. Copy real text out of the source, such as prompts and schemas. See `examples/lessons/deeptutor/measure.py`. Look for recordings committed to the repo too: `examples/lessons/swe-agent/measure.py` reads a saved agent run as data.
4. Write an example and mark it as one.

Every input and output carries `prov`: `ran`, `read` or `illustrative`. `limits` states on the page what was not run.

## Write the lesson

`LESSON_DIR/lesson.js` sets `LESSON`. `runs.json` maps names to JSON files, which arrive as `RUN.name`.

```js
LESSON = {
  id, title, question, kind,
  repo: { name, url, commit },          // full commit hash; build refuses any other checkout
  limits: ["what was not run"],
  folders: { "lib/ai": "plain-language note" },   // shown as a hover note in the folder
  stage: {
    mode: "3d" | "2d", world: { w, h } /* 2d */, legend,
    stations: { id: { label, note, box: [x, z, w, d], files: ["real/path.py"] } },  // 3d: the permanent parts
    wires: [[stationA, stationB]],      // 3d: extra paths; paths used by a flow are drawn automatically
    edges: [[a, b]],                    // 2d: the same
    objects: { id: {...} }              // 3d: data, each with `at: stationId`. 2d: the parts, each with `files`
  },
  steps: [{
    chapter, title, cap,                // cap is the one line over the stage
    plain,                              // under 75 words, no unexplained jargon
    why, facts, tech,                   // optional; tech is the "For engineers" fold
    show, hide /* list */, focus, flow: [{ from, to, label, kind }],
    input: {...}, transform: { label, text }, output: {...},
    log: [from, to, what, size],
    code: { f, a, b, must },            // `must` is text that has to appear in those lines
    ask: { q, options, answer, explain },  // optional, used by Guess first
    set, animate, play, dwell, segs     // optional staging
  }]
}
```

**Values** for `input` and `output`: `text`, `chips` (`items`, `subs`), `matrix` (`values`, `rowLabels`, `colLabels`), `bars` (`items`, `pct`), `segments` (labelled blocks), `pair` (two values).

**3D objects:** `tiles` (rounded keys; `tones` colours each key), `slab` (a 2D array of numbers drawn as a block; `flat: true` for heatmaps, `max` to share a scale), `bars`, `box`, `label`, `link` (a tube from `a` to `b`), `tower` (layers stacked to scale; `scale` is height per character), `cloud` (points that move across `frames`), `curve`.

**Changing an object inside a step:** `set: { id: {...} }` sticks until a later step changes it. `slab`: `values` (morphs), `hiRows` (others fade), `rows` (how many are filled). `tower`: `upto`, `sizes`, `glow`. `tiles`: `tones`. `cloud`: `frame`. 2D `stack`: `items` (with `fixed: true` on the stack, bars keep the same scale as it grows).

**A loop inside one step:** `play: { ms, frames: [{ set, cap }] }` replays frames and repeats, so readers can watch an iteration loop. See `examples/lessons/swe-agent/lesson.js` step 11.

**2D objects:** `node` with `role` (`user`, `app`, `data`, `model`, `tool`, `external`), `group`, and `stack`, a bar drawn to scale that shows what goes into a call.

## Rules that make it teach

- Pick one concrete example, and keep using it from start to finish.
- Input and output use the same format, so the reader can compare them directly.
- Reveal one thing per step. `show` puts new data on a station, and `focus` says what is lit; everything else stays in place, dimmed. In 3D, `hide` is only for data replaced on the same station. In 2D, parts ignore `hide`.
- Lay out the map first: stations in the order data visits them, with room for their largest data, roughly 1.5 times as wide as deep. Make it readable as a system before any step runs.
- Files on a station must be ones you checked do that job. They are what a reader lands on when they click the part.
- Name things by what they do first, and give the technical term second.
- Use the real shape and the real sizes. Draw `stack` segments to scale.
- State the surprising finding when the data supports it, with the numbers. Do not claim a pattern you did not measure.

## Build and check

```bash
python3 scripts/build_lesson.py LESSON_DIR --repo CLONE
python3 scripts/check_lesson.py LESSON_DIR/index.html --shots DIR
```

The build fails on: a wrong commit, a changed clone, a code reference whose lines lack `must`, a step without input, transform, output or evidence labels, a flow or focus on an object that is not on stage, a station without real files, data without a station, and a step that lights up nothing. The check plays every step in Chrome and looks for errors, blank stages, parts missing from the map, page scrolling at 1440×860 and 1280×720, zoom that does nothing, parts or files that do not respond to a click, and overflow at phone width. Passing proves the page runs. Look at the screenshots yourself, and do not treat either result as proof that it teaches.

## What a reader can do on the canvas

Scroll or pinch to zoom, drag to move, Shift-drag or the turn button to rotate in 3D. Double-click to fly to a part; the fit button returns to the whole system, and the target button follows each step. A small map appears while zoomed in. Hover a data point for its value. Click a part or data point for its files, steps and current data. Hover a file to light its parts, and click it for its code.
