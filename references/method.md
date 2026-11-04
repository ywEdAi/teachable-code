# Method

## Why graphs, and why moving ones

A codebase hides three things a reader needs: **order** (what happens first), **data** (what passes between parts and how it changes), and **reasons** (which idea each part implements). Static architecture diagrams show boxes and arrows but not order or data. Prose shows reasons but not structure. Teachable Code puts all three on one canvas: nodes are code, edges are data, scenarios move a labeled packet along the edges in the order a real request or training step does, and concept nodes sit on the same canvas, linked to the code that uses them.

## Shapes: decide what kind of thing the repo is

Look at entry points, loops and process boundaries. The shape picks the primary diagram.

| Shape | Signals | Primary diagram | Example |
|---|---|---|---|
| **Pipeline** | scripts run in order, each writes files the next reads | columns = scripts/stages, edges = files and tensors | Semantic Entropy Probes |
| **Request lifecycle** | server, queues, processes, a request object | swimlanes = processes, a packet = one request | mini-sglang |
| **Nested loops** | an outer optimization around an inner one | outer frame around a dashed inner frame, loop edge back to the start | SEAL (ReST-EM around LoRA test-time training) |
| **Multi-agent / LLM app** | prompts, tool calls, a router or director | system graph with ✦ LLM nodes; one zoom-in per AI call with its input → raw output → parsed result | OpenMAIC |
| **Library** | no main loop; many small public functions | directory view + one workflow per main use case | — |

A repo may combine shapes (OpenMAIC has a pipeline for course generation and a multi-agent loop for the classroom). Draw each as its own graph and connect them in the system view.

## The views

| View | Answers | Built with |
|---|---|---|
| Global map | Where does this sit, and how does it relate to the other repos? | generic graph, `kind:"repo"` nodes that drill down |
| System / workflow | What runs, in what order, on what data? | generic graph + scenarios |
| Zoom-in | What happens inside this one step? | a drill graph, or a custom view for algorithms (clustering, a tree, a timeline) |
| Knowledge layer | Which ideas do I need, and where are they used? | concept nodes in the same graph, `layer:"concept"` |
| Directory | Which files implement which step, and what can I skip? | `VIEWS.directory` |
| Paper → code | Does the code do what the paper says? | `kind:"paper"` nodes, edges with `match/approx/diverge/nocompare` |
| Lever previews | What changes if I change this? | custom view on real data + intervention cards |
| Feature request | What would it take to add X? | `intervene` on a system graph (live generation + example) |
| Patterns | What recurs across repos, and what could transfer? | pattern rows, question nodes with experiments, `transfer` panel |

## Lenses (toggles on the same canvas)

- **Knowledge layer**: concept nodes and their purple edges. Edges stay faint until you select a concept or the code it touches.
- **Reproduction lens**: colors every node by what reproducing it needs (ran here / pure logic / needs an LLM / needs infrastructure) and marks known limitations with "!".
- **Prediction mode**: before each data move, the learner clicks where they think the packet goes next; the page shows right/wrong and keeps a score.

## Principles

1. **Show, not tell.** Text in the side panel explains what the canvas already shows. If you write "first X, then Y", make it a scenario instead.
2. **Global first, then zoom.** Open on the whole. Detail lives one double-click down, and the breadcrumb always shows where you are.
3. **Every claim is traceable.** Source lines come from the pinned commit at build time. Each data sample names its provenance. Paper claims are quoted or paraphrased with the section.
4. **Real data beats illustration.** Prefer a committed result, then a local run of the repo's own function, then a test mock. Synthetic inputs are labeled synthetic wherever they appear.
5. **Find the gaps.** The most valuable things on a page are where code and paper diverge, where code silently repairs model output, and where real data surprises (ties, noise, degenerate outputs). These become levers.
6. **The reader's own path** (from *Creative Reading: Scaffolding Reading for Transformation*, Liu et al., HT '26). Scaffold the reading, do not substitute for it: the learner chooses where to zoom, leaves visited marks and questions on nodes, predicts before watching, and exports their trail.
7. **Learning-science defaults.** Prediction before reveal (retrieval practice), worked examples with real data, prerequisite-ordered concepts, cutting cognitive load by collapsing what the learner already knows.

## Scope and honesty

Say explicitly, on the page and in the reply:
- what ran here, what is a stand-in (a toy judge, a stubbed dependency), and what could not run (GPU, keys, services);
- when two numbers are not comparable (different model size, different split);
- that cross-repo patterns are the author's synthesis, not something the code states.
