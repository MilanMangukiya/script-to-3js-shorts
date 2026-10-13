#!/usr/bin/env python3
"""After a REAL MP4 render, validate handoff metadata and rebuild persistent indexes.

Usage: python scripts/finalize_video.py moon-half-distance
Requires metadata/<slug>.json and a real output/<slug>.mp4; never creates fake video entries.
Writes output/<slug>.md, the video's ready-to-paste publishing copy (uploaded to Hugging Face as <NNN>-<slug>.md).
The film being finalized must follow the copy rules: 5-15 hashtags per platform, and every platform's title (the
caption's or post's opening line where a platform has no title) starts with "What if".
Stdlib only; ffprobe must be installed, as already required for rendering.
"""
from __future__ import annotations

import datetime as dt
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / 'assets/registry.json'
META = ROOT / 'metadata'
SLUG_RE = re.compile(r'^[a-z0-9]+(?:-[a-z0-9]+)*$')
PLATFORMS = ('youtube_shorts', 'instagram_reels', 'facebook_reels', 'tiktok', 'x_video')
TITLES = {'youtube_shorts': 'YouTube Shorts', 'instagram_reels': 'Instagram Reels',
          'facebook_reels': 'Facebook Reels', 'tiktok': 'TikTok', 'x_video': 'X'}
# Copy rules for every film finalized from now on (older catalog entries are only checked structurally).
HASHTAGS_MIN, HASHTAGS_MAX = 5, 15
TITLE_PREFIX = 'What if'


def require(test: bool, why: str) -> None:
    if not test:
        raise ValueError(why)


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding='utf-8'))


def write_json(path: Path, obj: dict) -> None:
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def txt(v: object, field: str) -> str:
    require(isinstance(v, str) and bool(v.strip()), f'Missing/nonempty text required: {field}')
    return v.strip()


def array(v: object, field: str, min_count: int = 0) -> list[str]:
    require(isinstance(v, list) and len(v) >= min_count, f'{field} must contain at least {min_count} entries')
    values = [txt(x, field) for x in v]
    require(len(values) == len(set(values)), f'Duplicate values in {field}')
    return values


def relative_file(value: str, prefix: str, must_exist: bool = True) -> Path:
    require(value.startswith(prefix) and '\\' not in value, f'Invalid relative path {value}')
    p = (ROOT / value).resolve()
    require(p.is_relative_to(ROOT), f'Path escapes repo: {value}')
    if must_exist:
        require(p.is_file(), f'File not found: {value}')
    return p


def validate_meta(m: dict, slug: str, known_assets: set[str], copy_rules: bool = False) -> None:
    require(m.get('schema_version') == '1.0.0', f'{slug}: metadata schema_version must be 1.0.0')
    require(m.get('slug') == slug and bool(SLUG_RE.fullmatch(slug)), f'{slug}: invalid slug')
    txt(m.get('topic'), f'{slug}.topic')
    txt(m.get('scientific_scope_note'), f'{slug}.scientific_scope_note')
    require(isinstance(m.get('duration_s'), (int, float)) and 45 <= m['duration_s'] <= 90,
            f'{slug}: duration_s not 45–90')
    require(m.get('video_file') == f'output/{slug}.mp4', f'{slug}: wrong video_file')
    require(m.get('publishing_status') in (None, 'rendered_not_published', 'partially_published', 'published'),
            f'{slug}: invalid publishing_status')
    reused = array(m.get('reused_asset_ids', []), f'{slug}.reused_asset_ids')
    created = array(m.get('created_asset_ids', []), f'{slug}.created_asset_ids')
    require(not (set(reused) & set(created)), f'{slug}: created/reused assets overlap')
    require(set(reused + created).issubset(known_assets), f'{slug}: references unregistered assets: {set(reused+created)-known_assets}')
    published = m.get('published_urls', {})
    require(isinstance(published, dict) and set(published).issubset(PLATFORMS), f'{slug}: invalid published_urls')
    for p, url in published.items():
        require(url is None or (isinstance(url, str) and url.startswith('https://')),
                f'{slug}: bad published URL for {p}')
    ps = m.get('platforms')
    require(isinstance(ps, dict) and set(ps) == set(PLATFORMS), f'{slug}: all five platform metadata entries required')
    for p in PLATFORMS:
        d = ps[p]
        require(isinstance(d, dict), f'{slug}.{p} must be an object')
        if p == 'youtube_shorts':
            require(len(txt(d.get('title'), f'{p}.title')) <= 100, 'YouTube title exceeds 100 chars')
            txt(d.get('description'), f'{p}.description')
            array(d.get('tags'), f'{p}.tags', 5)
        elif p == 'facebook_reels':
            txt(d.get('title'), f'{p}.title')
            txt(d.get('description'), f'{p}.description')
        elif p == 'x_video':
            txt(d.get('post'), f'{p}.post')
        else:
            txt(d.get('caption'), f'{p}.caption')
        hashtags = array(d.get('hashtags'), f'{p}.hashtags', 1)
        require(all(h.startswith('#') and ' ' not in h for h in hashtags), f'{slug}.{p}: invalid hashtag')
        array(d.get('keywords'), f'{p}.keywords', 4)
        if p == 'x_video':
            ready = d['post'].rstrip() + '\n' + ' '.join(hashtags)
            require(len(ready) <= 280, f'{slug}: X post + hashtags exceeds 280 characters ({len(ready)})')
        if copy_rules:
            require(HASHTAGS_MIN <= len(hashtags) <= HASHTAGS_MAX,
                    f'{slug}.{p}: use {HASHTAGS_MIN}-{HASHTAGS_MAX} hashtags (found {len(hashtags)})')
            # Platforms without a title field open their caption or post with the "What if" line instead.
            titled = p in ('youtube_shorts', 'facebook_reels')
            head = d['title'] if titled else d['post' if p == 'x_video' else 'caption']
            require(head.lstrip().startswith(TITLE_PREFIX),
                    f'{slug}.{p}: the {"title" if titled else "opening line"} must start with "{TITLE_PREFIX}"')
    hf = m.get('huggingface')   # optional archive record written by scripts/upload_to_hf.py
    if hf is not None:
        require(isinstance(hf, dict) and str(hf.get('url', '')).startswith('https://huggingface.co/'),
                f'{slug}: invalid huggingface upload record')
        txt(hf.get('path_in_repo'), f'{slug}.huggingface.path_in_repo')
        require(hf.get('thumbnail_url') is None or str(hf['thumbnail_url']).startswith('https://huggingface.co/'),
                f'{slug}: invalid huggingface thumbnail link')
        require(hf.get('copy_url') is None or str(hf['copy_url']).startswith('https://huggingface.co/'),
                f'{slug}: invalid huggingface publishing-copy link')
    # Publishing status is derived from actual URLs rather than trusting a suggested label.


def probe_video(filename: Path, expected_seconds: float) -> None:
    require(filename.is_file() and filename.stat().st_size > 1024,
            f'MP4 does not exist or is too small: {filename}')
    try:
        cmd = ['ffprobe', '-v', 'error', '-show_entries',
               'format=duration:stream=codec_type,codec_name,width,height,r_frame_rate,sample_rate',
               '-of', 'json', str(filename)]
        proc = subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=30)
        doc = json.loads(proc.stdout)
    except (FileNotFoundError, subprocess.CalledProcessError, subprocess.TimeoutExpired, json.JSONDecodeError) as exc:
        raise ValueError(f'ffprobe failed; completed MP4 not verified: {exc}') from exc
    video = next((s for s in doc.get('streams', []) if s.get('codec_type') == 'video'), None)
    audio = next((s for s in doc.get('streams', []) if s.get('codec_type') == 'audio'), None)
    require(video is not None and audio is not None, 'MP4 needs both video and audio streams')
    require(video.get('codec_name') == 'h264' and video.get('width') == 1080
            and video.get('height') == 1920 and video.get('r_frame_rate') == '30/1',
            'MP4 video codec, dimensions or frame rate wrong')
    require(audio.get('codec_name') == 'aac' and audio.get('sample_rate') == '48000',
            'MP4 audio codec or sample rate wrong')
    try:
        duration = float(doc['format']['duration'])
    except (ValueError, KeyError, TypeError) as exc:
        raise ValueError('MP4 duration missing') from exc
    require(abs(duration - expected_seconds) <= 0.50,
            f'MP4 actual runtime {duration:.2f}s disagrees with storyboard {expected_seconds}s')


def jpeg_size(path: Path) -> tuple[int, int] | None:
    """(width, height) from a JPEG's start-of-frame marker, or None if it is not a readable JPEG."""
    data = path.read_bytes()
    if data[:2] != b'\xff\xd8':
        return None
    i = 2
    while i + 9 < len(data):
        if data[i] != 0xFF:
            i += 1
            continue
        marker = data[i + 1]
        if marker in (0xD8, 0x01, 0xFF) or 0xD0 <= marker <= 0xD7:
            i += 2 if marker != 0xFF else 1
            continue
        if marker in (0xC0, 0xC1, 0xC2):
            return int.from_bytes(data[i + 7:i + 9], 'big'), int.from_bytes(data[i + 5:i + 7], 'big')
        i += 2 + int.from_bytes(data[i + 2:i + 4], 'big')
    return None


def check_thumbnail(slug: str, width: int, height: int) -> None:
    thumb = ROOT / f'output/{slug}.jpg'
    require(thumb.is_file(), f'Thumbnail missing: output/{slug}.jpg (create it with: node tools/render.mjs {slug} --thumbnail)')
    require(jpeg_size(thumb) == (width, height), f'Thumbnail must be a {width}x{height} JPEG: output/{slug}.jpg')
    require(thumb.stat().st_size <= 2_000_000, f'Thumbnail is over 2 MB (YouTube limit): output/{slug}.jpg')


def checked_registry() -> dict:
    r = read_json(REGISTRY)
    require(r.get('registry_version') == '1.0.0' and isinstance(r.get('assets'), list), 'Registry invalid')
    ids = set()
    for a in r['assets']:
        asset_id = txt(a.get('id'), 'asset.id')
        require(bool(SLUG_RE.fullmatch(asset_id)) and asset_id not in ids, f'Duplicate/invalid asset id {asset_id}')
        ids.add(asset_id)
        txt(a.get('name'), f'{asset_id}.name')
        txt(a.get('description'), f'{asset_id}.description')
        txt(a.get('license'), f'{asset_id}.license')
        txt(a.get('created_for'), f'{asset_id}.created_for')
        relative_file(txt(a.get('source_path'), f'{asset_id}.source_path'), 'src/library/' if str(a.get('source_path', '')).startswith('src/library/') else 'assets/library/')
        require(isinstance(a.get('tags'), list), f'{asset_id}.tags must be list')
        require(isinstance(a.get('configurable_parameters'), list), f'{asset_id}.configurable_parameters must be list')
        require(isinstance(a.get('used_in'), list), f'{asset_id}.used_in must be list')
    return r


def fence(body: str) -> str:
    # Indented headings and code fences provide copyable literal text. Prevent malformed fences.
    fence_marker = '~~~~' if '```' in body else '```'
    return f'{fence_marker}text\n{body.strip()}\n{fence_marker}'


def hashtags(d: dict) -> str:
    return ' '.join(d['hashtags'])


def metadata_section(m: dict) -> str:
    hf = m.get('huggingface') or {}
    s = [f'## {m["topic"]}',
         f'**Video:** `{m["video_file"]}`  ',
         *([f'**Thumbnail:** `{m["video_file"][:-4]}.jpg`  '] if (ROOT / f'{m["video_file"][:-4]}.jpg').is_file() else []),
         *([f'**Publishing copy:** `{m["video_file"][:-4]}.md`  '] if (ROOT / f'{m["video_file"][:-4]}.md').is_file() else []),
         *([f'**Hugging Face:** [{hf["path_in_repo"]}]({hf["url"]})'
             + (f' · [{hf["thumbnail_path_in_repo"]}]({hf["thumbnail_url"]})' if hf.get('thumbnail_url') else '')
             + (f' · [{hf["copy_path_in_repo"]}]({hf["copy_url"]})' if hf.get('copy_url') else '')
             + f' ({hf["repo_id"]})  '] if hf.get('url') else []),
         f'**Slug:** `{m["slug"]}` | **Duration:** {m["duration_s"]}s | **Rendered (UTC):** {m["rendered_at_utc"]}  ',
         f'**Publishing:** {m["publishing_status"]}  ',
         f'**Scientific accuracy note:** {m["scientific_scope_note"]}',
         f'**Assets reused:** {", ".join(m.get("reused_asset_ids", [])) or "None yet"}  ',
         f'**Assets created:** {", ".join(m.get("created_asset_ids", [])) or "None registered"}',
         '']
    for p in PLATFORMS:
        d = m['platforms'][p]
        s.append(f'### {TITLES[p]}')
        if p in ('youtube_shorts','facebook_reels'):
            s.extend(['**Title — copy:**', fence(d['title']), ''])
        if p == 'youtube_shorts':
            s.extend(['**Description + hashtags — copy:**', fence(d['description'] + '\n\n' + hashtags(d)),
                      '', '**YouTube tags — comma-separated, copy:**', fence(', '.join(d['tags'])), ''])
        elif p == 'facebook_reels':
            s.extend(['**Description + hashtags — copy:**', fence(d['description'] + '\n\n' + hashtags(d)), ''])
        elif p == 'x_video':
            s.extend(['**Post + hashtags — copy:**', fence(d['post'] + '\n' + hashtags(d)), ''])
        else:
            s.extend(['**Caption + hashtags — copy:**', fence(d['caption'] + '\n\n' + hashtags(d)), ''])
        s.extend(['**Target search keywords (research/reference):** ' + ', '.join(d['keywords']), ''])
        url = m['published_urls'].get(p)
        s.append(f'**Published URL:** {url if url else "Not published"}')
        s.append('')
    return '\n'.join(s).rstrip()


def publishing_kit(m: dict) -> str:
    """output/<slug>.md: every platform's ready-to-paste copy for one video (uploaded as <NNN>-<slug>.md). It holds no
    paths, statuses or links, so it changes only when the copy changes and is not re-uploaded otherwise."""
    s = [f'# {m["topic"]}', '',
         f'Ready-to-paste publishing copy for `{m["slug"]}` ({m["duration_s"]} s). Copy each block as it is.', '']
    for p in PLATFORMS:
        d = m['platforms'][p]
        tags = hashtags(d)
        s += [f'## {TITLES[p]}', '']
        if p in ('youtube_shorts', 'facebook_reels'):
            s += ['**Title**', fence(d['title']), '']
        if p == 'youtube_shorts':
            s += ['**Description + hashtags**', fence(d['description'] + '\n\n' + tags), '',
                  '**Tags** (comma-separated, for the tags box)', fence(', '.join(d['tags'])), '']
        elif p == 'facebook_reels':
            s += ['**Description + hashtags**', fence(d['description'] + '\n\n' + tags), '']
        elif p == 'x_video':
            post = d['post'].rstrip() + '\n' + tags
            s += [f'**Post + hashtags** ({len(post)}/280 characters)', fence(post), '']
        else:
            s += ['**Caption + hashtags**', fence(d['caption'] + '\n\n' + tags), '']
        s += [f'**Hashtags only** ({len(d["hashtags"])})', fence(tags), '',
              '**Search keywords:** ' + ', '.join(d['keywords']), '']
    s += ['## Accuracy note', '', m['scientific_scope_note']]
    return '\n'.join(s).rstrip() + '\n'


def write_catalog(metas: list[dict]) -> None:
    header = ['# What-If Shorts — Video Catalog', '',
              'This is a cumulative, **copy-paste upload guide**, generated only for videos with verified render records. '
              'Edit `metadata/<slug>.json` to add published URLs; rerun `python scripts/finalize_video.py <slug>` to refresh.', '']
    if not metas:
        header.append('No completed videos have been registered yet.')
    else:
        header += ['| Rendered (UTC) | Video | Length | Publishing | Upload metadata |',
                   '|---|---|---:|---|---|']
        for m in metas:
            slug = m['slug']
            header.append(f'| {m["rendered_at_utc"][:10]} | `{slug}` | {m["duration_s"]}s | {m["publishing_status"]} | [Copy metadata](metadata/{slug}.md) |')
        header += ['', '---', '']
        for m in metas:
            header += [metadata_section(m), '', '---', '']
    (ROOT/'VIDEO_CATALOG.md').write_text('\n'.join(header).rstrip()+'\n',encoding='utf-8')


def write_assets(r: dict) -> None:
    header = ['# Reusable Three.js Asset Library', '',
              'Registry source of truth: `assets/registry.json`. Only verified, genuinely reusable source files are registered.',
              'Coding agents should search IDs/tags here **before** creating new geometry, shaders, camera rigs or audio.', '']
    if not r['assets']:
        header.append('No reusable assets have been built yet; storyboard asset proposals are not completed code.')
    else:
        header.extend(['| Asset ID | Purpose | Location | Created for | Used in | License |',
                       '|---|---|---|---|---|---|'])
        for a in sorted(r['assets'], key=lambda x:x['id']):
            header.append(f'| `{a["id"]}` | {a["name"].replace("|","/")} | `{a["source_path"]}` | `{a["created_for"]}` | '
                          f'{", ".join("`"+x+"`" for x in a["used_in"])} | {a["license"]} |')
        header += ['', '## Reuse instructions', '']
        for a in sorted(r['assets'],key=lambda x:x['id']):
            header += [f'### `{a["id"]}` — {a["name"]}', '', a['description'], '',
                       '**Tags:** ' + ', '.join(a['tags']),
                       '**Parameters:** ' + ', '.join(a['configurable_parameters']),
                       '**Notes:** ' + a.get('notes',''), '']
    (ROOT/'ASSET_LIBRARY.md').write_text('\n'.join(header).rstrip()+'\n',encoding='utf-8')


def main(slug: str) -> None:
    require(bool(SLUG_RE.fullmatch(slug)), 'Use a simple lower-kebab-case story slug')
    story = read_json(ROOT/f'stories/{slug}.json')
    require(story['project']['slug']==slug, f'{slug}: storyboard slug mismatch')
    require(45 <= story['project']['duration_s'] <= 90, f'{slug}: invalid storyboard duration')
    probe_video(ROOT/f'output/{slug}.mp4', story['project']['duration_s'])
    check_thumbnail(slug, story['project']['width'], story['project']['height'])

    registry=checked_registry()
    by_id={a['id']:a for a in registry['assets']}
    meta_path=META/f'{slug}.json'
    require(meta_path.is_file(), f'Upload metadata JSON is required before finalizing: metadata/{slug}.json')
    m=read_json(meta_path)
    validate_meta(m, slug, set(by_id), copy_rules=True)
    require(m['duration_s']==story['project']['duration_s'], f'{slug}: storyboard/metadata duration mismatch')
    for aid in m.get('created_asset_ids', []):
        require(by_id[aid]['created_for']==slug,
                f'{aid}: created_asset_ids claims it was made for {slug} but registry differs')
    for aid in m.get('reused_asset_ids', []):
        require(by_id[aid]['created_for']!=slug,
                f'{aid}: asset created for this video must be classified as created, not reused')

    m.setdefault('rendered_at_utc', dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds').replace('+00:00','Z'))
    m.setdefault('published_urls', {})
    number_published=sum(bool(m['published_urls'].get(k)) for k in PLATFORMS)
    m['publishing_status']='published' if number_published == len(PLATFORMS) else (
        'partially_published' if number_published else 'rendered_not_published')
    for aid in m.get('created_asset_ids', []) + m.get('reused_asset_ids', []):
        entries=set(by_id[aid].get('used_in', []))
        entries.add(slug)
        by_id[aid]['used_in']=sorted(entries)

    # Only write after every input and media check has passed.
    write_json(REGISTRY, registry)
    write_json(meta_path, m)
    # LF line endings on every OS, so the same copy hashes the same everywhere and is not re-uploaded needlessly.
    (ROOT/f'output/{slug}.md').write_text(publishing_kit(m), encoding='utf-8', newline='\n')
    metas=[]
    for p in sorted(META.glob('*.json')):
        candidate=read_json(p)
        if not candidate.get('rendered_at_utc'):
            continue # draft metadata must never enter the published/video list
        cs=candidate.get('slug')
        require(p.name==f'{cs}.json',f'Bad metadata filename {p}')
        validate_meta(candidate,cs,set(by_id))
        (META/f'{cs}.md').write_text('# Upload metadata — '+candidate['topic']+'\n\n'+metadata_section(candidate)+'\n',encoding='utf-8')
        metas.append(candidate)
    metas.sort(key=lambda x:(x['rendered_at_utc'],x['slug']),reverse=True)
    write_catalog(metas)
    write_assets(registry)
    print(f'FINALIZED {slug}: output/{slug}.mp4 | output/{slug}.md | metadata/{slug}.md | VIDEO_CATALOG.md | ASSET_LIBRARY.md')


if __name__=='__main__':
    if len(sys.argv)!=2:
        raise SystemExit('Usage: python scripts/finalize_video.py <slug>')
    try:
        main(sys.argv[1])
    except (ValueError,KeyError,TypeError,json.JSONDecodeError,FileNotFoundError) as e:
        raise SystemExit('FINALIZATION ERROR: '+str(e))
