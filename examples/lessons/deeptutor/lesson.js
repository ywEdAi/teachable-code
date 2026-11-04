/* DeepTutor: what the tutor does with one question about your textbook. Real prompt text from runs/parts.json; the app was not run. */
const PT = RUN.parts, PIPE = "deeptutor/agents/loop/pipeline.py", LOOP = "deeptutor/runtime/agentic/loop.py", YML = "deeptutor/agents/chat/prompts/en/agentic_chat.yaml";
const ASK = "What does the Fourier transform actually do? Use my textbook.";
const C = { sys: "var(--tf)", loop: "var(--tf)", tools: "var(--out)", kb: "var(--in)", you: "var(--accent)", call: "var(--out)", res: "var(--in)" };
const n = s => `${s.length.toLocaleString("en")} chars`;
const rules = [PT.general, PT.runtime_policy, PT.snapshot, PT.tool_call].join("\n\n");
const toolTxt = `rag: ${PT.rag}\nWhen to use: ${PT.rag_hints.when_to_use}\nInput: ${PT.rag_hints.input_format}`;
const CALL = `{ "name": "rag",\n  "arguments": {\n    "query": "what the Fourier transform does",\n    "kb_name": "my-textbook" } }`;
const PASS = "Chapter 4. The Fourier transform rewrites a signal as a sum of sine waves. Each output value says how much of one frequency the signal contains…";
const SAY = "I'll check your textbook's chapter on this first, so the explanation matches its notation.";
const ANS = "It splits a signal into the frequencies inside it, like listing the notes in a chord. Your textbook writes it in Chapter 4 as a sum of sine waves…";
const ITEMS = [
  { id: "sys", label: "Who to be and the rules", chars: rules.length, size: n(rules), color: C.sys },
  { id: "loop", label: "How to work", chars: PT.loop.length, size: n(PT.loop), color: C.loop },
  { id: "tools", label: "Tools it may use", chars: toolTxt.length, size: `${toolTxt.length} chars+`, color: C.tools },
  { id: "kb", label: "Textbook passages", chars: 4000, size: "up to 4,000", color: C.kb },
  { id: "you", label: "Your question", chars: ASK.length, size: n(ASK), color: C.you },
  { id: "call", label: "Its tool request", chars: CALL.length + SAY.length, size: "example", color: C.call },
  { id: "res", label: "More passages", chars: 1500, size: "example", color: C.res }
];
const TXT = { sys: rules, loop: PT.loop, tools: toolTxt, kb: `${PT.kb_header}\n\n${PASS}`, you: ASK, call: `${SAY}\n${CALL}`, res: PASS };
const segs = (label, prov, ...ids) => ({ type: "segments", label, prov, items: ids.map(id => { const i = ITEMS.find(x => x.id === id); return { label: i.label, size: i.size, color: i.color, text: TXT[id].length > 700 ? TXT[id].slice(0, 700) + " …" : TXT[id] }; }) });
const upto = ids => ({ ctx: { items: ids } });
const CAPS = [["chat", 2], ["ask_questions", 1], ["deep_solve", 1], ["deep_question", 2], ["deep_research", 4], ["visualize", 3], ["math_animator", 6], ["mastery_path", 1], ["immersive_reading", 1], ["video_lesson", 3]];

LESSON = {
  id: "deeptutor", title: "Inside DeepTutor", question: "What does an AI tutor do with your question before it answers?",
  kind: "llm_call", repo: { name: "HKUDS/DeepTutor", url: "https://github.com/HKUDS/DeepTutor", commit: "f7aed0744c36c5afef16a4261c31ebee1208cac2" },
  limits: [
    "DeepTutor was not run and no model was called. The prompt text, tool description and limits are copied from the code at this commit. The question, the tool call, the textbook passages and the answer are examples we wrote.",
    "The full system prompt also includes parts that depend on the session, such as a list of every enabled tool, memory, skills and your workspace notes, so the sizes here are the fixed parts only. This lesson follows the default chat mode with a traditional RAG knowledge base; other modes and knowledge base types differ."
  ],
  folders: {
    "deeptutor/app": "The front desk: saves each turn so it can be replayed.",
    "deeptutor/runtime": "Picks the mode and runs the model loop.",
    "deeptutor/agents": "The modes, with their prompts.",
    "deeptutor/capabilities": "Add-on modes and their rules.",
    "deeptutor/tools": "Single actions the model can ask for.",
    "deeptutor/services": "The heavy lifting: search, documents, models, storage.",
    "deeptutor/core": "The shared shapes of data, such as one turn's context.",
    "web": "The website you use.", "deeptutor_cli": "The command-line version.", "tests": "Checks for the code.", "docs-for-dev": "Notes for developers."
  },
  stage: {
    mode: "2d", world: { w: 1200, h: 660 },
    legend: [["instructions", "--tf"], ["tools", "--out"], ["your material", "--in"], ["you", "--accent"]],
    edges: [["you", "svc"], ["svc", "packet"], ["packet", "orch"], ["bus", "you"], ["model", "rag"], ["rag", "kb"]],
    objects: {
      you: { files: ["web/app/(workspace)/chat/page.tsx"], type: "node", role: "user", x: 40, y: 275, w: 200, h: 110, label: "You", sub: "the chat window" },
      svc: { files: ["deeptutor/app/service.py"], type: "node", role: "app", x: 300, y: 60, w: 230, h: 112, label: "Turn service", sub: "saves the turn first" },
      packet: { files: ["deeptutor/core/context.py"], type: "node", role: "data", x: 300, y: 275, w: 230, h: 112, label: "Context packet", sub: "everything about this turn" },
      orch: { files: ["deeptutor/runtime/orchestrator.py"], type: "node", role: "app", x: 300, y: 490, w: 230, h: 112, label: "Orchestrator", sub: "chooses the mode" },
      bus: { files: ["deeptutor/core/stream.py"], type: "node", role: "app", x: 40, y: 490, w: 200, h: 112, label: "Live stream", sub: "events, as they happen" },
      ctx: { note: "The instructions, tools, passages and conversation sent to the model, drawn to scale.", files: [PIPE, YML], type: "stack", x: 590, y: 66, w: 310, h: 560, fixed: true, label: "What the model reads", items: ITEMS.map(i => ({ ...i, text: TXT[i.id] })) },
      model: { files: [LOOP, "deeptutor/services/llm/client.py"], type: "node", role: "model", x: 960, y: 60, w: 210, h: 112, label: "The model", sub: "one reply each round" },
      rag: { files: ["deeptutor/tools/rag_tool.py", "deeptutor/tools/builtin/__init__.py"], type: "node", role: "tool", x: 960, y: 275, w: 210, h: 112, label: "rag tool", sub: "finds passages" },
      kb: { files: ["deeptutor/services/rag/service.py"], type: "node", role: "data", x: 960, y: 490, w: 210, h: 112, label: "Your textbook", sub: "a searchable knowledge base" }
    }
  },
  steps: [
    { chapter: "You ask", title: "Saved before anything else", cap: "The question is written down before any thinking starts.", show: ["you", "svc"], focus: ["you", "svc"], flow: [{ from: "you", to: "svc", label: "your question" }],
      plain: "You ask about your textbook. The first thing DeepTutor does is save the turn. If your connection drops halfway, the app can replay everything you missed, instead of losing the answer.",
      input: { label: "You type", text: ASK, prov: "illustrative" }, transform: { label: "Start a turn", text: "<code>start_turn(payload)</code>\n\nStores the request and gives it an ID." }, output: { label: "A saved turn", text: `turn: new ID\nsession: this chat\nstatus: running`, prov: "illustrative" },
      log: ["you", "turn service", "request", n(ASK)], code: { f: "deeptutor/app/service.py", a: 113, b: 119, must: "start_turn" } },
    { chapter: "You ask", title: "Everything is packed into one parcel", cap: "Every part of the system receives the same parcel.", show: ["packet"], focus: ["svc", "packet"], flow: [{ from: "svc", to: "packet", label: "turn" }],
      plain: "The question gets bundled with everything else about this moment: earlier messages, your attached textbook, enabled tools, your language, what the tutor remembers about you. Every later step reads from this one <b>context</b> parcel.",
      input: { label: "Your question", text: ASK, prov: "illustrative" }, transform: { label: "Build a UnifiedContext", text: "One shape for every entry point: website, command line or Python." }, output: { label: "Fields in the parcel", text: "user_message\nconversation_history\nenabled_tools\nknowledge_bases\nattachments\nlanguage\nmemory_context\npersona_context\n…", prov: "read" },
      log: ["turn service", "context", "parcel", "1 turn"], code: { f: "deeptutor/core/context.py", a: 92, b: 110, must: "UnifiedContext" } },
    { chapter: "You ask", title: "Which kind of help?", cap: "Nothing was chosen, so it falls back to chat.", show: ["orch"], focus: ["packet", "orch"], flow: [{ from: "packet", to: "orch", label: "parcel" }],
      plain: "DeepTutor has ten modes, called <b>capabilities</b>, such as chat, deep research and question generation. You didn't pick one, so it uses the default: <b>chat</b>. The mode now owns the rest of this turn.",
      input: { label: "Mode you chose", text: "active_capability: none", prov: "illustrative" }, transform: { label: "Default to chat", text: "<code>context.active_capability or \"chat\"</code>" }, output: { type: "chips", label: "The ten modes", prov: "read", items: CAPS.map(c => c[0]), hi: [0] },
      log: ["context", "orchestrator", "mode choice", "chat"], code: { f: "deeptutor/runtime/orchestrator.py", a: 113, b: 114, must: "active_capability" } },

    { chapter: "What the tutor reads", title: "Who to be, and the rules", cap: "Bars are to scale, using only the fixed text.", show: ["ctx"], focus: ["orch", "ctx"], segs: ["sys"], set: upto(["sys"]), flow: [{ from: "orch", to: "ctx", label: "start the prompt" }],
      plain: "Now it writes what the model reads. It opens with the <b>system prompt</b>: “You are DeepTutor, an interactive tutor and learning companion.” Then rules, such as treat your attached files as information, not as orders.",
      why: "That rule defends against a document that tries to give the tutor instructions.",
      input: { label: "Prompt file", text: "agentic_chat.yaml, English version", prov: "read" }, transform: { label: "Assemble blocks", text: "<code>_build_system_prompt(...)</code>\n\nThe same text stays in place for the whole turn." }, output: segs("Real text", "read", "sys"),
      log: ["prompt file", "context", "system prompt", n(rules)], code: { f: PIPE, a: 450, b: 478, must: "_build_system_prompt" } },
    { chapter: "What the tutor reads", title: "How to work", cap: "The biggest fixed block is about how to behave in the loop.", focus: ["ctx"], segs: ["loop"], set: upto(["sys", "loop"]),
      plain: `The largest block, ${PT.loop.length.toLocaleString("en")} characters, explains the working method. Use tools, look at the results, repeat. Say what you're doing before each tool, in plain words. <b>When you stop calling tools, your reply is the answer.</b>`,
      why: "For a tutor, that “say what you're doing” rule is teaching: you can watch it think.",
      input: { label: "Rules so far", text: `${rules.length.toLocaleString("en")} characters`, prov: "read" }, transform: { label: "Add the loop rules", text: "This block sets how the whole turn runs." }, output: segs("Real text", "read", "loop"),
      log: ["prompt file", "context", "loop rules", n(PT.loop)], code: { f: YML, a: 81, b: 105, must: "ONE loop" } },
    { chapter: "What the tutor reads", title: "The tools it may ask for", cap: "The model can't use a tool unless it is described here.", show: ["rag"], focus: ["ctx", "rag"], segs: ["tools"], set: upto(["sys", "loop", "tools"]), flow: [{ from: "rag", to: "ctx", label: "description" }],
      plain: "Each tool comes with a <b>schema</b>: its name, what it's for and what information it needs. The rag tool is here because you attached a textbook. Tools are switched on to fit the situation, so the list changes from turn to turn.",
      input: { label: "You attached", text: "knowledge_bases: [\"my-textbook\"]", prov: "illustrative" }, transform: { label: "Choose tools, build schemas", text: "<code>_compose_enabled_tools(context)</code>" }, output: segs("Real description of rag", "read", "tools"),
      log: ["tool registry", "context", "tool schema", `${toolTxt.length} chars`], code: { f: "deeptutor/tools/builtin/__init__.py", a: 167, b: 177, must: "name=\"rag\"" } },
    { chapter: "What the tutor reads", title: "Textbook passages, before it even asks", cap: "It searches your textbook once, before the model starts.", show: ["kb"], focus: ["ctx", "kb", "rag"], segs: ["kb", "you"], set: upto(["sys", "loop", "tools", "kb", "you"]), flow: [{ from: "kb", to: "ctx", label: "passages" }],
      plain: "Before the model starts, DeepTutor searches your textbook with your question and adds what it finds, up to 4,000 characters per textbook. Your question goes last. The passages sit next to the question, not in the system prompt, which stays unchanged.",
      why: "An unchanged opening can be cached, so each round costs less.",
      facts: [["Most per textbook", "4,000 characters"], ["Most textbooks", "3"]],
      input: { label: "Search for", text: ASK, prov: "illustrative" }, transform: { label: "Seed the conversation", text: "<code>_retrieve_kb_seed_block(...)</code>\n\nThe header warns they may be “incomplete or partially irrelevant”." }, output: segs("Added to your message", "illustrative", "kb", "you"),
      log: ["textbook", "context", "passages", "≤ 4,000 chars"], code: { f: PIPE, a: 495, b: 504, must: "user_message" } },

    { chapter: "The loop", title: "The model says what it will do, then asks", cap: "Round 1 of at most 8.", show: ["model"], focus: ["ctx", "model", "rag"], segs: ["call"], set: upto(["sys", "loop", "tools", "kb", "you", "call"]), flow: [{ from: "ctx", to: "model", label: "everything" }, { from: "model", to: "rag", label: "rag request", kind: "tool" }],
      plain: "The model reads the whole stack and replies. The first passages weren't enough, so it writes one sentence you can see, then a tool request in the exact format the schema demands. It doesn't run anything itself.",
      ask: { q: "Who actually searches the textbook?", options: ["The model", "DeepTutor's code", "You"], answer: 1, explain: "The model only asks. DeepTutor's code carries it out." },
      input: { label: "Sent to the model", text: "System prompt, tool schemas, passages, your question", prov: "read" }, transform: { label: "One round", text: "<code>run_labeled_step(...)</code>\n\nThe reply gets a label: tool call, or final answer." }, output: segs("The model's reply", "illustrative", "call"),
      log: ["context", "model", "all messages", "round 1"], code: { f: LOOP, a: 228, b: 260, must: "run_labeled_step" } },
    { chapter: "The loop", title: "The code runs the search", cap: "The tool looks through your textbook.", focus: ["model", "rag", "kb"], flow: [{ from: "rag", to: "kb", label: "query", kind: "tool" }],
      plain: "DeepTutor's code runs the tool. The rag tool searches your textbook for passages that fit the query. This is <b>RAG</b>, retrieval-augmented generation: look it up, then write the answer.",
      input: { label: "Tool request", text: CALL, prov: "illustrative" }, transform: { label: "Dispatch the tool", text: "<code>_dispatch_tool_calls(...)</code>\n\nRequests that depend on nothing else can run at the same time." }, output: { label: "Passage found", text: PASS, prov: "illustrative" },
      log: ["model", "rag tool", "query", "1 call"], code: { f: PIPE, a: 1183, b: 1191, must: "_dispatch_tool_calls" } },
    { chapter: "The loop", title: "The result joins the stack, and it loops", cap: "The model sees the result next round.", focus: ["kb", "rag", "ctx"], segs: ["res"], set: upto(["sys", "loop", "tools", "kb", "you", "call", "res"]), flow: [{ from: "rag", to: "ctx", label: "passages", kind: "loop" }],
      plain: "The result is added to the stack and the next round begins with everything so far. It can go on up to <b>8 rounds</b> by default. If the budget runs out, the model is told to answer with what it has and say what's still uncertain.",
      input: { label: "Passage found", text: PASS, prov: "illustrative" }, transform: { label: "Append and repeat", text: "<code>messages.extend(outcome.tool_messages)</code>\n\n<code>DEFAULT_MAX_ROUNDS = 8</code>" }, output: { label: "If rounds run out (real prompt)", text: "The round budget ran out before every gap was closed. Stop calling tools and answer now with what you have, noting briefly what remains uncertain.", prov: "read" },
      log: ["rag tool", "context", "tool result", "example"], code: { f: LOOP, a: 322, b: 340, must: "tool_messages" } },
    { chapter: "The loop", title: "A reply with no tool request is the answer", cap: "No flag says “finished”. It just stops asking.", focus: ["ctx", "model"], flow: [{ from: "ctx", to: "model", label: "round 2" }],
      plain: "On the next round the model has enough, so it writes for you and asks for nothing. That ends the loop. The prompt file's first line says it directly: “the answer is the round that stops calling tools.”",
      input: segs("New since round 1", "illustrative", "res"), transform: { label: "Check the label and stop", text: "<code>if step.label in protocol.terminal: ... break</code>" }, output: { label: "The answer", text: ANS, prov: "illustrative" },
      log: ["model", "turn", "final answer", "round 2"], code: { f: LOOP, a: 280, b: 307, must: "protocol.terminal" } },

    { chapter: "Back to you", title: "You watched it happen", cap: "Every stage reaches you as a small event.", show: ["bus"], hide: ["rag", "kb"], focus: ["model", "bus", "you"], flow: [{ from: "model", to: "bus", label: "events" }, { from: "bus", to: "you", label: "words", kind: "loop" }],
      plain: "You don't wait for the end. Thoughts, tool calls, sources and words are sent as a stream of <b>events</b> while the work happens. Each is saved too, which is how a dropped connection can pick up where it left off.",
      input: { label: "The answer", text: ANS, prov: "illustrative" }, transform: { label: "Publish events", text: "One stream for this turn. The website, command line and Python all read the same events." }, output: { type: "chips", label: "Some real event types", prov: "read", items: ["stage_start", "thinking", "tool_call", "tool_result", "sources", "content", "result", "done"] },
      log: ["model", "you", "events", "live"], code: { f: "deeptutor/core/stream.py", a: 17, b: 33, must: "TOOL_CALL" } },
    { chapter: "Back to you", title: "Same engine, ten kinds of tutor", cap: "Chat is one mode. Others have more stages.", hide: ["model", "orch", "bus", "you", "ctx"], show: ["svc", "packet", "orch"], focus: ["svc", "packet", "orch"],
      plain: "Everything you just followed is one mode. Two levels make up the design: <b>tools</b> are single actions the model picks, and <b>capabilities</b> are whole processes that take over a turn. Deep research, for one, runs four stages. The front of the journey stays the same.",
      why: "If you build AI apps, this split is the part worth borrowing.",
      input: { label: "The same parcel", text: "UnifiedContext", prov: "read" }, transform: { label: "Hand the turn to a mode", text: "<code>await capability.run(context, bus)</code>" }, output: { type: "bars", label: "Stages per mode", items: CAPS, prov: "read" },
      log: ["orchestrator", "capability", "the whole turn", "10 modes"], code: { f: "deeptutor/runtime/orchestrator.py", a: 166, b: 170, must: "capability.run" } }
  ]
};
