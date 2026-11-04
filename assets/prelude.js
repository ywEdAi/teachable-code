/* Teachable Code prelude: globals every graph file can use. build.py puts GH, RUN and SRC before this file. */
const escD = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const GRAPHS = {};
function def(g){ GRAPHS[g.id] = g; return g; }
const PREVIEWS = {};   // name -> () => html string, shown in the inspector of a node with `preview: name`
const MINIS = {};      // name -> () => html string, small visual inside a concept card (`mini: name`)
const VIEWS = {};      // reusable custom views: VIEWS.directory(opts) -> custom(ctx)
let FRAMES = [];       // key frames: {id, name, g, select?, layers?, repro?, scenario?, intervene?}
let ROUTES = {};       // goal id -> [frame ids], ordered
let PROFILE = { goals: [], times: [] };
let PAGE = { id: "page", title: "Teachable Code", h1: "Teachable Code" };
