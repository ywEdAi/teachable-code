#!/usr/bin/env python3
"""Build the static demo site for GitHub Pages: docs/index.html plus one page per lesson.

usage: build_site.py   (run after build_lesson.py --standalone for each lesson)
Copies each lesson's standalone.html to docs/lessons/, and points the gallery at those copies with relative links,
so the site works at any address. The pages load fonts and Three.js from public CDNs.
"""
import os, re
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."); SRC = os.path.join(ROOT, "examples", "lessons"); OUT = os.path.join(ROOT, "docs")
LESSONS = {"8GNgrZ76qdaTeFEgi7KxBi": "nanogpt", "PDskBAyFCCAVC3aRvDDNc3": "mini-sglang", "3HsvAmpZFrrVyMNX68nVvt": "swe-agent", "43NgZSnhRwvgQLH6bbyxu3": "deeptutor", "AQsXVqiypdzcGMXDicmQZk": "ai-chatbot"}
BRAND = "`<b>Teachable Code</b> · "; ICON = '<link rel="icon" href="data:,">'
os.makedirs(os.path.join(OUT, "lessons"), exist_ok=True); open(os.path.join(OUT, ".nojekyll"), "w").close()
g = open(os.path.join(SRC, "gallery.html"), encoding="utf-8").read(); seen = 0
for art, name in LESSONS.items():
    a = f'href="https://claude.ai/artifact/{art}" target="_blank" rel="noopener"'
    if a not in g: raise SystemExit(f"gallery has no link for {name}")
    g = g.replace(a, f'href="lessons/{name}.html"'); seen += 1
    page = open(os.path.join(SRC, name, "standalone.html"), encoding="utf-8").read()
    if BRAND not in page: raise SystemExit(f"{name}: brand text not found, so no way back to the gallery")
    page = page.replace(BRAND, '`<a href="../index.html" style="text-decoration:none"><b>← Teachable Code</b></a> · ')
    page = page.replace("</head>", ICON + "</head>", 1)
    open(os.path.join(OUT, "lessons", name + ".html"), "w", encoding="utf-8").write(page)
if "claude.ai/artifact" in g: raise SystemExit("gallery still links to a private page")
desc = "Interactive lessons that follow one piece of data through a real codebase, with the whole system always on screen."
g = f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="description" content="{desc}">{ICON}</head><body>{g}</body></html>'
open(os.path.join(OUT, "index.html"), "w", encoding="utf-8").write(g)
print(f"docs/index.html and {seen} lessons")
