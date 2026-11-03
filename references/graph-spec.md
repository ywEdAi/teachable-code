# Graph spec

Graph files are plain JavaScript loaded in name order. They call `def({...})` and may compute nodes from `RUN` (the JSON runs listed in `runs.json`). Globals available: `GH`, `RUN`, `SRC`, `GRAPHS`, `def`, `escD`, `PREVIEWS`, `MINIS`, `VIEWS`, and the page config objects `PAGE`, `PROFILE`, `FRAMES`, `ROUTES`.

## A graph

```js
def({
  id: "seal",                 // unique; "a.b" ids are conventions for drill-downs, nothing more
  repo: "seal",               // key in repos.json (code links and snippets resolve against it)
  title: "SEAL", kindLabel: "系统图 · 嵌套循环",
  info: { role: "what this graph shows, 1–3 sentences", repro: { why, need, limit, next } },
  layout: { dir: "LR" },      // optional; auto-layout direction when nodes have no x/y
  groups: [ { id: "inner", label: "内层 · …", kind: "dash" } ],   // or with x,y,w,h for hand layout
  nodes: [ … ], edges: [ … ], scenarios: [ … ],
  intervene: { … },           // optional: proposal panel (see interventions.md)
  transfer: { … },            // optional: transfer panel (see transfer.md)
  world: { w, h }             // optional; computed when omitted
});
```

Group kinds: `outer` (blue frame), `dash` (inner loop / optional), `sub` (a sub-process), `concept` (knowledge layer band). Put `layer: "concept"` on a group to hide it with the knowledge layer.

## Nodes

```js
{ id: "select", label: "E-step 取第一名", sub: "build_SFT_dataset",   // label ≤ ~14 CJK chars; sub ≤ ~24
  kind: "process",            // see table
  group: "outer",             // for auto-layout; omit when you give x/y
  x: 1110, y: 700, w: 220,    // optional
  role: "one or two sentences: what it does and why",
  io: ["input shape", "output shape"],
  code: { f: "path/in/repo.py", a: 20, b: 30 },          // or { nb, cell, from?, until?, maxChars? } for notebooks
  files: [ { p: "path", a: 20, what: "_top_k" } ],        // file links in the inspector
  run: "ran" | "synth" | "gpu",                            // badge
  dep: "ran" | "local" | "ai" | "infra",                   // reproduction-lens color
  repro: { why, need, limit, next },                       // "!" marker when limit is set
  aiio: { input: REF, output: REF, parsed: REF },          // AI call I/O; REF = {f,a,b,prov,note} or {text,prov,note}
  drill: "seal.seqs",                                      // double-click to enter that graph
  jump: { g: "maic.turn", n: "director", label: "…" },     // button to another graph/node
  preview: "name", maps: [ … ], experiment: { hyp, minimal, metric, cost, risk },
  layer: "concept"                                         // only for knowledge-layer nodes
}
```

`prov` values: `data` (repo's committed real outputs), `run` (ran here), `test` (repo test mock), `eval` (eval fixture written by humans), `example` (example inside a prompt template), `template` (prompt text), `code`.

| kind | Looks like | Use for |
|---|---|---|
| `process` | white box | a function, script or step |
| `data` | teal, folded corner | files, tensors, records |
| `model` | lavender with a bar | training / a model forward |
| `ai` | orange with ✦ LLM | one LLM call (give it `aiio`) |
| `agent` | rounded, colored dot | an agent role in a multi-agent system |
| `store` | grey | databases, checkpoints |
| `external` | dashed amber | services, users, providers |
| `gate` | dashed outline | a human confirmation step |
| `stage` / `repo` | blue | global-map tiers and repo tiles (`lines:[…]` for multi-line) |
| `portal` | dashed blue | a link to a sibling scenario |
| `concept` | purple ◆ | knowledge layer (see concepts.md) |
| `paper` | parchment | paper claims (see paper-to-code.md) |
| `pattern` / `question` | dark / dashed | transfer view |
| `proposed` | dashed magenta | added by a feature request at runtime |

## Edges

```js
{ from: "a", to: "b", label: "short payload", id?: "x1", kind?: "data",
  via?: [x, y], bend?: 30, lt?: 0.4 }      // curve control point, or perpendicular bend; label position 0..1
```

Edge kinds: `data` (default solid), `control` (dashed), `loop` (blue, back to an earlier step), `infer` (green dashed shortcut), `spec` (dotted, speculative), `concept` / `prereq` (purple), `match` / `approx` / `diverge` / `nocompare` (paper→code), `proposed`.
The edge id is `from>to` unless you set `id`. Scenarios refer to edges by that id.

## Scenarios

```js
{ name: "胡编 · 年份", intro: "caption before playing",
  skip: ["nodeId"], skipEdges: ["edgeId"],          // dimmed for this scenario
  steps: [
    { e: "a>b", p: "packet label", c: "caption for this step" },
    { n: "node", p: "tag under the node", c: "…" },   // highlight a node without moving data
    { par: [ {e, p}, {e, p} ], c: "…" }               // simultaneous moves
  ] }
```

Steps are what the learner predicts in prediction mode: a step with a single `e` asks "where does the data go next?". Keep captions to one sentence; put numbers in the packet label.

## Custom views

For algorithms that a node-and-edge graph cannot show (clustering, a radix tree, a timeline, a scatter of real results), give the graph `custom(ctx)` instead of nodes. It returns a player:

```js
custom(ctx) {   // ctx: { g, el, pill, sleep, caption, speed, reduced, inspect, visit, jump }
  return { names: ["scenario"], select(i){}, reset(){}, done(){ return true }, async step(){ return false } };
}
```

Draw into `ctx.g` with `ctx.el(tag, attrs, parent, text)`. Use theme tokens (`var(--ink)`, `var(--c0)` …), never literal colors. `VIEWS.directory(opts)` is the reusable one; see `assets/views/directory.js`.

## Page config (`graphs/90_page.js`)

```js
PAGE = { id: "seal-v1", title: "SEAL Lens", h1: "SEAL", defaultProfile: { goal: "understand", known: ["c_lora"], time: "60" } };
PROFILE = { goals: [ { id: "understand", label, sub, predict: true, repro: false }, … ],
            times: [ { id: "15", label: "15 分钟" }, { id: "60", … }, { id: "deep", … } ],
            changePlaceholder, targetPlaceholder };
FRAMES = [ { id: "seal_flow", name: "SEAL · 一轮迭代", g: "seal", scenario: 1, layers: { concept: false }, repro?, select?, intervene? }, … ];
ROUTES = { understand: ["meta", "seal_flow", …], reproduce: […], intervene: […], transfer: […] };
```

Time `15` keeps the first 3 frames of a route, `60` the first 5, `deep` all of them. Frames not on the route stay under "其他".
