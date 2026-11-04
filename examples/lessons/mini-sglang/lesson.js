/* mini-sglang: why the second request is cheaper. Numbers: runs/cache.json, from run_cache.py (our own replay of the repo's cache rules). */
const EV = RUN.cache.events, ev = n => EV.find(e => e.name === n), evs = n => EV.filter(e => e.name === n), P = "python/minisgl/";
const zero = EV[0].pool, A = ev("A:compute"), Bm = ev("B:match"), Bc = ev("B:compute"), Cm = ev("CD:match"), Cc = ev("CD:compute"), Cs = ev("CD:saved"), Ec = ev("E:compute"), As = ev("A:saved"), Bs = ev("B:saved"), Es = ev("E:saved");
const att = A.att.map(r => [...r, ...Array(A.tokens.length - r.length).fill(0)]);
const range = (a, b) => Array.from({ length: b - a }, (_, i) => a + i);
const chips = (label, items, prov, hi, subs) => ({ type: "chips", label, items, hi, subs, prov });
const treeText = (nodes, d = 0) => nodes.map(n => "  ".repeat(d) + n.tokens.join(" ") + "   → slots " + n.slots.join(",") + "\n" + treeText(n.kids, d + 1)).join("");
const treeV = (label, e) => ({ label, text: treeText(e.tree).trim() || "(empty)", prov: "ran" });
const tones = (t, hit) => t.map((_, i) => i < hit ? "--in" : "--out");
const X = { pos: y => y };
const allA = As.tree[0].tokens, withC = [["A", A.computed], ["B", Bc.computed], ["C", Cc.computed[0]], ["D", Cc.computed[1]], ["E", Ec.computed]], without = [["A", 9], ["B", 9], ["C", 9], ["D", 9], ["E", 9]], sum = a => a.reduce((p, c) => p + c[1], 0);
const key = (e, rows) => ({ values: e.pool, ...(rows ? { hiRows: rows } : {}) });
const tile = (items, pos, label, extra) => ({ type: "tiles", items, pos, label, labelH: .66, ...extra });
const link = (a, b) => ({ at: "tree", type: "link", a, b, color: "--floor", r: .09 });
const TK = (n, f) => ({ f: P + f, ...n });

LESSON = {
  id: "mini-sglang", title: "mini-SGLang Cache", question: "Why does a chatbot answer the second question faster, when both start the same way?",
  kind: "systems", repo: { name: "sgl-project/mini-sglang", url: "https://github.com/sgl-project/mini-sglang", commit: "9a91cfafe754aa85daee49998176275667eb58f2" },
  limits: [
    `mini-sglang itself was not run. The numbers come from our own small simulation that follows its cache rules by hand: ${RUN.cache.capacity} memory slots, words as tokens, one attention layer with random weights and ${RUN.cache.dim} numbers per token. So the prompts are examples, and the amounts show the rule, not real speed.`,
    "Real models have many layers and far more memory, and the real scheduler also saves the prefix right after the first pass, where our replay saves it once at the end.",
    "The two-at-once case comes from reading the code and running our replay. It has not been tested on a GPU or raised with the project."
  ],
  folders: {
    "python/minisgl/server": "The front door: takes your web request.",
    "python/minisgl/tokenizer": "Turns text into numbers and back.",
    "python/minisgl/scheduler": "Decides who runs next and what is already saved.",
    "python/minisgl/kvcache": "The memory: the saved results and the tree that finds them.",
    "python/minisgl/layers": "The model's parts, including attention.",
    "python/minisgl/engine": "Runs the model on the GPU.",
    "benchmark": "Speed tests.", "docs": "The project's own explanations.", "tests": "Checks for the code."
  },
  stage: {
    mode: "3d",
    legend: [["reused", "--in"], ["new work", "--out"], ["negative", "--neg"], ["positive", "--pos"], ["data", "--accent"], ["loop", "--ok"]],
    stations: {
      reqs: { label: "Requests", box: [-11, -10.5, 25, 11], files: [P + "tokenizer/tokenize.py"], note: "Each message, cut into tokens. Here, one token is one word." },
      line: { label: "Waiting line", box: [9, -10.5, 11, 11], files: [P + "scheduler/prefill.py"], note: "Requests wait here until the GPU has room, then run together in a batch." },
      tree: { label: "Tree of saved prefixes", box: [-9, 7.5, 38, 21], files: [P + "kvcache/radix_cache.py", P + "scheduler/cache.py"], note: "Remembers which openings were already computed, and where their results are in memory." },
      gpu: { label: "GPU memory: 26 slots", box: [18.5, 9.5, 15, 25], files: [P + "kvcache/mha_pool.py"], note: "Holds the saved keys and values. One row per token. Results stay here after an answer is sent." },
      attn: { label: "Attention", box: [35, -4, 17, 15], files: [P + "layers/attention.py"], note: "How each word reads from earlier words in memory. This is why old results are needed again." },
      save: { label: "What it saved", box: [-9, 27, 38, 13], files: [P + "kvcache/radix_cache.py"], note: "Tokens computed in the first pass for the 5 example requests, with and without the cache." }
    },
    wires: [["line", "tree"], ["gpu", "attn"]],
    objects: {
      reqA: tile(A.tokens, [-11, 0, -10], null, { at: "reqs" }),
      reqB: tile(Bc.tokens, [-11, 0, -10], null, { at: "reqs", tones: tones(Bc.tokens, Bc.hit) }),
      queue: tile(["request", "A"], [9, 0, -10], null, { at: "line" }),
      pool: { at: "gpu", type: "slab", pos: [19, 0, 11], values: zero, hmax: 2.8, max: Math.max(...EV.flatMap(e => e.pool.flat()).map(Math.abs)), rowLabels: range(0, 26).map(String) },
      empty: { at: "tree", type: "label", pos: [-9, 1.2, 8], text: "Empty", h: 1.3, color: "--muted" },
      att: { at: "attn", type: "slab", pos: [36.5, 0, -3.3], values: att, flat: true, rowLabels: A.tokens, colLabels: A.tokens },
      tree11: tile(allA, [-9, 0, 3], null, { at: "tree" }),
      t7: tile(Bm.tree[0].tokens.slice(0, 7), [-15, 0, 3], null, { at: "tree", tones: Array(7).fill("--in") }),
      kv: tile(["KV", "cache", "It", "stores"], [0, 0, 1], null, { at: "tree" }),
      rad: tile(["radix", "tree"], [-.5, 0, 5], null, { at: "tree", tones: ["--out", "--out"] }),
      l1: link([-7, .2, 3], [-4.4, .2, 1]), l2: link([-7, .2, 3], [-3.2, .2, 5]),
      you: tile(["You", "are", "a"], [-22, 0, 8], null, { at: "tree", tones: ["--in", "--in", "--in"] }),
      help: tile(["helpful", "tutor", ".", "Explain"], [-11, 0, 3], null, { at: "tree" }),
      str: tile(["strict", "judge", ".", "Score", "this"], [-11, 0, 12.5], null, { at: "tree", tones: Array(5).fill("--out") }),
      ess: tile(["essay"], [-.7, 0, 10.5], null, { at: "tree" }), poe: tile(["poem"], [-.7, 0, 14.5], null, { at: "tree" }),
      l3: link([-19.5, .2, 8], [-16.5, .2, 3]), l4: link([-19.5, .2, 8], [-17, .2, 12.5]), l5: link([-5.5, .2, 3], [-4.4, .2, 1]), l6: link([-5.5, .2, 3], [-3.2, .2, 5]), l7: link([-5, .2, 12.5], [-2.3, .2, 10.5]), l8: link([-5, .2, 12.5], [-2.3, .2, 14.5]),
      reqC: tile(ev("CD:match").c, [-11, 0, -12.6], "C", { at: "reqs" }), reqD: tile(ev("CD:match").d, [-11, 0, -7.6], "D", { at: "reqs" }),
      reqE: tile(Ec.tokens, [-11, 0, -10], null, { at: "reqs", tones: Array(9).fill("--out") }),
      tE: tile(Ec.tokens, [-9, 0, 16.5], null, { at: "tree", tones: Array(9).fill("--out") }),
      gone: { at: "tree", type: "label", pos: [0, 1.7, 1], text: "oldest: removed", h: .8, color: "--bad" },
      withB: { at: "save", type: "bars", pos: [-19, 0, 28], items: withC, hmax: 5.5, max: 9, barW: 2.2, label: `With the cache: ${sum(withC)}`, labelH: .7, color: "--in" },
      noB: { at: "save", type: "bars", pos: [2, 0, 28], items: without, hmax: 5.5, max: 9, barW: 2.2, label: `No cache: ${sum(without)}`, labelH: .7, color: "--muted" }
    }
  },
  steps: [
    { chapter: "A request arrives", title: "Your message becomes tokens", cap: "Request A. Each block is one token.", show: ["reqA"], focus: ["reqA"],
      plain: "A model doesn't read letters. The first job is to cut your message into small pieces called <b>tokens</b>. Here we use whole words so you can read them; real tokenizers often cut words smaller.",
      why: "Watch the first seven blocks. They come back in the next request.",
      input: { label: "What you typed", text: A.tokens.join(" "), prov: "illustrative" }, transform: { label: "Tokenize", text: "Text in, a list of tokens out. A real tokenizer gives each token a number." }, output: chips("9 tokens", A.tokens, "illustrative"),
      log: ["you", "tokenizer", "request A", "9 tokens"], code: TK({ a: 26, b: 30, must: "encode" }, "tokenizer/tokenize.py") },
    { chapter: "A request arrives", title: "It joins a waiting line", cap: "Requests wait until the GPU has room.", show: ["queue"], focus: ["reqA", "queue"], flow: [{ from: "reqA", to: "queue", label: "request A" }],
      plain: "The scheduler holds a list of waiting requests. It takes them in order and groups them into a <b>batch</b>, so the GPU can work on several at once.",
      input: chips("Request A", A.tokens, "illustrative"), transform: { label: "Add to the line", text: "<code>pending_list.append(...)</code>\n\nNothing is computed yet." }, output: { label: "Waiting line", text: "1. request A (9 tokens)", prov: "illustrative" },
      log: ["tokenizer", "scheduler", "request A", "9 tokens"], code: TK({ a: 123, b: 124, must: "pending_list.append" }, "scheduler/prefill.py") },
    { chapter: "First time: nothing saved", title: "Has any of this been seen before?", cap: "Before computing anything, it checks the tree of saved prefixes.", hide: ["queue"], show: ["empty", "pool"], focus: ["reqA", "empty"],
      plain: "A <b>prefix</b> is the start of a message. The server keeps a tree of every prefix it has recently worked on. It's the first request, so the tree is empty and the answer is no.",
      ask: { q: "How many of the 9 tokens can it reuse?", options: ["All 9", "8, the last is always redone", "None"], answer: 2, explain: "The tree is empty, so there is nothing to reuse." },
      input: chips("Request A", A.tokens, "illustrative"), transform: { label: "Look up all but the last token", text: "<code>match_prefix(input_ids[: input_len - 1])</code>\n\nThe last token is always recomputed, because the model needs its output to choose the next word." }, output: { label: "Tokens found", text: "0 of 9", prov: "ran" },
      log: ["scheduler", "prefix tree", "lookup", "0 found"], code: TK({ a: 27, b: 30, must: "match_prefix" }, "scheduler/cache.py") },
    { chapter: "First time: nothing saved", title: "Every token leaves a result in memory", cap: "Each row is one memory slot, filling as tokens are computed.", hide: ["empty"], focus: ["reqA", "pool"], set: { pool: key(A, range(0, 9)) }, flow: [{ from: "reqA", to: "pool", label: "9 tokens" }],
      plain: "As the model reads each token it produces two lists of numbers, called <b>key</b> and <b>value</b> (KV). Together they sum up that token for everything that comes later. They go in GPU memory, one row per token. This is the expensive part.",
      why: "These rows are what the whole system exists to reuse.",
      input: chips("9 tokens to compute", A.tokens, "illustrative"), transform: { label: "Run the model", text: `Each token produces a key and a value of ${RUN.cache.dim} numbers in our small model. Real models store far more, for every layer.` }, output: { type: "matrix", label: "Keys in memory, rows 0 to 8", values: A.pool.slice(0, 9), rowLabels: A.tokens, numCols: 4, prov: "ran" },
      log: ["model", "GPU memory", "keys and values", "9 slots"], code: TK({ a: 28, b: 35, must: "_kv_buffer" }, "kvcache/mha_pool.py") },
    { chapter: "First time: nothing saved", title: "Later words read earlier ones", cap: "Read a row: how much that word draws on each earlier word. Weights are random here.", show: ["att"], focus: ["att", "pool"],
      plain: "This is <b>attention</b>. To work out a word, the model compares it with the keys of all earlier words, then blends their values. That's why saving helps: earlier results are needed again and again, and they never change.",
      why: "The blank corner is real: a word can't read words that come after it.",
      input: { type: "matrix", label: "Saved keys", values: A.pool.slice(0, 9), rowLabels: A.tokens, numCols: 4, prov: "ran" }, transform: { label: "Compare, then blend", text: "Query × saved keys gives a share for each earlier word. Each row adds up to 100%." }, output: { type: "matrix", label: "Shares, each row adds up to 1", values: att, rowLabels: A.tokens, colLabels: A.tokens, digits: 2, numCols: 12, prov: "ran" },
      log: ["GPU memory", "attention", "keys and values", "1 layer"], code: TK({ a: 47, b: 57, must: "attn_backend.forward" }, "layers/attention.py") },
    { chapter: "First time: nothing saved", title: "The answer grows one word at a time", cap: "Each new word adds one memory row.", hide: ["att"], focus: ["pool"], flow: [{ from: "pool", to: "reqA", label: "next word", kind: "loop", lift: 5 }], set: { pool: key(evs("A:decode")[1], range(0, 11)) },
      play: { ms: 1500, frames: [{ set: { pool: key(A, range(0, 9)) }, cap: "First pass done. Output: “It”" }, { set: { pool: key(evs("A:decode")[0], [9]) }, cap: "Feed back “It”: 1 new slot. Output: “stores”" }, { set: { pool: key(evs("A:decode")[1], [10]) }, cap: "Feed back “stores”: 1 new slot. Output: “pairs”" }] },
      plain: "Now the loop. The model picks a word, feeds it back in, and computes just that one word, because everything before it is already in memory. This step is called <b>decode</b>. The first pass over the whole prompt is called <b>prefill</b>.",
      input: chips("Fed back in, one at a time", ["It", "stores"], "illustrative"), transform: { label: "Repeat until done", text: "Compute 1 token, save 1 row, pick the next word.\n\nThe last word is never fed back, so it takes no row." }, output: chips("Words generated", ["It", "stores", "pairs"], "illustrative"),
      log: ["model", "GPU memory", "decode", "+2 slots"], code: TK({ a: 146, b: 164, must: "append_host" }, "scheduler/scheduler.py") },
    { chapter: "First time: nothing saved", title: "The work is filed in the tree", cap: "11 tokens, and which memory slot each one lives in.", hide: ["reqA"], show: ["tree11"], focus: ["tree11", "pool"], flow: [{ from: "pool", to: "tree11", label: "slot numbers" }], set: { pool: key(As) },
      plain: "When a request finishes, its tokens go in the tree with a note saying where each result lives in memory. The results stay in memory after the answer has been sent. That's the whole trick.",
      input: chips("Tokens and slots", allA, "ran", [], As.tree[0].slots.map(String)), transform: { label: "Insert into the tree", text: "<code>insert_prefix(insert_ids, page_indices)</code>" }, output: treeV("The tree now", As),
      log: ["scheduler", "prefix tree", "tokens → slots", "11 tokens"], code: TK({ a: 67, b: 70, must: "insert_prefix" }, "scheduler/cache.py") },

    { chapter: "Second request: reuse", title: "A new question, the same opening", cap: "Green: already seen. Orange: new.", hide: ["reqA"], show: ["reqB"], focus: ["reqB", "tree11"],
      plain: "Someone asks a different question, but with the same opening instructions. That's very common: apps send the same system prompt with every message. Only the end differs.",
      ask: { q: "How many of these 9 tokens need computing?", options: ["9", "2", "1"], answer: 1, explain: "Seven match the tree. “radix” and “tree” are new." },
      input: chips("Request B", Bc.tokens, "illustrative", [7, 8]), transform: { label: "Compare with request A", text: "The first 7 tokens match. Tokens 8 and 9 differ." }, output: { type: "bars", label: "Tokens", items: [["seen", 7], ["new", 2]], prov: "ran" },
      log: ["you", "scheduler", "request B", "9 tokens"], code: TK({ a: 205, b: 215, must: "children.get" }, "kvcache/radix_cache.py") },
    { chapter: "Second request: reuse", title: "The tree splits where they differ", cap: "One branch becomes a shared stem and two tips.", hide: ["tree11"], show: ["t7", "kv", "rad", "l1", "l2"], focus: ["t7", "kv", "rad", "l1", "l2", "reqB"],
      plain: "The saved branch matches only partway. So the tree cuts it in two at that point: a shared stem, then separate tips for “KV cache” and “radix tree”. No results in memory move; only the filing changes.",
      why: "This shape is called a radix tree. It stores each shared opening just once.",
      input: treeV("Before", As), transform: { label: "Split at position 7", text: "<code>node.split_at(match_len)</code>" }, output: treeV("After", Bs),
      log: ["prefix tree", "prefix tree", "split", "7 + 4"], code: TK({ a: 218, b: 226, must: "split_at" }, "kvcache/radix_cache.py") },
    { chapter: "Second request: reuse", title: "It points at old results instead of redoing them", cap: "Slots 0 to 6 glow: request B borrows them.", show: ["pool"], focus: ["pool", "t7"], flow: [{ from: "t7", to: "pool", label: "7 slots", kind: "loop" }], set: { pool: key(Bm, range(0, 7)) },
      plain: "Each request has a table that says where its tokens live in memory. For request B, the first seven entries just point at the rows request A left behind. Nothing is copied or recalculated, and those rows are locked so they can't be removed while in use.",
      input: chips("Slots found", Bc.tokens.slice(0, 7), "ran", [], Bm.shared.map(String)), transform: { label: "Fill in the table", text: "<code>page_entry.copy_(handle.get_matched_indices())</code>\n\nThis copies slot numbers, not the results." }, output: { label: "Request B's table", text: Bc.tokens.map((t, i) => `${t}: ${i < 7 ? "slot " + Bm.shared[i] + " (reused)" : "to compute"}`).join("\n"), prov: "ran" },
      log: ["prefix tree", "page table", "slot numbers", "7 entries"], code: TK({ a: 57, b: 61, must: "get_matched_indices" }, "scheduler/prefill.py") },
    { chapter: "Second request: reuse", title: "Only two tokens are computed", cap: "Two new rows. Same answer as computing all nine.", focus: ["pool", "reqB"], flow: [{ from: "reqB", to: "pool", label: "2 tokens" }], set: { pool: key(Bc, Bc.new_slots) },
      plain: `The model runs on two tokens instead of nine. We checked our replay: the result with reused memory matches the result of computing everything from scratch, with a largest difference of <b>${Bc.diff}</b>. Reusing costs nothing in accuracy, because earlier tokens never change.`,
      why: "This is why the second request is cheaper.",
      input: chips("Request B", Bc.tokens, "ran", [7, 8]), transform: { label: "Run the model on the new part", text: "Our replay ran it both ways and compared the final numbers." }, output: { type: "bars", label: "Tokens computed", items: [["cache", Bc.computed], ["no cache", Bc.without_cache]], prov: "ran" },
      log: ["model", "GPU memory", "keys and values", "2 slots"], code: TK({ a: 72, b: 81, must: "chunk_size" }, "scheduler/prefill.py") },

    { chapter: "Hard cases", title: "Two arrive at the same moment", cap: "Both look in the tree before either has saved anything.", hide: ["t7", "kv", "rad", "l1", "l2", "reqB"], show: ["reqC", "reqD", "you", "help", "kv", "rad", "str", "ess", "poe", "l3", "l4", "l5", "l6", "l7", "l8"], focus: ["reqC", "reqD", "str", "ess", "poe", "l7", "l8", "l4", "pool"], set: { pool: key(Cs, Cc.slots[0].concat(Cc.slots[1])) }, flow: [{ from: "reqC", to: "pool", label: "6 tokens" }, { from: "reqD", to: "pool", label: "6 tokens" }],
      plain: `C and D share eight tokens, but they arrive in one batch. Each checks the tree before the other has saved anything, so each finds only “You are a” and computes 6 tokens. Afterward, the ${Cs.wasted} duplicate rows are freed. If D had arrived just after C, it would have computed 1.`,
      why: "Same batch, no sharing. This comes from reading the code and our replay; it was not tested on a GPU.",
      input: { type: "pair", prov: "illustrative", items: [chips("C", Cm.c, "illustrative"), chips("D", Cm.d, "illustrative")] }, transform: { label: "Match, then compute, then save", text: "All the lookups happen while the batch is being built. Saving happens after it runs." }, output: { type: "bars", label: "Tokens computed by D", items: [["together", Cc.computed[1]], ["just after", 1]], prov: "ran" },
      log: ["scheduler", "model", "two requests", "12 tokens"], code: TK({ a: 139, b: 147, must: "try_add_one" }, "scheduler/prefill.py") },
    { chapter: "Hard cases", title: "Memory fills up, so the oldest tip goes", cap: "Only a tip that nothing is using can be removed.", hide: ["reqC", "reqD"], show: ["reqE", "gone", "tE"], focus: ["reqE", "kv", "gone", "pool"], set: { pool: key(Ec, Ec.new_slots) },
      plain: `A new, unrelated request needs 9 slots and only ${Cs.free} are free. The server removes the branch tip it used longest ago: “${Ec.evicted[0]}”. Tips in use are locked with a counter, so a running request never loses its memory.`,
      why: "A cache is a bet. If request A's question returned now, its ending would need computing again.",
      input: { label: "Needed vs free", text: `needed: 9 slots\nfree: ${Cs.free} slots`, prov: "ran" }, transform: { label: "Remove the least recently used tip", text: "<code>heapq.heappop(leave_nodes)</code>\n\nA removed stem can become a new tip and may go next." }, output: treeV("The tree after", Es),
      log: ["prefix tree", "free list", "removed tip", `${Ec.evicted[0].split(" ").length} slots`], code: TK({ a: 155, b: 173, must: "heappop" }, "kvcache/radix_cache.py") },
    { chapter: "The result", title: "What the shared openings saved", cap: "Tokens computed in the first pass, for each of the 5 requests.", show: ["withB", "noB"], focus: ["withB", "noB"],
      plain: `Across these five requests the model computed <b>${sum(withC)}</b> tokens in the first pass instead of <b>${sum(without)}</b>. Longer shared prompts save much more. That's why agents and chat apps, which resend long instructions and history, benefit so much.`,
      why: "These are example prompts in a small simulation, so read this as the rule rather than a speed claim.",
      input: { type: "bars", label: "No cache", items: without, max: 9, prov: "ran" }, transform: { label: "Same requests, same results", text: "The difference is only how many tokens the model had to compute." }, output: { type: "bars", label: "With the cache", items: withC, max: 9, prov: "ran" },
      log: ["all", "summary", "tokens computed", `${sum(withC)} vs ${sum(without)}`], code: TK({ a: 132, b: 134, must: "match_prefix" }, "kvcache/radix_cache.py") }
  ]
};
