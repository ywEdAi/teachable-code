/* SWE-agent: how a harness turns a model into something that fixes a bug. Data: runs/traj.json, measured from a recording committed in the repo (see measure.py). */
const TJ = RUN.traj, M = TJ.msgs, G = TJ.growth, AG = "sweagent/agent/agents.py", HP = "sweagent/agent/history_processors.py", C7 = "config/sweagent_0_7/07.yaml";
const total = TJ.chars.reduce((a, b) => a + b, 0), kind = m => m.type === "system_prompt" ? "--tf" : m.role === "user" ? "--accent" : m.type === "action" ? "--out" : "--in";
const LAB = { 0: "System prompt", 1: "The bug report", 13: "File view: 100 lines", 15: "Rejected edit", 17: "File view after the fix" };
const WHO = m => m.type === "system_prompt" ? "System prompt" : m.type === "action" ? "Model: " + (m.tool || "command") : m.role === "user" ? "Task" : "Computer";
const layers = M.map((m, i) => ({ chars: m.chars, color: kind(m), label: LAB[i], who: WHO(m), text: (m.text || (m.action || "")).slice(0, 2500) }));
const obs = M.map((m, i) => m.type === "observation" ? i : -1).filter(i => i >= 0), omit = obs.slice(1, obs.length - 5), sizes = {}; omit.forEach(i => sizes[i] = `Old environment output: (${M[i].lines} lines omitted)`.length);
const last = G[G.length - 1], fin = { full: total, short: M.reduce((a, m, i) => a + (sizes[i] ?? m.chars), 0) };
const act = i => M[i].action.trim(), firstLine = s => s.split("\n")[0];
const short = (s, n) => s.length > n ? s.slice(0, n) + " …" : s;
const seg = (label, i, n, color) => ({ type: "segments", prov: "read", label, items: [{ label: M[i].type === "action" ? "Model: " + M[i].tool : M[i].type === "system_prompt" ? "System prompt" : M[i].role === "user" ? "Task" : "Computer", size: M[i].chars.toLocaleString("en") + " chars", color: color || `var(${kind(M[i])})`, text: short(M[i].text || act(i), n || 500) }] });
const cmd = (label, i) => ({ label, text: short(act(i), 500), prov: "read" });
const tw = (upto, glow) => ({ tower: { upto, ...(glow ? { glow } : {}) } });
const turns = M.map((m, i) => m.type === "action" ? i : -1).filter(i => i >= 0);

LESSON = {
  id: "swe-agent", title: "SWE-agent Harness", question: "What turns a language model into something that can fix a real bug?",
  kind: "llm_call", repo: { name: "SWE-agent/SWE-agent", url: "https://github.com/SWE-agent/SWE-agent", commit: "3ea751c087f32b16e039a2233dd6eefecef325d5" },
  limits: [
    `The conversation, commands and outputs are real text from a recording committed to the repo (${TJ.path.split("/").slice(-2, -1)[0]}). It is a replayed demonstration: the file records 0 tokens used, so no live model wrote it during that run. We did not run SWE-agent or call a model.`,
    "The recording uses the older interface from the paper era. The repo's current default config uses a shorter system prompt, different edit tools and no trimming of old output.",
    "Character counts stand in for tokens. The trimmed size is our own calculation using the repo's rule. The 12.5% and 87.7% figures are the authors' own results from arXiv 2405.15793, which we did not reproduce."
  ],
  folders: {
    "sweagent/agent": "The harness loop: asks the model, runs its command, records the result.",
    "sweagent/environment": "The sandbox computer the commands run in.",
    "sweagent/tools": "Reads the model's reply and turns it into a command.",
    "tools": "The commands the model can use, such as open, search and edit.",
    "config": "Ready-made settings: prompts, tools and limits.",
    "trajectories": "Recorded runs, used as worked examples.",
    "tests": "Checks for the code.", "docs": "The project's guides."
  },
  stage: {
    mode: "3d",
    legend: [["system", "--tf"], ["task", "--accent"], ["model's move", "--out"], ["computer's reply", "--in"]],
    stations: {
      bug: { label: "The task", box: [-21, -14, 16, 9], files: [TJ.path], note: "A real bug report, recorded in this repo's demonstration." },
      ctx: { label: "Context: what the model reads", box: [3, -.5, 24, 19], files: [AG, HP, C7], note: "Every message so far, stacked to scale. It is the only thing the model can see." },
      model: { label: "The model", box: [-21, 3, 14, 12], files: [AG, "sweagent/agent/models.py"], note: "Reads the whole stack and replies with one command. It never touches the computer." },
      comp: { label: "Sandbox computer", box: [27, 3, 16, 12], files: [AG, "sweagent/environment/swe_env.py"], note: "A real computer that the harness runs each command on." },
      tools: { label: "Commands it can use", box: [27, 16, 22, 9], files: [C7, "tools/windowed_edit_linting/bin/edit"], note: "Tools built for a model, such as a 100-line file viewer and an edit command that refuses broken code." },
      fixed: { label: "The result", box: [27, -9.5, 16, 8], files: [TJ.path], note: "The same test, run again after the fix." }
    },
    wires: [["bug", "ctx"], ["tools", "comp"]],
    objects: {
      tower: { at: "ctx", type: "tower", pos: [-3, 0, 3.5], layers, scale: 15 / total, w: 7, d: 7 },
      model: { at: "model", type: "box", pos: [-21, 2.5, 3.5], size: [7, 5, 6], color: "--tf" },
      comp: { at: "comp", type: "box", pos: [27, 2.5, 3.5], size: [8, 5, 6], color: "--in" },
      tools: { at: "tools", type: "tiles", pos: [27, 0, 16.5], items: ["open", "goto", "find_file", "edit", "submit"] },
      bug: { at: "bug", type: "tiles", pos: [-21, 0, -13.5], items: ["want", "345", "got", "344"], tones: [null, "--in", null, "--out"] },
      fixed: { at: "fixed", type: "tiles", pos: [27, 0, -9.2], items: ["now", "345"], tones: [null, "--in"] }
    }
  },
  steps: [
    { chapter: "The job", title: "It starts with a bug report", cap: "A real issue: a duration is rounded the wrong way, giving 344 instead of 345.", show: ["bug"], focus: ["bug"], set: tw(0),
      plain: "A person files a bug in marshmallow, a Python library. Convert 345 milliseconds to a number and you get 344. SWE-agent's job is to fix that with no help, in a copy of the real project.",
      why: "A model alone can't do this: it can't see the code or run anything. Everything that lets it try is called the <b>harness</b>.",
      input: { label: "From the issue", text: short(M[1].text.slice(M[1].text.indexOf("ISSUE:") + 7), 520), prov: "read" }, transform: { label: "Fill in the template", text: "<code>add_instance_template_to_history</code> puts the issue into a standard message." }, output: { label: "What it has to fix", text: "Expected: 345\nActual: 344", prov: "read" },
      log: ["issue", "harness", "bug report", "1 issue"], code: { f: AG, a: 748, b: 760, must: "instance_template" } },
    { chapter: "The job", title: "The rules go in first", cap: "A tower of text, drawn to scale. This is all the model will ever know.", show: ["tower"], focus: ["tower"], set: tw(1),
      plain: `The first layer is the <b>system prompt</b>: ${M[0].chars.toLocaleString("en")} characters explaining the special file viewer and every command. This tower is the <b>context</b>, the only thing the model can see. Each layer's height is its real size.`,
      input: { label: "Settings file", text: "system_template, plus the list of commands", prov: "read" }, transform: { label: "Write the first layer", text: "<code>add_system_message_to_history</code>" }, output: seg("Layer 1", 0, 620),
      log: ["config", "context", "system prompt", `${M[0].chars} chars`], code: { f: C7, a: 4, b: 12, must: "special interface" } },
    { chapter: "The job", title: "Then the task", cap: "Layer 2. The bug report, plus advice on how to work.", focus: ["tower"], set: tw(2, [1]),
      plain: `The next layer holds the bug report and working advice, such as “reproduce the bug first”. It's ${M[1].chars.toLocaleString("en")} characters. The model hasn't done anything yet, and it has already been handed about 5,300 characters.`,
      input: { label: "The issue", text: short(M[1].text.slice(M[1].text.indexOf("ISSUE:") + 7), 220), prov: "read" }, transform: { label: "Add to the context", text: "A new message is added. Nothing is ever replaced at this point." }, output: seg("Layer 2", 1, 620),
      log: ["harness", "context", "task", `${M[1].chars} chars`], code: { f: AG, a: 748, b: 760, must: "instance_template" } },

    { chapter: "One turn of the loop", title: "The model reads everything and picks one command", cap: "Each turn sends the whole tower. The model replies with one command.", show: ["model"], focus: ["tower", "model"], flow: [{ from: "tower", to: "model", label: "all context" }], set: tw(3, [2]),
      plain: "Now the loop begins. The harness sends the whole tower to the model. The model replies with its reasoning and <b>one command</b>. Here it decides to reproduce the bug first, as the advice said.",
      ask: { q: "What does the model send back?", options: ["The fixed code", "One command to run", "A list of every step"], answer: 1, explain: "It works in small moves, and sees the result before choosing the next." },
      input: { label: "Sent to the model", text: `${G[0].full.toLocaleString("en")} characters: system prompt and task`, prov: "read" }, transform: { label: "Ask the model", text: "<code>self.model.query(history)</code>\n\nThe reply is split into a thought and a command." }, output: { type: "pair", prov: "read", items: [{ label: "Thought", text: short(M[2].thought || "", 240) }, { label: "Command", text: act(2) }] },
      log: ["context", "model", "all messages", `${G[0].full} chars`], code: { f: AG, a: 1006, b: 1028, must: "step.query" } },
    { chapter: "One turn of the loop", title: "The harness runs it on a real computer", cap: "The model never touches the computer. The harness does it.", show: ["comp", "tools"], focus: ["model", "comp", "tools"], flow: [{ from: "model", to: "comp", label: "create reproduce.py", kind: "tool" }], set: tw(3),
      plain: "The model only writes text. The harness reads the command and runs it in a <b>sandbox</b>, a throwaway computer holding a copy of the project. Whatever the screen shows gets captured.",
      input: cmd("Command", 2), transform: { label: "Run it in the sandbox", text: "<code>self._env.communicate(input=run_action, ...)</code>" }, output: { label: "What came back", text: M[3].text, prov: "read" },
      log: ["model", "sandbox", "command", `${act(2).length} chars`], code: { f: AG, a: 958, b: 966, must: "communicate" } },
    { chapter: "One turn of the loop", title: "The result becomes a new layer", cap: "Turn over. The tower is taller, and the loop goes again.", focus: ["tower", "comp"], flow: [{ from: "comp", to: "tower", label: "what came back", kind: "loop" }], set: tw(4, [3]),
      plain: "The output is added on top of the tower, and the turn is done. That's the whole trick: ask, run, record, repeat. The model has no memory of its own, so it remembers only because the tower keeps growing.",
      why: "Agent memory here is just a growing document.",
      input: { label: "Sandbox output", text: M[3].text, prov: "read" }, transform: { label: "Add both to the context", text: "<code>add_step_to_history(step)</code>\n\nFirst the model's command, then the output." }, output: { type: "bars", label: "Characters in the context", items: [["before", G[0].full], ["after", G[1].full]], prov: "read" },
      log: ["sandbox", "context", "output", `${M[3].chars} chars`], code: { f: AG, a: 714, b: 730, must: "message_type" } },

    { chapter: "Tools built for a model", title: "A viewer that shows 100 lines at a time", cap: "The file has 1,997 lines. The model gets a window of 100.", focus: ["tower", "comp", "tools"], flow: [{ from: "tools", to: "comp", label: "open fields.py", kind: "tool" }], set: tw(14, [13]),
      plain: "This is the paper's main idea: design the commands for how a model works, not for a person. Dumping a 1,997-line file would flood the tower. So <b>open</b> shows a window of 100 lines and says how much is hidden.",
      why: "The authors call this the agent-computer interface. They report that it significantly improves how well the agent creates and edits code.",
      facts: [["Paper", "arXiv 2405.15793"], ["Window", "100 lines"], ["File size", "1,997 lines"]],
      input: cmd("Command", 12), transform: { label: "Show only a window", text: "The setting <code>WINDOW: 100</code> controls the size." }, output: seg("Output", 13, 700),
      log: ["model", "sandbox", "open", `${M[13].chars} chars back`], code: { f: C7, a: 88, b: 90, must: "WINDOW" } },
    { chapter: "Tools built for a model", title: "A bad edit is refused", cap: "The tallest layer yet is a rejection. The file itself was not changed.", focus: ["tower", "comp"], flow: [{ from: "comp", to: "tower", label: "edit refused", kind: "grad" }], set: tw(16, [15]),
      plain: `The model's first fix has wrong indentation. A person's editor would save it anyway. This edit command checks the code first, refuses it and explains why. That reply is the largest layer at ${M[15].chars.toLocaleString("en")} characters, and the file stays unbroken.`,
      why: "A mistake costs one turn, not a broken project.",
      input: cmd("The first attempt", 14), transform: { label: "Check before saving", text: "Run a code checker (flake8) on the edited file. If there are new errors, undo the edit and report them." }, output: seg("The reply", 15, 620, "var(--bad)"),
      log: ["sandbox", "context", "refusal", `${M[15].chars} chars`], code: { f: "tools/windowed_edit_linting/bin/edit", a: 101, b: 115, must: "new_flake8_output" } },
    { chapter: "Tools built for a model", title: "It reads the error and fixes the indentation", cap: "The same line, correctly indented.", focus: ["tower"], set: tw(18, [16, 17]),
      plain: "Next turn, the model reads the refusal in the tower and tries again with the same change, correctly indented. This time the edit is saved. Nobody stepped in: the error message did the teaching.",
      input: cmd("The second attempt", 16), transform: { label: "Check, then save", text: "No new errors, so the edit stays." }, output: seg("The reply", 17, 500),
      log: ["model", "sandbox", "edit", "1 line"], code: { f: "tools/windowed_edit_linting/bin/edit", a: 101, b: 115, must: "new_flake8_output" } },
    { chapter: "Tools built for a model", title: "It checks its own work", cap: "Same test as turn 3. A different answer.", show: ["fixed"], focus: ["comp", "fixed", "bug"], flow: [{ from: "comp", to: "fixed", label: "345", kind: "loop" }], set: tw(20, [19]),
      plain: "The model runs its test again. Before, it printed 344. Now it prints 345. No one told it the fix worked; it saw the number on the screen.",
      why: "Input and output now match what the report asked for.",
      input: { label: "Test, before the fix", text: M[7].text, prov: "read" }, transform: { label: "Same command, turn 9", text: "<code>python reproduce.py</code>" }, output: { label: "Test, after the fix", text: M[19].text, prov: "read" },
      log: ["sandbox", "context", "test output", "345"], code: { f: AG, a: 958, b: 966, must: "communicate" } },

    { chapter: "The whole run", title: "All eleven turns", cap: "Press play to replay it.", focus: ["tower", "model", "comp"], flow: [{ from: "tower", to: "model", label: "ask" }, { from: "model", to: "comp", label: "run", kind: "tool" }, { from: "comp", to: "tower", label: "record", kind: "loop" }], set: tw(24), dwell: 18000,
      play: { ms: 1250, frames: turns.map((i, k) => ({ set: { tower: { upto: i + 2 } }, cap: `Turn ${k + 1} of ${turns.length}: ${short(firstLine(act(i)), 54)}` })) },
      plain: `Here is the entire run, turn by turn. By the last turn the model is reading ${last.full.toLocaleString("en")} characters to choose one word: <b>submit</b>. Notice how uneven it is. Most turns add a little, while a few big outputs add most of the height.`,
      input: { type: "bars", label: "Characters sent per turn, first 6", items: G.slice(0, 6).map(g => [`turn ${g.turn}`, g.full]), prov: "read" }, transform: { label: "The loop", text: "<code>while not done: step()</code>\n\nAsk, run, record." }, output: { type: "bars", label: "Characters sent per turn, last 5", items: G.slice(-5).map(g => [`turn ${g.turn}`, g.full]), prov: "read" },
      log: ["all", "all", "11 turns", `${total} chars`], code: { f: AG, a: 1250, b: 1258, must: "forward_with_handling" } },
    { chapter: "The whole run", title: "Old output can be cut down", cap: "The older settings keep only the last 5 outputs in full.", focus: ["tower"], set: { tower: { upto: 24, sizes } },
      plain: `Towers can outgrow what a model can read. The paper's settings replace all but the last five outputs with one line, such as “Old environment output: (${M[13].lines} lines omitted)”. In this run that shrinks ${fin.full.toLocaleString("en")} characters to ${fin.short.toLocaleString("en")}.`,
      why: "The code's own note says newer models often don't need this, and trimming breaks prompt caching.",
      input: { label: "All characters", text: fin.full.toLocaleString("en"), prov: "read" }, transform: { label: "Keep the last 5 outputs", text: "<code>type: last_n_observations, n: 5</code>\n\nOnly what the model sees is trimmed. The saved record stays complete." }, output: { type: "bars", label: "Characters the model reads", items: [["all", fin.full], ["trimmed", fin.short]], prov: "ran" },
      log: ["context", "model", "trimmed history", `${fin.short} chars`], code: { f: HP, a: 157, b: 176, must: "Old environment output" } },
    { chapter: "The whole run", title: "The result is a one-line patch", cap: `Eleven turns and ${total.toLocaleString("en")} characters of context, for one changed line.`, focus: ["tower", "tools", "fixed"], set: tw(24, [23]),
      plain: "The <b>submit</b> command packages every change as a patch, and the run ends. The whole fix adds one word: <b>round</b>. On the SWE-bench test of real GitHub issues, the authors report solving 12.5% on the first try, which they describe as state of the art at the time.",
      facts: [["Exit status", TJ.exit], ["Turns", String(TJ.steps)], ["SWE-bench", "12.5% (authors' result)"], ["HumanEvalFix", "87.7% (authors' result)"]],
      input: { label: "Before", text: "return int(value.total_seconds() / base_unit.total_seconds())", prov: "read" }, transform: { label: "Package the changes", text: "<code>submit</code> saves the diff and ends the loop." }, output: { label: "After", text: "return int(round(value.total_seconds() / base_unit.total_seconds()))", prov: "read" },
      log: ["sandbox", "you", "patch", "1 line"], code: { f: AG, a: 870, b: 885, must: "submission" } }
  ]
};
