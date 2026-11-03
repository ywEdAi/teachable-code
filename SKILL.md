---
name: code-anatomy
description: Turn a research codebase (an ML paper repo, an LLM serving system, a multi-agent app) into one interactive page of animated graphs for learning it — system, workflow, directory, knowledge, paper→code, intervention and transfer views — after asking the learner about their goal and prior knowledge. Use when someone wants to understand, reproduce, modify or borrow from a GitHub repo, or says "visualize this repo / 帮我看懂这个代码库 / 复现这篇论文的代码 / 画出它的工作流".
---

# Code Anatomy

Code Anatomy makes the hidden *process* of a codebase visible: what runs, in what order, on what data, built on which ideas, and where you could change it. The output is one self-contained HTML page (published as an Artifact when the session can) whose canvas carries the meaning; text sits in a side panel and appears on demand.

Read `references/method.md` once before your first build. The other references are opened when the step below names them.

## The four capabilities

Every page serves one primary capability, sometimes with a second. They decide what you draw first and how deep you go.

| Capability | The learner wants to… | Lead views | Default page settings |
|---|---|---|---|
| **Understanding** | know how it works and why | global map → workflow → knowledge layer → directory → paper→code | knowledge layer on, prediction mode on |
| **Reproduction** | get the paper's numbers out of the code | workflow with reproduction lens → directory → paper→code (deviations) → what runs where | reproduction lens on |
| **Intervention** | change a part or test a hypothesis | paper→code (red/yellow edges) → lever previews on real data → feature request | proposal panel on the system graph |
| **Transfer / discovery** | reuse its ideas elsewhere | cross-repo patterns → transfer questions → experiment cards | transfer panel on the patterns graph |

Understanding is the floor: intervention and transfer pages still include a compact global map and workflow, because nobody can change what they cannot see.

## Workflow

### 1. Quick scan (before asking anything)

Spend a few minutes so the questions you ask are concrete.

```bash
git clone --depth 1 <repo> /work/<name> && git -C /work/<name> rev-parse HEAD     # pin the commit
python3 -I scripts/inventory.py /work/<name> --out /work/<name>.inv.json --summary
```

From the summary, the README and the entry points, note:
- the **shape** (pipeline, request lifecycle, nested loops, multi-agent system, library — see `references/method.md`),
- 8–15 **load-bearing concepts** a newcomer must know (LoRA, ReST-EM, KV cache, …),
- the main **subsystems** (e.g. SEAL: knowledge task vs ARC task),
- what can **run on CPU** here and what needs GPUs, keys or services,
- whether the repo or paper ships **real outputs** (results folders, eval fixtures) — these become the best evidence.

### 2. Interaction mode: ask, then decide

Ask before building unless the request already answers everything below or the session is unattended. Follow `references/interview.md`: it has the question bank, the rules for swapping questions, and how each answer changes the build.

- Use `AskUserQuestion` (2–4 options per question, the recommended option first). Round 1 is one call with up to 4 questions; round 2 is optional and only asks what round 1 made necessary.
- Options must come from the scan: name the repo's real concepts, subsystems and levers, never generic placeholders.
- Never ask what the request, the conversation or memory already answers; swap in the next most informative question. Every question must change at least one build decision — if no answer would change what you draw, do not ask it.
- Classify the request as understanding, reproduction, intervention or transfer (primary + optional secondary) using the signals in `references/interview.md`, and tell the user in one line which you chose and why.
- Unattended or no answer: pick the most reasonable reading, state it at the top of your reply, and build.

Record the answers as the page's `PAGE.defaultProfile` so the person who asked lands on their route, while anyone else who opens the page is asked the same questions in the page's own onboarding.

### 3. Evidence: run what can run

Before drawing, gather the data the graphs will animate. Priority: real outputs the repo committed > running the repo's own functions locally > the repo's tests/mocks > template examples. Never invent model outputs. See `references/running-code.md` (CPU stubs for Python, `scripts/ts_loader` for TypeScript, provenance labels).

Save every result as JSON in `runs/` and list it in `runs.json`.

### 4. Build the page

Create a page folder:

```
<page>/repos.json          {"seal": {"name": "SEAL", "root": "/work/SEAL", "url": "https://github.com/o/r/blob/<sha>/"}}
<page>/runs.json           {"seal.estep": "runs/estep.json", ...}   -> RUN.seal.estep in the page
<page>/runs/*.json
<page>/graphs/10_system.js     def({...}) — one file per area; loaded in name order
<page>/graphs/90_page.js       PAGE, PROFILE, FRAMES, ROUTES
```

Write graphs with the spec in `references/graph-spec.md`. Omit `x`/`y` and the engine lays nodes out (groups side by side, layered inside); give coordinates only where a hand layout reads better. Per view type, follow:
- knowledge layer → `references/concepts.md`
- paper → code → `references/paper-to-code.md`
- levers, previews, feature requests → `references/interventions.md`
- cross-repo patterns and experiment cards → `references/transfer.md`

**First pass = key frames.** Build 3–5 frames along the learner's route, publish, and ask for feedback before building the rest. Big visual builds are cheaper to steer early.

### 5. Verify, then publish

```bash
python3 scripts/build.py <page> --out <page>/index.html       # checks every file:line and every edge/step id
python3 -I scripts/check.py <page>/index.html --shots <page>/shots   # plays every scenario, screenshots every frame
```

`build.py` fails if a code reference points at a missing file or line range, or a scenario names a missing edge. `check.py` fails on page errors or horizontal overflow at phone width. Look at the frame screenshots once; fix overlaps you can see.

Publish with the Artifact tool. If the page includes live feature-request or transfer generation, declare `capabilities: {"sample": {}}`; the page falls back to the built-in example when a viewer has not allowed it.

### 6. Deliver

One short paragraph: what the page shows, the route you chose and why, the 2–3 most important findings (things the code does that the paper does not say, real-data surprises), and what you could not run. Then ask which frame to deepen next.

## Quality bar

- **Show, not tell.** If a sentence describes movement, order or a branch, it should be an animation, an edge or a scenario instead.
- **Global first, then zoom.** Every page opens on something that shows the whole; detail lives one double-click down.
- **Every claim is traceable.** Code shown in the page is pulled from the pinned commit by line number at build time. Numbers name their source: ran here / committed results / test mock / template example / synthetic.
- **The learner's own path.** Visited marks, pinned questions and prediction results stay on the page and export as JSON for the next iteration.
- **Honest scope.** Say what is synthetic, what is a stand-in, what you could not run, and where the paper and the code disagree.

## Files

| Path | What it is |
|---|---|
| `assets/engine.js`, `assets/shell.html`, `assets/prelude.js` | The page runtime (canvas, zoom, scenarios, inspector, onboarding, prediction, proposals, transfer) |
| `assets/views/directory.js` | Reusable directory ↔ workflow view (`VIEWS.directory`) |
| `scripts/inventory.py` | File list with line counts, definitions and shape signals |
| `scripts/build.py` | Validates references and ids, injects source lines, writes one HTML file |
| `scripts/check.py` | Headless run of every scenario and frame, dark mode and phone-width checks |
| `scripts/pyrun.py`, `scripts/ts_loader/` | Run a repo's own Python / TypeScript functions without its heavy dependencies |
| `references/*.md` | Method, interview, graph spec, concepts, paper→code, interventions, transfer, running code |
| `examples/four-repos/` | Complete worked example: SEP, mini-sglang, SEAL, OpenMAIC (24 graphs, 13 frames) |
