"""Preserve an incoming storyboard and render a complete readable Markdown copy."""
import json
import shutil
import sys
from pathlib import Path

source = Path(sys.argv[1])
story = json.loads(source.read_text(encoding='utf-8'))
slug = story['project']['slug']
target = Path('stories') / f'{slug}.json'
target.parent.mkdir(exist_ok=True)
if source.resolve() != target.resolve():
    shutil.copyfile(source, target)

def label(s):
    return s.replace('_', ' ').capitalize()

def render(value, level=2):
    if isinstance(value, dict):
        result = []
        for k, v in value.items():
            if isinstance(v, (dict, list)):
                result += [f'{"#" * min(level, 6)} {label(k)}', '', render(v, level + 1), '']
            else:
                result += [f'**{label(k)}:** {v}', '']
        return '\n'.join(result)
    if isinstance(value, list):
        return '\n\n'.join(render(v, level) if isinstance(v, dict) else f'- {v}' for v in value)
    return str(value)

markdown = f'# {story["project"]["title"]}\n\nSource storyboard: `stories/{slug}.json`\n\n' + render(story)
destination = Path('metadata') / f'{slug}.storyboard.md'
destination.write_text(markdown, encoding='utf-8')
(Path('metadata') / f'{slug}.md').write_text(markdown, encoding='utf-8')
print(f'Created {target} and {destination}; initial metadata Markdown also written.')
