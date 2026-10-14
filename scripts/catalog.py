"""Registry usage and cumulative publishing catalogs, written only after successful media QA."""
from datetime import datetime, timezone
import json
from pathlib import Path
import re


def write_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False)+'\n', encoding='utf8')


def catalog_entry(meta: dict) -> str:
    slug = meta['slug']
    lines = [f"## {meta['topic']}", f'**Video:** `output/{slug}.mp4`  ',
             f'**Thumbnail:** `output/{slug}.jpg`  ', f'**Publishing copy:** `output/{slug}.md`  ']
    hf = meta.get('huggingface', {})
    links = [f'[{hf[p]}]({hf[u]})' for p, u in [('path_in_repo', 'url'), ('thumbnail_path_in_repo', 'thumbnail_url'), ('copy_path_in_repo', 'copy_url')] if hf.get(u) and hf.get(p)]
    if links: lines.append('**Hugging Face:** '+' · '.join(links)+'  ')
    lines += [f"**Slug:** `{slug}` | **Duration:** {meta['duration_s']}s | **Rendered (UTC):** {meta['rendered_at_utc']}  ",
              f"**Publishing:** {meta.get('publishing_status', 'rendered_not_published')}  ",
              f"**Scientific accuracy note:** {meta.get('scientific_scope_note', '')}",
              f"**Assets reused:** {', '.join(meta.get('reused_asset_ids', []))}  ",
              f"**Assets created:** {', '.join(meta.get('created_asset_ids', [])) or 'None'}", '']
    names = {'youtube_shorts':'YouTube Shorts', 'instagram_reels':'Instagram Reels', 'facebook_reels':'Facebook Reels', 'tiktok':'TikTok', 'x_video':'X'}
    for key, name in names.items():
        p = meta['platforms'].get(key, {})
        lines += [f'### {name}', '']
        if p.get('title'): lines += ['**Title — copy:**', '```text', p['title'], '```', '']
        body = p.get('description') or p.get('caption') or p.get('post') or ''
        lines += ['**Description / caption + hashtags — copy:**', '```text', body, '', ' '.join(p.get('hashtags', [])), '```', '']
        if p.get('tags'): lines += ['**Tags — comma-separated, copy:**', '```text', ', '.join(p['tags']), '```', '']
        lines += [f"**Target search keywords:** {', '.join(p.get('keywords', []))}", '',
                  f"**Published URL:** {meta.get('published_urls', {}).get(key) or 'Not published'}", '']
    # Backslash hard breaks preserve Markdown layout without trailing whitespace in generated diffs.
    return '\n'.join(line.rstrip() + ('\\' if line.endswith('  ') else '') for line in lines)+'\n\n---\n'


def finalize_catalogs(root: Path, story: dict, meta: dict) -> None:
    slug = story['project']['slug']
    # The caller has already probed this MP4. Never invent a render record before that check succeeds.
    if not meta.get('rendered_at_utc'):
        meta['rendered_at_utc'] = datetime.fromtimestamp((root/'output'/f'{slug}.mp4').stat().st_mtime, timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')
    meta['publishing_status'] = 'published' if meta.get('published_urls') else 'rendered_not_published'
    write_json(root/'metadata'/f'{slug}.json', meta)

    registry_path = root/'assets/registry.json'
    registry = json.loads(registry_path.read_text(encoding='utf8'))
    used = set(meta.get('reused_asset_ids', []) + meta.get('created_asset_ids', []))
    known = {a['id'] for a in registry['assets']}
    if used - known: raise ValueError(f'Cannot finalize unregistered asset IDs: {sorted(used-known)}')
    for a in registry['assets']:
        if a['id'] in used: a['used_in'] = sorted(set(a.get('used_in', [])) | {slug})
    write_json(registry_path, registry)

    lines = ['# Reusable Three.js Asset Library', '', 'Registry source of truth: `assets/registry.json`. Only verified, genuinely reusable source files are registered.',
             'Coding agents should search IDs/tags here **before** creating new geometry, shaders, camera rigs or audio.', '',
             '| Asset ID | Purpose | Location | Created for | Used in | License |', '|---|---|---|---|---|---|']
    assets = sorted(registry['assets'], key=lambda a:a['id'])
    for a in assets:
        lines.append(f"| `{a['id']}` | {a['name']} | `{a.get('source_path', '')}` | `{a.get('created_for', '')}` | {', '.join('`'+s+'`' for s in a.get('used_in', []))} | {a.get('license', '')} |")
    lines += ['', '---', '']
    for a in assets:
        lines += [f"### `{a['id']}` — {a['name']}", '', a.get('description', ''), '',
                  '**Tags:** '+', '.join(a.get('tags', [])), '**Parameters:** '+', '.join(a.get('configurable_parameters', [])), '**Notes:** '+a.get('notes', ''), '']
    (root/'ASSET_LIBRARY.md').write_text('\n'.join(lines), encoding='utf8')

    # Replace only this video's section and table row, preserving all existing historical catalog entries.
    catalog_path = root/'VIDEO_CATALOG.md'
    text = catalog_path.read_text(encoding='utf8') if catalog_path.exists() else '# What-If Shorts — Video Catalog\n\n| Rendered (UTC) | Video | Length | Publishing | Upload metadata |\n|---|---|---:|---|---|\n\n---\n'
    text = re.sub(r'^\|[^\n]*`'+re.escape(slug)+r'`[^\n]*\n', '', text, flags=re.M)
    divider = '|---|---|---:|---|---|'
    row = f"| {meta['rendered_at_utc'][:10]} | `{slug}` | {meta['duration_s']}s | {meta['publishing_status']} | [Copy metadata](metadata/{slug}.md) |"
    text = text.replace(divider, divider+'\n'+row, 1)
    parts = text.split('\n## ')
    head, sections = parts[0], []
    for s in parts[1:]:
        if f'**Slug:** `{slug}`' not in s: sections.append('\n## '+s)
    text = head + '\n'+catalog_entry(meta) + ''.join(sections)
    catalog_path.write_text(text, encoding='utf8')
