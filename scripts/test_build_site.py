import copy
import json
from pathlib import Path
import re
import unittest

import build_site as site


def evidence(value):
    if isinstance(value, dict):
        return {k: evidence(v) for k, v in value.items() if k not in ('label', 'note')}
    if isinstance(value, list):
        return [evidence(v) for v in value]
    return value


def numbers(value):
    if isinstance(value, dict):
        return {k: numbers(v) for k, v in value.items() if numbers(v) is not None}
    if isinstance(value, list):
        return [numbers(v) for v in value]
    return value if isinstance(value, (int, float, bool)) else None


class SiteTests(unittest.TestCase):
    def test_chinese_lessons_keep_the_original_evidence(self):
        ui = json.loads((site.ROOT / 'assets/lesson/zh-CN.json').read_text())
        for name in site.LESSONS.values():
            with self.subTest(lesson=name):
                page = (site.SRC / name / 'standalone.html').read_text()
                translation = json.loads((site.SRC / name / 'zh-CN.json').read_text())
                original = json.loads(site.DATA.search(page)[2])
                built = site.chinese_page(page, translation, ui)
                zh = json.loads(site.DATA.search(built)[2])
                self.assertEqual(original['repo'], zh['repo'])
                self.assertEqual(numbers(original), numbers(zh))
                self.assertIn('lang="zh-CN"', built)
                self.assertIn('项目目录', built)
                for en_step, zh_step in zip(original['steps'], zh['steps']):
                    self.assertRegex(zh_step['title'], r'[\u4e00-\u9fff]')
                    self.assertEqual(en_step['code'], zh_step['code'])
                    for field in ('input', 'output'):
                        self.assertEqual(evidence(en_step[field]), evidence(zh_step[field]))
                for path in re.findall(r'(?:href|src)="([^"#]+)', (site.OUT / 'zh-CN/lessons' / (name + '.html')).read_text()):
                    if path.startswith(('http', 'data:', '${')):
                        continue
                    self.assertTrue((site.OUT / 'zh-CN/lessons' / path.split('${')[0]).exists(), path)

    def test_stale_translation_is_rejected(self):
        page = (site.SRC / 'mini-sglang/standalone.html').read_text()
        translation = json.loads((site.SRC / 'mini-sglang/zh-CN.json').read_text())
        for field, value in [('source_commit', 'wrong'), ('step_titles', [])]:
            bad = copy.deepcopy(translation)
            bad[field] = value
            with self.assertRaisesRegex(ValueError, 'out of date'):
                site.chinese_page(page, bad, {})

    def test_translation_cannot_change_code_or_data_shapes(self):
        with self.assertRaisesRegex(ValueError, 'evidence or structure'):
            site.merge_text({'repo': {'url': 'original'}}, {'repo': {'url': 'changed'}})
        with self.assertRaisesRegex(ValueError, 'preserve shape'):
            site.merge_text({'steps': ['one', 'two']}, {'steps': ['one']})
        with self.assertRaisesRegex(ValueError, 'preserve shape'):
            site.merge_text({'facts': [7]}, {'facts': [9]})


if __name__ == '__main__':
    unittest.main()
