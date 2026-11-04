#!/usr/bin/env python3
"""Build English and Chinese static galleries and lessons under docs/.

Run after build_lesson.py --standalone. Translations live beside each lesson;
source code, prompts and numerical evidence stay in their original language.
"""
import copy
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'examples/lessons'
OUT = ROOT / 'docs'
LESSONS = {'8GNgrZ76qdaTeFEgi7KxBi': 'nanogpt', 'PDskBAyFCCAVC3aRvDDNc3': 'mini-sglang', '3HsvAmpZFrrVyMNX68nVvt': 'swe-agent', '43NgZSnhRwvgQLH6bbyxu3': 'deeptutor', 'AQsXVqiypdzcGMXDicmQZk': 'ai-chatbot'}
BRAND = '`<b>Teachable Code</b> · '
ICON = '<link rel="icon" href="data:,">'
DATA = re.compile(r'(<script type="application/json" id="lesson">)(.*?)(</script>)', re.S)
DISPLAY = {'title', 'question', 'limits', 'folders', 'stage', 'stations', 'objects', 'steps', 'chapter', 'cap', 'plain', 'why', 'tech', 'facts', 'ask', 'q', 'options', 'explain', 'input', 'transform', 'output', 'label', 'note', 'sub', 'text', 'legend', 'log', 'flow', 'layers', 'who', 'items'}


def merge_text(original, translated, path=()):
    if isinstance(original, dict) and isinstance(translated, dict):
        result = copy.deepcopy(original)
        for key, value in translated.items():
            if key not in original:
                raise ValueError(f'unknown translation field: {path + (key,)}')
            dynamic = path == ('folders',) or path[-1:] in (('stations',), ('objects',))
            if key not in DISPLAY and not dynamic:
                raise ValueError(f'translation would change evidence or structure: {key}')
            result[key] = merge_text(original[key], value, path + (key,))
        return result
    if isinstance(original, list) and isinstance(translated, list) and len(original) == len(translated):
        return [merge_text(a, b, path + (str(i),)) for i, (a, b) in enumerate(zip(original, translated))]
    if isinstance(original, str) and isinstance(translated, str) and (translated.strip() or original == translated == ''):
        return translated
    raise ValueError(f'translation must preserve shape and non-text values: {path}')


def chinese_page(page, translation, ui):
    match = DATA.search(page)
    if not match:
        raise ValueError('lesson JSON missing')
    lesson = json.loads(match[2])
    if translation['source_commit'] != lesson['repo']['commit'] or translation['step_titles'] != [s['title'] for s in lesson['steps']]:
        raise ValueError('Chinese text is out of date with the source lesson')
    localized = merge_text(lesson, translation['lesson'])
    localized['lang'] = 'zh-CN'
    notes = dict(zip(lesson.get('folders', {}).values(), localized.get('folders', {}).values()))

    def tree_notes(node):
        if 'note' in node:
            node['note'] = notes.get(node['note'], node['note'])
        for child in node.get('kids', []):
            tree_notes(child)

    tree_notes(localized['tree'])
    before, after = page[:match.start(2)], page[match.end(2):]
    for source, target in ui.items():
        before = before.replace(source, target)
        after = after.replace(source, target)
    before = before.replace('lang="en"', 'lang="zh-CN"').replace(lesson['title'], localized['title'])
    data = json.dumps(localized, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
    return before + data + after


def build():
    ui = json.loads((ROOT / 'assets/lesson/zh-CN.json').read_text())
    gallery_translations = json.loads((SRC / 'gallery.zh-CN.json').read_text())
    source_gallery = (SRC / 'gallery.html').read_text()
    for lang in ('en', 'zh-CN'):
        destination = OUT if lang == 'en' else OUT / 'zh-CN'
        (destination / 'lessons').mkdir(parents=True, exist_ok=True)
        gallery = source_gallery
        if lang == 'zh-CN':
            for source, target in gallery_translations.items():
                if source not in gallery:
                    raise ValueError(f'gallery translation has no source: {source}')
                gallery = gallery.replace(source, target)
        for artifact, name in LESSONS.items():
            link = f'href="https://claude.ai/artifact/{artifact}" target="_blank" rel="noopener"'
            if link not in gallery:
                raise ValueError(f'gallery has no link for {name}')
            gallery = gallery.replace(link, f'href="lessons/{name}.html"')
            page = (SRC / name / 'standalone.html').read_text()
            if lang == 'zh-CN':
                page = chinese_page(page, json.loads((SRC / name / 'zh-CN.json').read_text()), ui)
            if BRAND not in page:
                raise ValueError(f'{name}: gallery back-link insertion point missing')
            other = f'../zh-CN/lessons/{name}.html' if lang == 'en' else f'../../lessons/{name}.html'
            label, tag = ('中文', 'zh-CN') if lang == 'en' else ('English', 'en')
            page = page.replace(BRAND, f'`<a href="../index.html" style="text-decoration:none"><b>← Teachable Code</b></a> · <a href="{other}" onclick="this.hash=location.hash" lang="{tag}">{label}</a> · ')
            page = page.replace('</head>', ICON + '</head>', 1)
            (destination / 'lessons' / (name + '.html')).write_text(page)
        if 'claude.ai/artifact' in gallery:
            raise ValueError('gallery still links to a private artifact')
        other, label = ('zh-CN/index.html', '中文') if lang == 'en' else ('../index.html', 'English')
        gallery = gallery.replace('<div class="brand">Teachable Code</div>', f'<div class="brand">Teachable Code · <a href="{other}" style="color:inherit">{label}</a> · <a href="https://github.com/ywEdAi/teachable-code" style="color:inherit">GitHub</a></div>')
        gallery = f'<!doctype html><html lang="{lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">{ICON}</head><body>{gallery}</body></html>'
        (destination / 'index.html').write_text(gallery)
    (OUT / '.nojekyll').touch()
    print('Built 2 galleries and 10 lessons under docs/')


if __name__ == '__main__':
    build()
