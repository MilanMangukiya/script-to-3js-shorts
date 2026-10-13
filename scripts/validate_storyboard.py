#!/usr/bin/env python3
"""Fail fast on invalid storyboard JSON and broken timeline references. Small essential QA only."""
import json
import sys
from pathlib import Path

try:
    from jsonschema import Draft202012Validator
except ImportError:
    raise SystemExit('Missing jsonschema. Install: python -m pip install jsonschema')

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = ROOT / 'storyboard.schema.json'
EPSILON = 0.00001

def close(a, b):
    return abs(a-b) <= EPSILON

def validate(path):
    obj = json.loads(path.read_text(encoding='utf-8'))
    schema = json.loads(SCHEMA.read_text(encoding='utf-8'))
    Draft202012Validator.check_schema(schema)
    errors = sorted(Draft202012Validator(schema).iter_errors(obj), key=lambda e: list(map(str,e.absolute_path)))
    if errors:
        raise ValueError('Schema invalid:\n' + '\n'.join(f'  {list(e.absolute_path)}: {e.message}' for e in errors[:15]))
    # An 'existing' asset must truly exist in the registry; proposed assets are intentionally unbuilt.
    registry_file = ROOT / 'assets/registry.json'
    registry = json.loads(registry_file.read_text(encoding='utf-8')) if registry_file.exists() else {'assets': []}
    registered = {a['id'] for a in registry['assets']}
    plan = obj['asset_plan']
    reused_ids = [a['asset_id'] for a in plan['existing_assets_to_reuse']]
    proposed_ids = [a['proposed_id'] for a in plan['new_reusable_asset_candidates']]
    if len(reused_ids) != len(set(reused_ids)) or len(proposed_ids) != len(set(proposed_ids)):
        raise ValueError('Duplicate asset plan IDs')
    if not set(reused_ids).issubset(registered):
        raise ValueError(f'Unregistered assets listed as existing: {sorted(set(reused_ids) - registered)}')
    # Old storyboards can be rerendered after their originally proposed assets were built.
    # The agent resolves such candidate IDs to the existing registry item at build time.
    if set(reused_ids) & set(proposed_ids):
        raise ValueError('An asset cannot be listed as both new and reused')
    scenes = obj['scenes']
    project = obj['project']
    claims = {c['id'] for c in obj['scientific_model']['claims']}
    if len(claims) != len(obj['scientific_model']['claims']):
        raise ValueError('Duplicate scientific claim IDs')
    if not close(scenes[0]['start_s'], 0) or not close(scenes[-1]['end_s'],project['duration_s']):
        raise ValueError('Scenes must start at 0 and end at project.duration_s')
    for i,sc in enumerate(scenes):
        if sc['id'] != f'S{i+1:02d}': raise ValueError(f'Nonsequential scene ID: {sc["id"]}')
        if sc['start_s'] >= sc['end_s']: raise ValueError(f'Scene {sc["id"]}: invalid span')
        if i and not close(scenes[i-1]['end_s'],sc['start_s']): raise ValueError(f'Scene {sc["id"]}: timing gap or overlap')
        nar=sc['narration']
        if not (sc['start_s'] <= nar['start_s'] < nar['end_s'] <= sc['end_s']):
            raise ValueError(f'Scene {sc["id"]}: narration outside scene')
        for emphasis in sc['caption_emphasis']:
            if emphasis['phrase'] not in nar['text']: raise ValueError(f'Scene {sc["id"]}: missing caption phrase {emphasis["phrase"]!r}')
        if not set(sc['claim_ids']).issubset(claims): raise ValueError(f'Scene {sc["id"]}: nonexistent scientific claim reference')
        for c in sc['audio_cues']:
            if c['at_s'] < sc['start_s'] or c['at_s']+c['duration_s'] > sc['end_s']+EPSILON:
                raise ValueError(f'Scene {sc["id"]}: audio cue outside scene')
        shots=sc['shots']
        if not close(shots[0]['start_s'],sc['start_s']) or not close(shots[-1]['end_s'],sc['end_s']):
            raise ValueError(f'Scene {sc["id"]}: shots do not cover scene')
        for j,sh in enumerate(shots):
            if sh['id'] != f'SH{j+1:02d}': raise ValueError(f'Scene {sc["id"]}: nonsequential shot IDs')
            if sh['start_s'] >= sh['end_s']: raise ValueError(f'Scene {sc["id"]}: invalid shot span')
            if j and not close(shots[j-1]['end_s'],sh['start_s']): raise ValueError(f'Scene {sc["id"]}: shots have gaps/overlaps')
            keys=sh['camera']['keyframes']
            if not close(keys[0]['t_s'],sh['start_s']) or not close(keys[-1]['t_s'],sh['end_s']):
                raise ValueError(f'Scene {sc["id"]} shot {sh["id"]}: camera keyframes do not span shot')
            times=[k['t_s'] for k in keys]
            if times != sorted(set(times)) or any(t<sh['start_s'] or t>sh['end_s'] for t in times):
                raise ValueError(f'Scene {sc["id"]} shot {sh["id"]}: unordered/out-of-range camera keyframe')
    th=obj.get('thumbnail')
    if th is not None:
        if not (0 <= th['time_s'] < project['duration_s']): raise ValueError('thumbnail.time_s must fall inside the video')
        for sc in scenes:
            tr=sc['transition_out']
            if tr['type']=='cross_dissolve' and tr['duration_s']>0 and sc['end_s']<project['duration_s'] and abs(th['time_s']-sc['end_s'])<tr['duration_s']/2+EPSILON:
                raise ValueError(f'thumbnail.time_s is inside the {sc["id"]} cross-dissolve; pick a clean frame')
        for w in th.get('highlight', []):
            if w.lower() not in th['headline'].lower(): raise ValueError(f'thumbnail.highlight word {w!r} is not in the headline')
    target=f'output/{project["slug"]}.mp4'
    if obj['delivery']['video_output'] != target: raise ValueError(f'Output must be {target}')
    wordcount=sum(len(sc['narration']['text'].split()) for sc in scenes)
    print(f'VALID: {project["slug"]} | {len(scenes)} scenes | {project["duration_s"]}s | {wordcount} narration words | {project["duration_s"]*project["fps"]} frames | output {target}')

if __name__ == '__main__':
    if len(sys.argv) != 2: raise SystemExit('Usage: python scripts/validate_storyboard.py stories/<slug>.json')
    file=Path(sys.argv[1])
    if not file.is_absolute() and not file.exists(): file=ROOT/file
    if not file.exists(): raise SystemExit(f'Not found: {file}')
    try: validate(file)
    except (ValueError,json.JSONDecodeError) as exc: raise SystemExit(str(exc))
