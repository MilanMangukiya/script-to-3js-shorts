#!/usr/bin/env python3
"""Upload finished videos with their thumbnails and publishing copy to the studio's private Hugging Face repo,
numbered in sequence.

Usage: python scripts/upload_to_hf.py <slug>    # one film, after scripts/finalize_video.py has succeeded
       python scripts/upload_to_hf.py --all     # every finalized film in output/, oldest render first
`node tools/finalize.mjs <slug>` runs this automatically after finalizing, then finalizes again so the links
appear in metadata/<slug>.md and VIDEO_CATALOG.md.

Naming: every film's files share one folder (huggingface.json "folder") as <NNN>-<slug>.mp4 (video), <NNN>-<slug>.jpg
(thumbnail) and <NNN>-<slug>.md (ready-to-paste titles, descriptions, captions, hashtags and tags for every platform,
written by the finalizer as output/<slug>.md).
A new film takes the next number after the highest one already in the folder, read from the Hub at upload time so
other developers' uploads count. A film that already has a number keeps it and its files are replaced. Old
unnumbered uploads (<slug>.mp4) are renamed in place on the Hub without re-uploading. Each film is one commit pinned
to the repo state that was read, so two people uploading at once can never take the same number: the later commit
is refused, re-read and retried.

Settings come from huggingface.json (no secrets). Log in once with your own write token:
    python -c "from huggingface_hub import login; login()"
The token stays in Hugging Face's own store (~/.cache/huggingface/token) or HF_TOKEN; this script never reads or
prints it. Files already on the Hub with the same content are not uploaded again.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / 'huggingface.json'
META = ROOT / 'metadata'
URL_PREFIX = {'dataset': 'datasets/', 'space': 'spaces/', 'model': ''}
LOGIN_HINT = 'python -c "from huggingface_hub import login; login()"'
ATTEMPTS = 5
# Local file per uploaded extension, and how the commit message names it.
FILES = {'mp4': 'video', 'jpg': 'thumbnail', 'md': 'publishing copy'}


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def git_blob_sha1(path: Path) -> str:
    """Git object id of a file's content: how the Hub identifies small files kept outside LFS (e.g. the .md)."""
    data = path.read_bytes()
    return hashlib.sha1(b'blob %d\0' % len(data) + data).hexdigest()


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding='utf-8'))


def write_json(path: Path, obj: dict) -> None:   # same formatting as scripts/finalize_video.py
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def now_utc() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')


def finalized_slugs() -> list[str]:
    """Finalized films with a local MP4, oldest render first (so --all numbers them in production order)."""
    found = []
    for p in sorted(META.glob('*.json')):
        m = read_json(p)
        if m.get('rendered_at_utc') and m.get('slug') == p.stem and (ROOT / 'output' / f'{p.stem}.mp4').is_file():
            found.append((m['rendered_at_utc'], p.stem))
    return [slug for _, slug in sorted(found)]


def numbered(files: list[str], folder: str) -> dict[str, tuple[int, str]]:
    """Every <folder>/<digits>-<slug>.(mp4|jpg|md) path -> (number, slug)."""
    pat = re.compile(rf'^{re.escape(folder)}/(\d+)-(.+)\.(?:mp4|jpg|md)$')
    return {f: (int(m.group(1)), m.group(2)) for f in files if (m := pat.match(f))}


def remote_sha(info: dict, path: str) -> str | None:
    lfs = getattr(info.get(path), 'lfs', None)
    return None if lfs is None else (lfs.get('sha256') if isinstance(lfs, dict) else getattr(lfs, 'sha256', None))


def unchanged(info: dict, path: str, local_path: Path, digest: str) -> bool:
    """The Hub already holds this content at `path`: LFS files compare SHA-256, small text files their git blob id."""
    entry = info.get(path)
    if entry is None:
        return False
    lfs_sha = remote_sha(info, path)
    return lfs_sha == digest if lfs_sha is not None else getattr(entry, 'blob_id', None) == git_blob_sha1(local_path)


def upload_film(api, ops_mod, http_error, cfg: dict, slug: str) -> bool:
    Add, Copy, Delete = ops_mod
    repo_id, repo_type = cfg['repo_id'], cfg.get('repo_type', 'dataset')
    folder, digits = cfg.get('folder', 'videos').strip('/'), int(cfg.get('number_digits', 3))
    mp4, jpg, meta_path = ROOT / 'output' / f'{slug}.mp4', ROOT / 'output' / f'{slug}.jpg', META / f'{slug}.json'
    if not mp4.is_file() or not meta_path.is_file() or not read_json(meta_path).get('rendered_at_utc'):
        print(f'{slug}: skipped (run the finalizer first; it needs output/{slug}.mp4 and metadata/{slug}.json)', file=sys.stderr)
        return False
    local = {'mp4': (mp4, sha256(mp4))}
    if cfg.get('upload_thumbnail', True):
        if not jpg.is_file():
            print(f'{slug}: thumbnail missing: output/{slug}.jpg (create it with: node tools/render.mjs {slug} --thumbnail)', file=sys.stderr)
            return False
        local['jpg'] = (jpg, sha256(jpg))
    if cfg.get('upload_publishing_kit', True):
        kit = ROOT / 'output' / f'{slug}.md'
        if not kit.is_file():
            print(f'{slug}: publishing copy missing: output/{slug}.md (the finalizer writes it: python scripts/finalize_video.py {slug})', file=sys.stderr)
            return False
        local['md'] = (kit, sha256(kit))
    use_copy = True
    for attempt in range(ATTEMPTS):
        head = api.repo_info(repo_id, repo_type=repo_type).sha
        files = api.list_repo_files(repo_id, repo_type=repo_type, revision=head)
        named = numbered(files, folder)
        mine = sorted({n for n, s in named.values() if s == slug})
        number = mine[0] if mine else max((n for n, _ in named.values()), default=0) + 1
        stem = f'{number:0{digits}d}-{slug}'
        targets = {ext: f'{folder}/{stem}.{ext}' for ext in local}
        # Earlier names of this film: unnumbered legacy uploads and differently padded or duplicate numbers.
        old = [f for f in files if f in [f'{folder}/{slug}.{ext}' for ext in FILES]]
        old += [f for f, (_, s) in named.items() if s == slug and f not in targets.values()]
        info = {p.path: p for p in api.get_paths_info(repo_id, [*targets.values(), *old], repo_type=repo_type, revision=head)}
        ops, notes = [], []
        for ext, (path, digest) in local.items():
            dest = targets[ext]
            if unchanged(info, dest, path, digest):
                continue
            src = next((f for f in old if f.endswith(f'.{ext}') and remote_sha(info, f) == digest), None) if use_copy else None
            if src:
                ops.append(Copy(src_path_in_repo=src, path_in_repo=dest)); notes.append(f'renamed {src} -> {dest}')
            else:
                size = path.stat().st_size
                ops.append(Add(path_in_repo=dest, path_or_fileobj=str(path)))
                notes.append(f'uploaded {dest} ({size / 1e6:.1f} MB)' if size >= 100_000 else f'uploaded {dest} ({size / 1e3:.1f} KB)')
        for f in old:
            ops.append(Delete(path_in_repo=f)); notes.append(f'removed old name {f}')
        if ops:
            try:
                api.create_commit(repo_id, ops, repo_type=repo_type, parent_commit=head,
                                  commit_message=f'{"Update" if mine else "Add"} {stem} ({", ".join(FILES[e] for e in local)})')
            except http_error as exc:
                status = getattr(getattr(exc, 'response', None), 'status_code', None)
                # Pinned to `head`: if anyone committed meanwhile, the Hub refuses; re-read and renumber.
                if attempt + 1 < ATTEMPTS and (status in (409, 412) or api.repo_info(repo_id, repo_type=repo_type).sha != head):
                    print(f'{slug}: the repo changed while uploading (another upload?); re-reading the folder')
                    continue
                if attempt + 1 < ATTEMPTS and use_copy and any(isinstance(o, Copy) for o in ops):
                    print(f'{slug}: server-side rename was refused ({status}); uploading the files instead')
                    use_copy = False
                    continue
                raise
            for n in notes:
                print(f'{slug}: {n}')
        else:
            print(f'{slug}: {stem} already up to date in {repo_id}')
        record(meta_path, repo_id, repo_type, number, targets, local)
        return True
    print(f'{slug}: gave up after {ATTEMPTS} attempts (the repo kept changing)', file=sys.stderr)
    return False


def record(meta_path: Path, repo_id: str, repo_type: str, number: int, targets: dict, local: dict) -> None:
    """Store the number and links in metadata/<slug>.json (top-level url/path_in_repo stay the video's)."""
    base = f'https://huggingface.co/{URL_PREFIX.get(repo_type, "")}{repo_id}/blob/main/'
    m = read_json(meta_path)   # re-read: keep any edits made while uploading
    prev = m.get('huggingface') or {}
    rec = {'repo_id': repo_id, 'repo_type': repo_type, 'number': number,
           'path_in_repo': targets['mp4'], 'url': base + targets['mp4'], 'sha256': local['mp4'][1], 'size_bytes': local['mp4'][0].stat().st_size}
    if 'jpg' in targets:
        rec.update({'thumbnail_path_in_repo': targets['jpg'], 'thumbnail_url': base + targets['jpg'], 'thumbnail_sha256': local['jpg'][1]})
    if 'md' in targets:
        rec.update({'copy_path_in_repo': targets['md'], 'copy_url': base + targets['md'], 'copy_sha256': local['md'][1]})
    same = all(prev.get(k) == rec.get(k) for k in ('path_in_repo', 'sha256', 'thumbnail_path_in_repo', 'thumbnail_sha256',
                                                   'copy_path_in_repo', 'copy_sha256'))
    rec['uploaded_at_utc'] = prev['uploaded_at_utc'] if same and prev.get('uploaded_at_utc') else now_utc()
    m['huggingface'] = rec
    write_json(meta_path, m)


def main() -> int:
    ap = argparse.ArgumentParser(description='Upload finished videos, thumbnails and publishing copy, numbered, to the Hugging Face repo in huggingface.json.')
    ap.add_argument('slug', nargs='?', help='story slug (output/<slug>.mp4, output/<slug>.jpg and output/<slug>.md)')
    ap.add_argument('--all', action='store_true', help='upload every finalized film found in output/, oldest first')
    args = ap.parse_args()
    if bool(args.slug) == args.all:
        ap.error('give one slug or --all')
    try:
        from huggingface_hub import HfApi, CommitOperationAdd, CommitOperationCopy, CommitOperationDelete
        from huggingface_hub.utils import HfHubHTTPError, disable_progress_bars
    except ImportError:
        print('huggingface_hub is not installed: python -m pip install --user huggingface_hub', file=sys.stderr)
        return 1
    if not sys.stderr.isatty():
        disable_progress_bars()   # keep agent and CI logs short; progress bars still show in a terminal
    cfg = read_json(CONFIG)
    repo_id, repo_type = cfg['repo_id'], cfg.get('repo_type', 'dataset')
    api = HfApi()
    try:
        api.whoami()
    except Exception:   # no token, expired token or offline; never echo token details
        print(f'Not logged in to Hugging Face, or it is unreachable. Log in once with: {LOGIN_HINT}', file=sys.stderr)
        return 1
    # Create the repo only when missing, so a fine-grained token limited to this one repo also works.
    if not api.repo_exists(repo_id, repo_type=repo_type):
        try:
            api.create_repo(repo_id, repo_type=repo_type, private=cfg.get('private', True), exist_ok=True)
        except Exception as exc:
            print(f'{repo_id} does not exist yet and this token cannot create it ({type(exc).__name__}). Create it on '
                  f'huggingface.co as a private {repo_type}, or use a token with write access to your account.', file=sys.stderr)
            return 1

    slugs = finalized_slugs() if args.all else [args.slug]
    if not slugs:
        print('No finalized films with an MP4 in output/.')
        return 0
    failures = 0
    for slug in slugs:
        try:
            ok = upload_film(api, (CommitOperationAdd, CommitOperationCopy, CommitOperationDelete), HfHubHTTPError, cfg, slug)
        except Exception as exc:
            print(f'{slug}: upload failed: {type(exc).__name__}: {exc}', file=sys.stderr)
            ok = False
        failures += 0 if ok else 1
    return 1 if failures else 0


if __name__ == '__main__':
    sys.exit(main())
