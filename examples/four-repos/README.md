# Example: four repos in one page

SEP, mini-sglang, SEAL and OpenMAIC, pinned to the commits in `repos.json`. 24 graphs, 13 key frames, routes for all four goals.

- `graphs/10_core_three_repos.js` system graphs and drill-ins for SEP, mini-sglang and SEAL (hand layout, custom views for clustering, hidden states, probes, the radix tree, ARC augmenters)
- `graphs/20_openmaic.js` OpenMAIC system, generation pipeline, action parser, slot tree, live Q&A turn, playback timeline, whiteboard check
- `graphs/30_depth_intervention_transfer.js` SEAL knowledge layer, directory view, paper→code, lever previews; OpenMAIC proposal panel; cross-repo patterns; the method graph
- `graphs/90_page.js` page config: interaction mode, frames, routes, experiment cards, transfer panel
- `runs/` every output shown in the page, produced by `runners/` (repo functions run on CPU with stubbed dependencies, or the repo's committed results)

Rebuild: `python3 ../../scripts/build.py . --out index.html` (needs the four clones at the paths in `repos.json`; edit `root` to your clone paths).
The runners have absolute paths from the session that produced them; pass your clone paths as arguments.
