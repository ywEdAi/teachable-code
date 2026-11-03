# Interaction mode: ask the right questions, then pick the right diagrams

The interview exists to change what gets built. A question earns its place only if at least one answer would change a build decision: which views, in what order, how deep the concepts go, which data to run, which lens is on by default. If no answer would change anything, drop the question.

## When to ask

| Situation | Do |
|---|---|
| Request already states goal, background and scope ("我想复现 SEAL 的知识整合实验，有一张 A100") | Skip round 1. Ask only what is missing, or nothing. |
| Request names only a repo ("看看这个 repo") | Scan, then round 1 (up to 4 questions). |
| The person is plainly present and the build is large (several repos, a full page) | Round 1, and round 2 if round 1 opened a branch. |
| Unattended (scheduled run, no reply) | Don't ask. Choose defaults from the signals below, say which reading you took in the first line, build key frames. |

Never more than two rounds. Ask after the quick scan, so options name the repo's real concepts and subsystems.

## Round 1 — pick up to four, in this order of value

Skip any question the conversation, memory or request already answers, and promote the next one.

**Q1 Goal** (single choice). Always first unless stated.
- 看懂它怎么工作 — *understanding*
- 复现论文结果 — *reproduction*
- 改一个功能 / 验证一个假设 — *intervention*
- 把它的做法用到别处 — *transfer*

**Q2 Background** (single choice). Decides concept depth and where the route starts.
- 写过类似的训练 / 系统代码
- 懂概念，但没读过这类代码
- 刚接触这个方向
- 做产品 / 教学，不写这类代码

**Q3 Concepts already known** (multi-select). The 4 load-bearing concepts from the scan that a newcomer is most likely to lack, by name (e.g. `LoRA`, `ReST-EM`, `test-time training`, `LLM-as-judge`). Known ones are collapsed in the page and skipped on the concept route. Ask only for understanding or reproduction goals, or when Q1 is unanswered.

**Q4 Scope or time** (single choice). Prefer *scope* when the repo has clear subsystems (`知识任务` / `ARC 任务` / `两个都要` / `只看核心算法`); otherwise *time* (`15 分钟` / `1 小时` / `慢慢读`). Scope cuts graphs; time cuts frames.

## Round 2 — only the branch round 1 opened

| Round-1 answer | Ask | Why it matters |
|---|---|---|
| Intervention | What do you want to change? Options = the 2–3 strongest levers from the scan + "其他（自己写）" | Picks which lever cards and which system graph carry the proposal panel |
| Transfer | Where will you use it? Options = their own project if known from context, another repo, a research question, a product | Fills the transfer target; decides which patterns to foreground |
| Reproduction | What hardware do you have? `没有 GPU` / `一张消费级卡` / `A100 级别` / `云上租` | Decides which runs to plan, what to mark "needs GPU", what to preview on CPU |
| Understanding + "刚接触" | Where to start? `从一个真实例子` / `从整体结构` / `从概念` | Orders the first three frames |
| Several repos named | Read them together or one at a time? | Decides whether to build the pattern view |

## Swapping questions

- **Already answered → skip.** E.g. memory says the person writes ML systems for a living: skip Q2 and use "写过类似代码".
- **Answer would not change the build → drop.** If the repo has only one subsystem, Q4-scope becomes Q4-time.
- **Ambiguous answer → re-ask narrower once**, with options built from what they said.
- **"Other" text → classify it** with the signals below; if it is still unclear, take the closest goal and say so.

## Classifying: understanding vs reproduction vs intervention vs transfer

| Signal in the request | Primary |
|---|---|
| 看懂, 理解, 怎么工作, 架构, 流程, explain, walkthrough, "我是新手" | Understanding |
| 复现, reproduce, 跑通, 结果对不上, 环境, GPU, 训练多久 | Reproduction |
| 改, 加一个功能, 如果把…换成…, 假设, ablation, feature request, bug | Intervention |
| 用到, 借鉴, 迁移, 启发, 和 X 结合, 新论文的想法, transfer | Transfer |

Mixed requests are normal. Choose a primary (it orders the route) and a secondary (it adds one or two frames). Tell the user in one line: "我按 **理解为主、干预为辅** 来做：先看全局和数据流，最后放一个改动预演。"

## How answers change the build

| Decision | Understanding | Reproduction | Intervention | Transfer |
|---|---|---|---|---|
| First frame | global map | workflow with reproduction lens | paper→code | global map |
| Knowledge layer | on; depth by background | on for unknown concepts | off by default | off |
| Prediction mode | on | off | off | off |
| Runs to prioritize | the main data path, end to end | anything that reproduces a reported number | real outputs where a lever changes something | outputs that make two repos comparable |
| Paper→code | statuses shown | deviations emphasized, each with its consequence | red/yellow edges link to lever cards | optional |
| Live generation | none | none | feature request (sample) | experiment cards (sample) |
| Concept depth | "刚接触": definition, formula, worked mini-visual, misconception. "写过代码": one line + where it is in the code |

Background also sets wording: for "做产品 / 教学", lead each node with what it does for the user of the system before how it works.

## Example interviews

**A. Newcomer, understanding.** Request: "我想看懂 SEAL 这个仓库在做什么。" Scan finds nested loops, 10 concepts, two subsystems.
Round 1: Q1 (preset to understanding, so skipped) → Q2 background → Q3 concepts {LoRA, ReST-EM, test-time training, LLM-as-judge} → Q4 scope {知识任务, ARC, 两个都要, 只看核心算法}.
Answers: 懂概念没读过代码; knows LoRA; 知识任务. Build: global map → SEAL workflow (knowledge task only) → knowledge layer with LoRA collapsed → directory → paper→code. Prediction on.

**B. Researcher, intervention.** Request: "SEAL 的 reward 好像很吵，我想试试改 E-step。" Goal and lever are clear.
Round 1: one question only — hardware. Answer: 没有 GPU. Build: paper→code (the Eq. 2 deviation) → lever previews on the committed results (threshold, tie-break, noise) → a GPU-needed card with the exact diff. No knowledge layer.

**C. Product builder, transfer.** Request: "这几个仓库对我做 AI 辅导产品有什么启发？" Several repos.
Round 1: Q2 background (做产品) and round 2 transfer target (their product, from context). Build: global map → patterns → experiment cards for the target, live generation enabled → one intervention frame to show what "changing the code" would look like.

## In the page itself

The page asks the same core questions on first open (goal → known concepts / change / target → time) and builds a personal route from `ROUTES`. The interview answers become `PAGE.defaultProfile`, so the requester skips the onboarding while other viewers still get it. The profile chip in the header reopens it.
