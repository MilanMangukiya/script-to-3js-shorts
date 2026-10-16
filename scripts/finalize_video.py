#!/usr/bin/env python3
"""
scripts/finalize_video.py — Media QA, Multi-Platform Copy Validator & Catalog Builder

Upgraded copy & taxonomy rules:
1. Every platform's title is the video's "What if ...?" topic question on its own (normally
   project.title verbatim): the YouTube Shorts / Facebook Reels `title`, and the first line of the
   TikTok / Instagram Reels caption and the X post. No hook, tagline or summary in that line.
2. The copy after the title line opens with the story's hook (e.g., a 2nd-person consequence
   such as "You're standing downtown when...") and its causal summary.
3. Every platform's copy after the title must include an interactive question ("?") to drive
   comment velocity (the story's comment_bait_question).
4. Blocks unanchored gaming tags (#wwe2k24, #eafc26, #securitygame, #steamgames) to prevent
   seed-cohort misrouting on YouTube Shorts.
"""

import json
import os
import subprocess
import sys
from pathlib import Path
from fractions import Fraction
from catalog import finalize_catalogs

BANNED_GAMING_TAGS = {
    "#securitygame",
    "#steamgames",
    "#indiegame",
    "#gamedev",
    "#wwe2k24",
    "#eafc26",
    "#cricket26",
    "#skibiditoilet",
}


def fail(msg: str) -> None:
    print(f"[FINALIZE ERROR] {msg}", file=sys.stderr)
    sys.exit(1)


def probe_video(mp4_path: Path, expected_duration_s: int) -> None:
    if not mp4_path.exists():
        fail(f"Rendered MP4 does not exist: {mp4_path}")

    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "stream=codec_name,codec_type,width,height,r_frame_rate,pix_fmt,sample_rate,channels:format=duration",
        "-of",
        "json",
        str(mp4_path),
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        fail(f"ffprobe failed on {mp4_path}: {res.stderr}")

    info = json.loads(res.stdout)
    streams = info.get("streams", [])
    v_stream = next((s for s in streams if s.get("codec_type") == "video"), None)
    a_stream = next((s for s in streams if s.get("codec_type") == "audio"), None)

    if not v_stream:
        fail("MP4 is missing a video stream.")
    if not a_stream:
        fail("MP4 is missing an AAC audio stream.")

    width = int(v_stream.get("width", 0))
    height = int(v_stream.get("height", 0))
    if (width, height) != (1080, 1920):
        fail(f"Expected 1080x1920 resolution, found {width}x{height}.")
    if v_stream.get('codec_name') != 'h264' or v_stream.get('pix_fmt') != 'yuv420p':
        fail('Expected H.264 video with yuv420p pixels.')
    if Fraction(v_stream.get('r_frame_rate', '0')) != 30:
        fail('Expected 30 fps.')
    if a_stream.get('codec_name') != 'aac' or int(a_stream.get('sample_rate', 0)) != 48000 or a_stream.get('channels') != 2:
        fail('Expected AAC audio at 48 kHz stereo.')

    dur = float(info.get("format", {}).get("duration", 0.0))
    if abs(dur - expected_duration_s) > 0.75:
        fail(f"Expected duration {expected_duration_s}s, found {dur:.2f}s.")


def validate_platform_metadata(meta: dict) -> None:
    platforms = meta.get("platforms", {})
    required_platforms = [
        "youtube_shorts",
        "tiktok",
        "instagram_reels",
        "facebook_reels",
        "x_video",
    ]
    for p in required_platforms:
        if p not in platforms:
            fail(f"metadata is missing platform block: {p}")

        block = platforms[p]
        hashtags = block.get("hashtags", [])
        if not (5 <= len(hashtags) <= 15):
            fail(f"{p} must carry 5-15 hashtags (found {len(hashtags)}).")

        lower_tags = {t.lower() for t in hashtags}
        overlap = lower_tags.intersection(BANNED_GAMING_TAGS)
        if overlap:
            fail(f"{p} contains banned gaming tags that pollute science routing: {overlap}")

        # Every platform's title is the "What if ...?" topic question on its own: the title field on
        # YouTube/Facebook, and the first line of the TikTok/Instagram caption or the X post. Viewers
        # should read the topic first, so nothing else may share that line.
        if p in ("youtube_shorts", "facebook_reels"):
            title = (block.get("title") or "").strip()
            body = (block.get("description") or "").strip()
        else:
            copy = (block.get("caption") or block.get("post") or "").strip()
            title, _, body = copy.partition("\n")
            title, body = title.strip(), body.strip()
        if not title.lower().startswith("what if"):
            fail(f"{p} title must start with 'What if' (a caption or post opens with its title line): '{title}'")
        if not title.endswith("?") or title.count("?") != 1:
            fail(f"{p} title must be the 'What if ...?' question alone, with no hook or description after it: '{title}'")
        if not body:
            fail(f"{p} needs copy after the title line.")

        # The copy after the title must carry an interactive question ("?") for comment velocity
        if "?" not in body:
            fail(
                f"{p} copy must include the story's comment question ('?') after the title."
            )

        if p == "x_video":
            full_x = f"{(block.get('post') or '').strip()} {' '.join(hashtags)}".strip()
            if len(full_x) > 280:
                fail(f"x_video post + hashtags exceeds 280 chars ({len(full_x)} chars).")


def main() -> None:
    if len(sys.argv) < 2:
        fail("Usage: python scripts/finalize_video.py <slug> [--probe-only]")

    slug = sys.argv[1]
    probe_only = "--probe-only" in sys.argv

    repo_root = Path.cwd()
    story_path = repo_root / "stories" / f"{slug}.json"
    if not story_path.exists():
        fail(f"Storyboard not found: {story_path}")

    storyboard = json.loads(story_path.read_text(encoding="utf-8"))
    duration_s = int(storyboard["project"]["duration_s"])

    mp4_path = repo_root / "output" / f"{slug}.mp4"
    jpg_path = repo_root / "output" / f"{slug}.jpg"
    srt_path = repo_root / "output" / f"{slug}.srt"
    txt_path = repo_root / "output" / f"{slug}.txt"

    probe_video(mp4_path, duration_s)

    for aux in (jpg_path, srt_path, txt_path):
        if not aux.exists():
            fail(f"Required deliverable missing: {aux}")

    if probe_only:
        print(f"[finalize] PROBE OK: {mp4_path} ({duration_s}s, 1080x1920, .jpg/.srt/.txt present)")
        return

    meta_json_path = repo_root / "metadata" / f"{slug}.json"
    if not meta_json_path.exists():
        fail(f"Missing upload metadata: {meta_json_path}")

    meta = json.loads(meta_json_path.read_text(encoding="utf-8"))
    validate_platform_metadata(meta)
    finalize_catalogs(repo_root, storyboard, meta)

    # Write human-readable publishing copy to output/<slug>.md and metadata/<slug>.md
    md_lines = [
        f"# {storyboard['project']['title']}",
        "",
        f"- **Slug:** `{slug}`",
        f"- **Duration:** {duration_s}s",
        f"- **Core Question:** {storyboard['project']['core_question']}",
        "",
    ]
    for p_key, p_val in meta.get("platforms", {}).items():
        md_lines.append(f"## {p_key}")
        if "title" in p_val:
            md_lines.append(f"**Title:** {p_val['title']}")
        body = p_val.get("description") or p_val.get("caption") or p_val.get("post") or ""
        md_lines.append("")
        md_lines.append(body)
        md_lines.append("")
        md_lines.append(" ".join(p_val.get("hashtags", [])))
        md_lines.append("")

    md_content = "\n".join(md_lines)
    (repo_root / "output" / f"{slug}.md").write_text(md_content, encoding="utf-8")
    (repo_root / "metadata" / f"{slug}.md").write_text(md_content, encoding="utf-8")

    print(f"[finalize] SUCCESS: {mp4_path}")


if __name__ == "__main__":
    main()
