#!/usr/bin/env python3
"""Play every scenario of every graph headless, screenshot every key frame, and check phone width + dark mode.

usage: check.py page.html --shots DIR [--frames-only]
Exit code 1 when any page error, console error/warning, or horizontal overflow at 400px is found.
Writes DIR/report.json and DIR/frame-XX-<id>.png, DIR/onboarding.png, DIR/dark.png, DIR/phone.png.
Needs Python Playwright with Chromium.
"""
import argparse, json, os, sys
from playwright.sync_api import sync_playwright

ap = argparse.ArgumentParser(); ap.add_argument("html"); ap.add_argument("--shots", required=True); ap.add_argument("--frames-only", action="store_true")
a = ap.parse_args(); os.makedirs(a.shots, exist_ok=True)
body = open(a.html).read()
wrapped = os.path.join(a.shots, "_page.html")
open(wrapped, "w").write("<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'></head><body>" + body + "</body></html>")
url = "file://" + os.path.abspath(wrapped)
report = {"graphs": {}, "frames": [], "errors": []}

def watch(pg):
    pg.on("pageerror", lambda e: report["errors"].append("pageerror: " + str(e)))
    pg.on("console", lambda m: m.type in ("error", "warning") and "ERR_TUNNEL" not in m.text and "net::" not in m.text and report["errors"].append(f"{m.type}: {m.text}"))

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1440, "height": 1000}); watch(pg)
    pg.goto(url); pg.wait_for_timeout(700)
    if pg.evaluate("!document.getElementById('onb').hidden"): pg.screenshot(path=os.path.join(a.shots, "onboarding.png"))
    pg.evaluate("document.getElementById('onb').hidden = true; predictOn = false;")
    if not a.frames_only:
        for gid in pg.evaluate("Object.keys(GRAPHS)"):
            pg.evaluate(f"stack = pathTo({json.dumps(gid)}); load({json.dumps(gid)}); speed = 8")
            n = pg.evaluate("player ? player.names.length : 0"); played = []
            for si in range(n):
                pg.evaluate(f"player.select({si})")
                steps = pg.evaluate("async () => { let k = 0; while (!player.done() && k++ < 120) await player.step(); return k; }")
                played.append(steps)
            report["graphs"][gid] = {"scenarios": n, "steps": played}
            print(f"{gid:22s} scenarios {n:2d}  steps {played}")
    pg.evaluate("speed = 1")
    for i, f in enumerate(pg.evaluate("FRAMES.map(f => f.id)")):
        pg.evaluate(f"openFrame({i})"); pg.wait_for_timeout(450)
        shot = os.path.join(a.shots, f"frame-{i+1:02d}-{f}.png"); pg.screenshot(path=shot); report["frames"].append(shot)
    dk = b.new_page(viewport={"width": 1440, "height": 1000}, color_scheme="dark"); watch(dk)
    dk.goto(url + "#seal"); dk.wait_for_timeout(600); dk.screenshot(path=os.path.join(a.shots, "dark.png"))
    ph = b.new_page(viewport={"width": 400, "height": 860}); watch(ph)
    ph.goto(url); ph.wait_for_timeout(600); ph.screenshot(path=os.path.join(a.shots, "phone.png"))
    report["phone_scroll_width"] = ph.evaluate("document.documentElement.scrollWidth")
    b.close()
os.remove(wrapped)
if report["phone_scroll_width"] > 400: report["errors"].append(f"horizontal overflow at 400px: {report['phone_scroll_width']}")
json.dump(report, open(os.path.join(a.shots, "report.json"), "w"), indent=1)
print(f"frames {len(report['frames'])} · errors {len(report['errors'])}")
for e in report["errors"][:20]: print("  -", e)
sys.exit(1 if report["errors"] else 0)
