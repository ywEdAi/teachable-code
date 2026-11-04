# Teachable Code

**English** · [简体中文](README.zh-CN.md)

### Follow one piece of data. See how the code works.

An agent skill that turns a codebase into an interactive lesson. Explore a persistent system map, follow the current step, and inspect the source files and data behind it. Use **3D for tensors and memory**, **2D for applications and tool calls**.

![mini-SGLang lesson showing a persistent 3D system map, source folder, step explanation and input/output panels](assets/readme/mini-sglang-en.png)

*One screen holds the system, the current step, the project folder and the data. Zoom, pan, or click a component to inspect it.*

[Explore the five examples](#five-worked-examples) · [Run the demo](#open-the-demo-in-your-browser) · [Use the skill](#teach-me-a-repository) · [中文示例](docs/zh-CN/index.html)

## Five worked examples

Each lesson opens with a concrete question. Every example has an English and Chinese page. The links below point to the static HTML files; serve `docs/` locally to use them in a browser.

| Repository | Follow the process | View | Lesson files |
| --- | --- | --- | --- |
| **mini-SGLang** | Request → prefix tree → KV memory → attention. Why does the next request need less work? | 3D · 14 steps | [EN](docs/lessons/mini-sglang.html) · [中文](docs/zh-CN/lessons/mini-sglang.html) |
| **nanoGPT** | Characters → vectors → attention → sampling → gradients → updated weights. | 3D · 15 steps | [EN](docs/lessons/nanogpt.html) · [中文](docs/zh-CN/lessons/nanogpt.html) |
| **SWE-agent** | Issue → context → command → sandbox → feedback → patch. | 3D · 13 steps | [EN](docs/lessons/swe-agent.html) · [中文](docs/zh-CN/lessons/swe-agent.html) |
| **DeepTutor** | Question → instructions → textbook retrieval → tool loop → answer. | 2D · 13 steps | [EN](docs/lessons/deeptutor.html) · [中文](docs/zh-CN/lessons/deeptutor.html) |
| **AI chatbot** | Send → request checks → context → weather tool → streamed answer. | 2D · 11 steps | [EN](docs/lessons/ai-chatbot.html) · [中文](docs/zh-CN/lessons/ai-chatbot.html) |

<details>
<summary>See the 2D view in DeepTutor</summary>

![DeepTutor lesson tracing a question through context, retrieval and a tool loop on a persistent 2D map](assets/readme/deeptutor-en.png)

</details>

## Open the demo in your browser

No model key or GPU is needed to explore the included lessons.

```bash
git clone https://github.com/ywEdAi/teachable-code.git
cd teachable-code
python3 -m http.server 8000 --directory docs
```

Open [the English gallery](http://localhost:8000/) or [the Chinese gallery](http://localhost:8000/zh-CN/). Switch languages inside a lesson without losing your step. Fonts and the 3D runtime load from public CDNs, so internet access is required.

The repository contains a static site ready for GitHub Pages. These instructions serve it locally; a hosted Pages deployment is separate.

## Teach me a repository

Give your coding agent [SKILL.md](SKILL.md), a repository URL, and a question you want to answer. For example:

> Use teachable-code to help me understand mini-sglang. Follow two requests with the same opening through the scheduler and KV cache. Keep the whole system visible, show the input and output at each step, and link each component to its source files. Explain it for someone learning LLM serving.

The agent scans the repository, asks questions that affect the lesson, pins a source commit, and builds a page around your goal. Python 3 and Node.js are needed to build lessons. GPU access, keys or extra dependencies depend on the code you choose to execute.

## What you can explore

- **The whole system stays visible.** The active components light up while their relationships remain on the canvas.
- **Compare input and output.** Values, prompts, tool arguments and results sit beside the operation that connects them.
- **Move between behavior and source.** Click a component or a project file to see where it belongs and which steps use it.
- **Understand iteration.** Replay decoding, training updates and agent tool loops. Use “Guess first” to predict selected steps.
- **Follow the evidence.** Code references point to pinned commits. Lessons explain whether values come from source reading, a replay, a simulation or execution.

## Be clear about the evidence

The five lessons demonstrate the teaching format. **They do not reproduce the upstream projects' published results.**

| Example | What the lesson uses |
| --- | --- |
| nanoGPT | Our own small CPU model following the source structure. The upstream code was not run. |
| mini-SGLang | Our own replay of cache rules with illustrative requests. Token counts are not a speed benchmark. |
| SWE-agent | Text from a recorded demonstration committed upstream. No live model was called. |
| DeepTutor and AI chatbot | Prompt text and tool schemas read from source. Conversations and tool results are illustrative. |

Chinese pages translate the interface and explanations. Source code, original prompts and numerical values remain unchanged for comparison. Browser checks verify interaction and layout; learning outcomes have not been evaluated with learners.

## Build and extend

- [Lesson authoring and schema](references/lessons.md)
- [Choose a learner's route](references/interview.md)
- [Paper-to-code evidence](references/paper-to-code.md)
- [Running code and labeling its provenance](references/running-code.md)
- [Earlier multi-repository graph example](examples/four-repos/README.md)

Rebuild the bilingual demo site from the checked-in standalone lessons:

```bash
python3 scripts/build_site.py
python3 -m unittest discover -s scripts -p test_build_site.py
```

To build a lesson against a clean clone at its pinned commit:

```bash
python3 scripts/build_lesson.py examples/lessons/mini-sglang \
  --repo /path/to/mini-sglang --standalone \
  --out examples/lessons/mini-sglang/standalone.html
python3 scripts/build_site.py
```

Browser verification uses Python Playwright and Chrome or Chromium:

```bash
python3 scripts/check_lesson.py docs/lessons/mini-sglang.html
python3 scripts/check_lesson.py docs/zh-CN/lessons/mini-sglang.html
```

Chinese text lives in each lesson's `zh-CN.json`. The site build refuses a translation when the pinned commit or ordered source step titles change.

## Source projects

The worked examples study [mini-sglang](https://github.com/sgl-project/mini-sglang), [nanoGPT](https://github.com/karpathy/nanoGPT), [SWE-agent](https://github.com/SWE-agent/SWE-agent), [DeepTutor](https://github.com/HKUDS/DeepTutor), and [AI chatbot](https://github.com/vercel/ai-chatbot). Source excerpts and recorded material belong to their respective projects. See each lesson for pinned commits and specific limitations.
