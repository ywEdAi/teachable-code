#!/usr/bin/env python3
"""Play every step of a built lesson in a real browser. Checks that it renders, that every part of the map stays on
stage, that it fits one screen, and that zooming and clicking respond. Proves it runs, not that it teaches.

usage: check_lesson.py index.html --shots DIR
Uses Playwright with the installed Chrome if there is one, otherwise Playwright's Chromium.
"""
import argparse, os, sys, tempfile
from playwright.sync_api import sync_playwright
ap = argparse.ArgumentParser(); ap.add_argument("page"); ap.add_argument("--shots"); a = ap.parse_args(); p0 = os.path.abspath(a.page); errs = []
body = open(p0, encoding="utf-8").read(); tmp = tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, encoding="utf-8")
tmp.write(body if body.lstrip().lower().startswith("<!doctype") else '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + body + "</body></html>"); tmp.close()
PAINTED = """() => { const c=document.querySelector('#stage canvas'); if(!c) return document.querySelectorAll('#stage svg g[opacity="1"]').length>0?999:0;
  const t=document.createElement('canvas'); t.width=120;t.height=70; const x=t.getContext('2d'); x.drawImage(c,0,0,120,70); const d=x.getImageData(0,0,120,70).data; const s=new Set(); for(let i=0;i<d.length;i+=16){ if(d[i+3]>10) s.add(d[i]>>3|(d[i+1]>>3)<<5|(d[i+2]>>3)<<10);} return s.size; }"""
with sync_playwright() as p:
    try: b = p.chromium.launch(channel="chrome", args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    except Exception: b = p.chromium.launch(args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width": 1440, "height": 860}); pg.on("pageerror", lambda e: errs.append("page error: " + str(e))); pg.on("console", lambda m: m.type == "error" and errs.append("console: " + m.text[:160]))
    pg.goto("file://" + tmp.name, wait_until="domcontentloaded", timeout=90000); pg.wait_for_function("window.__lesson", timeout=90000); info = pg.evaluate("({n:__lesson.count,mode:__lesson.mode,ok:__lesson.has3d})")
    if not info["ok"]: errs.append("stage did not start")
    # the first frame can take seconds on software WebGL while shaders compile
    for _ in range(40):
        if pg.evaluate(PAINTED) >= 4: break
        pg.wait_for_timeout(500)
    for i in range(info["n"]):
        pg.evaluate(f"__lesson.go({i})"); pg.wait_for_timeout(900 if info["mode"] == "3d" else 700); c = pg.evaluate(PAINTED)
        if c < 4: errs.append(f"step {i+1}: stage looks blank ({c} colours)")
        for side in ("input", "output"):
            if not pg.evaluate("[...document.querySelectorAll('#io .iobox')].every(x=>x.innerText.trim().length>12)"): errs.append(f"step {i+1}: empty {side}"); break
        if a.shots: os.makedirs(a.shots, exist_ok=True); pg.screenshot(path=os.path.join(a.shots, f"step-{i+1:02d}.png"))
    # F022: the whole map stays, one screen, and the canvas answers
    fits = """() => { const de=document.documentElement, bad=['rail','logbox','stagewrap','side','io','ctl'].filter(i=>{const r=document.getElementById(i).getBoundingClientRect(); return r.top<-1||r.bottom>innerHeight+1||r.left<-1||r.right>innerWidth+1||r.height<40}); return {sh:de.scrollHeight,h:innerHeight,bad}; }"""
    nst = pg.evaluate("__lesson.stations.length")
    for i in range(info["n"]):
        pg.evaluate(f"__lesson.go({i})"); on = pg.evaluate("__lesson.stage.onMap().length")
        if on != nst: errs.append(f"step {i+1}: {on} of {nst} parts on the map")
    for w, h in ((1440, 860), (1280, 720)):
        pg.set_viewport_size({"width": w, "height": h}); pg.wait_for_timeout(400); r = pg.evaluate(fits)
        if r["sh"] > r["h"] or r["bad"]: errs.append(f"{w}x{h}: page scrolls or panels are cut off {r}")
    pg.set_viewport_size({"width": 1440, "height": 860}); pg.evaluate(f"__lesson.go(0)"); pg.wait_for_timeout(1200)
    z0 = pg.evaluate("__lesson.stage.viewScale()"); box = pg.locator("#stagewrap").bounding_box(); pg.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2); pg.mouse.wheel(0, -500); pg.wait_for_timeout(300); z1 = pg.evaluate("__lesson.stage.viewScale()")
    if not z1 < z0: errs.append(f"wheel did not zoom ({z0} to {z1})")
    pg.click("#zFit"); pg.wait_for_timeout(1500)
    tried = 0
    for k in pg.evaluate("__lesson.stations"):
        x, y = pg.evaluate(f"__lesson.stage.screenOf({k!r})"); pg.mouse.click(x, y); pg.wait_for_timeout(150); tried += 1; t = pg.inner_text("#side")
        if "PART OF THE SYSTEM" not in t: errs.append(f"clicking part {k} opened nothing"); continue
        if "PROJECT FILES" not in t: errs.append(f"part {k}: no files listed")
    pg.keyboard.press("Escape")
    f = pg.evaluate("[...new Set(Object.values(__lesson.stations))][0]")
    links = pg.evaluate("document.querySelectorAll('.tree .f:not(.quiet)').length")
    if not links: errs.append("folder shows no linked files")
    pg.locator(".tree .f:not(.quiet)").first.click(); pg.wait_for_timeout(150)
    if "PROJECT FILE" not in pg.inner_text("#side"): errs.append("clicking a file opened nothing")
    pg.keyboard.press("Escape")
    if a.shots: pg.screenshot(path=os.path.join(a.shots, "final.png"))
    ph = b.new_page(viewport={"width": 400, "height": 860}); ph.goto("file://" + tmp.name, wait_until="domcontentloaded", timeout=90000); ph.wait_for_function("window.__lesson", timeout=90000); ph.wait_for_timeout(1200)
    w = ph.evaluate("document.documentElement.scrollWidth")
    if w > 400: errs.append(f"horizontal overflow at 400px: {w}")
    if a.shots: ph.screenshot(path=os.path.join(a.shots, "phone.png"))
    b.close()
os.unlink(tmp.name); print(f"{info['mode']} · {info['n']} steps · errors {len(errs)}"); [print("  -", e) for e in errs]; sys.exit(1 if errs else 0)
