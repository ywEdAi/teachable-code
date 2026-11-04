/* ai-chatbot: what happens between pressing send and seeing the answer. Read from code; the app was not run. */
const PT = RUN.parts, ROUTE = "app/(chat)/api/chat/route.ts", TOOL = "lib/ai/tools/get-weather.ts", ASK = "What's the weather in Paris right now?";
const C = { sys: "var(--tf)", ctx: "var(--in)", user: "var(--accent)", tool: "var(--out)", res: "var(--ok)" };
const hints = "About the origin of user's request:\n- lat: 48.86\n- lon: 2.35\n- city: Paris\n- country: FR\n";
const camel = k => k.replace(/-(\w)/g, (_, c) => c.toUpperCase());
const toolText = Object.entries(PT.tools).map(([k, v]) => `${camel(k)}: ${v}`).join("\n");
const n = s => `${s.length.toLocaleString("en")} chars`;
const ITEMS = [
  { id: "sys", label: "System: who to be", chars: PT.regular.length, size: n(PT.regular), color: C.sys },
  { id: "rules", label: "System: when to use tools", chars: PT.artifacts.length, size: n(PT.artifacts), color: C.sys },
  { id: "geo", label: "Context: where you are", chars: hints.length, size: "example", color: C.ctx },
  { id: "hist", label: "Context: earlier messages", chars: 40, size: "none yet", color: C.ctx },
  { id: "user", label: "You: the question", chars: ASK.length, size: n(ASK), color: C.user },
  { id: "tools", label: "Tools it may ask for", chars: toolText.length, size: `${toolText.length} chars+`, color: C.tool }
];
const callJson = `{\n  "type": "tool-call",\n  "toolName": "getWeather",\n  "input": { "city": "Paris" }\n}`;
const resultJson = `{\n  "current": { "temperature_2m": 14.2 },\n  "hourly": { … },\n  "daily": { … },\n  "cityName": "Paris"\n}`;
const body = `{\n  "id": "3f6c…-uuid",\n  "message": {\n    "id": "9a1e…-uuid",\n    "role": "user",\n    "parts": [{ "type": "text",\n      "text": "${ASK}" }]\n  },\n  "selectedChatModel": "…",\n  "selectedVisibilityType": "private"\n}`;
const segs = (...ids) => ({ type: "segments", items: ids.map(id => { const i = ITEMS.find(x => x.id === id); return { label: i.label, size: i.size, color: i.color, text: { sys: PT.regular, rules: PT.artifacts.slice(0, 420) + " …", geo: hints, hist: "(new chat)", user: ASK, tools: toolText }[id] }; }) });

LESSON = {
  id: "ai-chatbot", title: "Inside an AI Chat App", question: "What happens between pressing send and seeing the answer?",
  kind: "llm_call", repo: { name: "vercel/ai-chatbot", url: "https://github.com/vercel/ai-chatbot", commit: "8603c8ea35ded822811d3201812e717b22edbbab" },
  limits: ["This page comes from reading the code. The app was not run, and no model was called, so the conversation, the tool call and the weather values are examples.", "The system prompt and tool descriptions are the real text from the pinned commit. Exactly how the AI SDK packages them for each provider was not captured."],
  folders: { "app": "Pages and server routes. A request enters here.", "components": "What you see: chat window, messages, buttons.", "lib/ai": "Everything about the model: prompts, tools, model list.", "lib/db": "Database tables and queries.", "artifacts": "The side panel for documents and code.", "tests": "Automated checks.", "public": "Images and other static files." },
  stage: {
    mode: "2d", world: { w: 1200, h: 660 },
    legend: [["system", "--tf"], ["context", "--in"], ["you", "--accent"], ["tools", "--out"]],
    edges: [["browser", "route"], ["route", "gate"], ["route", "db"], ["db", "stack"], ["stack", "model"], ["model", "tool"], ["tool", "ext"]],
    objects: {
      browser: { files: ["components/chat/multimodal-input.tsx", "components/chat/data-stream-handler.tsx"], type: "node", role: "user", x: 24, y: 270, w: 205, h: 92, label: "Your browser", sub: "the chat window" },
      route: { files: [ROUTE], type: "node", role: "app", x: 285, y: 270, w: 215, h: 92, label: "Server route", sub: "POST /api/chat" },
      gate: { files: [ROUTE, "app/(chat)/api/chat/schema.ts"], type: "node", role: "app", x: 285, y: 80, w: 215, h: 92, label: "Checks", sub: "valid? human? signed in? under limit?" },
      db: { files: ["lib/db/queries.ts"], type: "node", role: "data", x: 285, y: 460, w: 215, h: 92, label: "Database", sub: "chats and messages" },
      stack: { note: "Everything the model is handed for this one call, drawn to scale.", files: ["lib/ai/prompts.ts", ROUTE], type: "stack", x: 545, y: 62, w: 345, h: 560, label: "What the model receives", items: ITEMS.map(i => ({ ...i, text: i.text || (segs(i.id).items[0] || {}).text || "" })) },
      model: { files: ["lib/ai/providers.ts", ROUTE], type: "node", role: "model", x: 925, y: 100, w: 260, h: 92, label: "Language model", sub: "via AI Gateway · streamText" },
      tool: { files: [TOOL], type: "node", role: "tool", x: 925, y: 310, w: 260, h: 92, label: "getWeather tool", sub: "code in this repo" },
      ext: { files: [], type: "node", role: "external", x: 925, y: 500, w: 260, h: 92, label: "Open-Meteo", sub: "outside weather service" }
    }
  },
  steps: [
    { chapter: "You press send", title: "The message leaves your browser", cap: "A question is the only part you wrote. Most of what the model sees comes later.",
      plain: "Your question is wrapped in a small package with an ID and the model you picked. The server has a strict schema for this package. For example, a text part can be at most 2,000 characters.",
      show: ["browser", "route"], flow: [{ from: "browser", to: "route", label: "POST" }],
      input: { type: "text", label: "What you typed", text: ASK, prov: "illustrative" }, transform: { label: "Wrap it for the server", text: "Must match <code>postRequestBodySchema</code>." }, output: { type: "text", label: "JSON sent to the server", text: body, prov: "illustrative" },
      log: ["browser", "server", "your message", `${ASK.length} chars`], code: { f: "app/(chat)/api/chat/schema.ts", a: 17, b: 35, must: "postRequestBodySchema" } },
    { chapter: "You press send", title: "The server checks you first", cap: "Any failed check ends here. The model is never called, so it costs nothing.",
      plain: "Before spending money on a model, the server asks four things. Is the package valid? Is this a bot? Are you signed in? Have you hit your hourly limit? If any check fails, you get an error back.",
      show: ["gate"], focus: ["route", "gate"], flow: [{ from: "route", to: "gate", label: "check" }],
      input: { type: "text", label: "The package and your session", text: "JSON body + login cookie + IP address", prov: "read" }, transform: { label: "Four gates, in order", text: "parse → bot check → session → rate limit" }, output: { type: "text", label: "All clear, or one of these errors", prov: "read", text: "Invalid package → bad_request:api\nBot            → forbidden:api\nNot signed in  → unauthorized:chat\nOver the limit → rate_limit:chat" },
      log: ["server", "checks", "pass or stop", ""], code: { f: ROUTE, a: 74, b: 112, must: "postRequestBodySchema.parse" },
      ask: { q: "You pass the hourly limit. Does the model still run?", options: ["Yes, then the answer is hidden", "No, the request stops before any model call", "Only for short messages"], answer: 1, explain: "The limit check returns an error well before the model call." } },
    { chapter: "You press send", title: "Your history is loaded", cap: "The model keeps no memory of you. The app has to send the past each time.",
      plain: "The model remembers nothing between requests. So the server looks up this chat's earlier messages in the database and saves your new one. A new chat also gets a title, generated by a separate model call.",
      show: ["db"], focus: ["route", "db"], flow: [{ from: "route", to: "db", label: "load + save" }],
      input: { type: "text", label: "Chat ID", text: "3f6c…-uuid", prov: "illustrative" }, transform: { label: "Read and save", text: "<code>getMessagesByChatId</code>, then <code>saveMessages</code>." }, output: { type: "text", label: "Message list", text: `[ { role: "user", text: "${ASK}" } ]\n(earlier messages come first)`, prov: "illustrative" },
      log: ["server", "database", "history in, your message saved", ""], code: { f: ROUTE, a: 116, b: 133, must: "getMessagesByChatId" } },
    { chapter: "Building what the model reads", title: "The system prompt", cap: `Bars are drawn to scale. The rules are about ${Math.round(PT.artifacts.length / ASK.length)} times longer than your question.`,
      plain: "This is text you never see, written by the app's developers. It says how to behave and when to use each tool. Here the instructions are far longer than your question, and they go along with every request.",
      why: "When an AI app seems to have a personality or rules, this is usually where they come from.",
      show: ["stack"], focus: ["stack"], segs: ["sys", "rules"], flow: [{ from: "route", to: "stack", label: "assemble" }],
      input: { type: "text", label: "Does this model support tools?", text: "supportsTools = true", prov: "illustrative" }, transform: { label: "Join text blocks", text: "regularPrompt + hints + artifactsPrompt. Without tool support, the tool rules are left out." }, output: { ...segs("sys", "rules"), label: "Real text from prompts.ts", prov: "read" },
      log: ["prompts.ts", "bundle", "system instructions", `${(PT.regular.length + PT.artifacts.length).toLocaleString("en")} chars`], code: { f: "lib/ai/prompts.ts", a: 66, b: 80, must: "artifactsPrompt" } },
    { chapter: "Building what the model reads", title: "Your context", cap: "You did not type your location, but the model gets it.",
      plain: "The server adds what it knows about the request, such as your approximate location from the network. Then come your earlier messages and your new question. Together, this is called the context.",
      why: "That is why “weather here” can work without you naming a city.",
      focus: ["stack"], segs: ["geo", "hist", "user"],
      input: { type: "text", label: "From the network request", text: "geolocation(request)\n→ city, country, lat, lon", prov: "read" }, transform: { label: "Fill a template", text: "Turn the values into plain sentences, then add messages." }, output: { ...segs("geo", "hist", "user"), label: "Added to the bundle", prov: "illustrative" },
      log: ["request", "bundle", "location, history, question", `${(hints.length + ASK.length)} chars`], code: { f: ROUTE, a: 173, b: 180, must: "geolocation(request)" } },
    { chapter: "Building what the model reads", title: "Tools and their schemas", cap: "A schema is a form the model must fill in to ask for a tool.",
      plain: "The model also gets a list of tools: what each is for, and a form for what it needs. The model cannot run anything. It can only ask, by filling in a form.",
      why: "Tool descriptions are instructions too. The model picks tools by reading them.",
      show: ["tool"], focus: ["stack", "tool"], segs: ["tools"], flow: [{ from: "tool", to: "stack", label: "description + schema", kind: "tool" }],
      input: { type: "text", label: "The tool in code", text: "getWeather\n" + PT.tools["get-weather"], prov: "read" }, transform: { label: "Describe it to the model", text: "<code>activeTools</code> lists the five tools the model may ask for." }, output: { type: "text", label: "getWeather's form", text: `{\n  city?: string,   // e.g. 'San Francisco'\n  latitude?: number,\n  longitude?: number\n}`, prov: "read" },
      log: ["tools/", "bundle", "5 tool descriptions and forms", `${toolText.length} chars+`], code: { f: TOOL, a: 70, b: 77, must: "inputSchema" } },
    { chapter: "The model loop", title: "The model answers with a request", cap: "Its first reply is a filled-in form, not text for you.",
      plain: "The whole bundle goes to the model. It can't know today's weather, so rather than answering, it asks for the tool, with the form filled in. The app decides nothing here: this choice is the model's.",
      show: ["model"], focus: ["stack", "model"], flow: [{ from: "stack", to: "model", label: "whole bundle" }],
      input: { ...segs("user", "tools"), label: "Parts it relies on here", prov: "illustrative" }, transform: { label: "The model runs", text: "<code>streamText</code> sends instructions, messages and tools." }, output: { type: "text", label: "Tool call", text: callJson, prov: "illustrative" },
      log: ["bundle", "model", "everything above → 1 tool call", ""], code: { f: ROUTE, a: 269, b: 282, must: "streamText" },
      ask: { q: "Who actually gets the weather?", options: ["The model looks it up itself", "This app's code, after the model asks", "The browser"], answer: 1, explain: "The model only produces the request. Code in the repo runs it." } },
    { chapter: "The model loop", title: "The app runs the tool", cap: "This is ordinary code, with no AI involved.",
      plain: "Now normal code takes over. It checks the form and turns “Paris” into coordinates using an outside service. It then requests the forecast and collects the result.",
      show: ["ext"], focus: ["model", "tool", "ext"], flow: [{ from: "model", to: "tool", label: "getWeather", kind: "tool" }, { from: "tool", to: "ext", label: "2 web requests", kind: "tool" }],
      input: { type: "text", label: "Tool call", text: `{ "city": "Paris" }`, prov: "illustrative" }, transform: { label: "Look up, then fetch", text: "<code>geocodeCity</code> → coordinates → forecast API. An unknown city returns an error message." }, output: { type: "text", label: "Tool result", text: resultJson, prov: "illustrative" },
      log: ["tool", "Open-Meteo", "city → coordinates → forecast", "2 calls"], code: { f: TOOL, a: 39, b: 68, must: "geocodeCity" } },
    { chapter: "The model loop", title: "The result goes back to the model", cap: "The model is called again, now with the result in hand.",
      plain: "The result joins the conversation and the model reads everything again. It may ask for another tool or write its answer. This repeats for at most 5 rounds, a limit that stops it running forever.",
      why: "This request, run, read-again cycle is what people mean by an agent loop.",
      focus: ["model", "tool"], flow: [{ from: "tool", to: "model", label: "result", kind: "loop" }],
      input: { type: "text", label: "Tool result", text: resultJson, prov: "illustrative" }, transform: { label: "Model runs again", text: "<code>stopWhen: isStepCount(5)</code> caps the rounds." }, output: { type: "text", label: "This time it writes text", text: "It's about 14°C in Paris right now.", prov: "illustrative" },
      log: ["tool", "model", "result added · round 2 of at most 5", ""], code: { f: ROUTE, a: 305, b: 305, must: "isStepCount(5)" } },
    { chapter: "Back to you", title: "Words stream to your screen", cap: "Text arrives piece by piece, as the model writes it.",
      plain: "The answer does not wait until it is finished. Pieces flow straight through the server to your browser as they are written, so you can see it typing.",
      focus: ["model", "browser", "route"], flow: [{ from: "model", to: "browser", label: "text pieces" }],
      input: { type: "chips", label: "Pieces from the model", items: ["It's", " about", " 14°C", " in", " Paris"], prov: "illustrative" }, transform: { label: "Pass along as they arrive", text: "<code>toUIMessageStream</code> converts them into events the chat window understands." }, output: { type: "text", label: "On your screen", text: "It's about 14°C in Paris…", prov: "illustrative" },
      log: ["model", "browser", "answer, piece by piece", ""], code: { f: ROUTE, a: 331, b: 336, must: "toUIMessageStream" } },
    { chapter: "Back to you", title: "Everything is saved", cap: "These saved messages become the context for your next question.",
      plain: "When the stream ends, the finished messages are saved. Next time you ask something, step 3 loads them, and the bundle the model reads grows by that much.",
      why: "Long chats can get slower and costlier because the whole history is sent every time.",
      focus: ["route", "db"], flow: [{ from: "route", to: "db", label: "save", kind: "loop" }],
      input: { type: "text", label: "Finished messages", text: "Tool call, tool result and answer", prov: "illustrative" }, transform: { label: "Write to the database", text: "<code>saveMessages</code> runs in <code>onEnd</code>." }, output: { type: "text", label: "Chat history", text: "Now includes this whole exchange.", prov: "illustrative" },
      log: ["server", "database", "finished messages", ""], code: { f: ROUTE, a: 378, b: 388, must: "finishedMessages" } }
  ]
};
