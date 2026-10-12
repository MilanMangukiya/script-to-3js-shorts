#!/usr/bin/env python3
"""Build the shared Earth texture set in assets/library/textures/earth from asset-sources/raw (NASA public domain).

Run with an interpreter that has numpy + Pillow:  py -3.14 scripts/build_earth_textures.py
Outputs equirectangular maps (lon -180..180 left to right, north up):
  day_8k.jpg     Blue Marble Next Generation (June 2004, topography + bathymetry)
  night_8k.jpg   Black Marble 2016 city lights
  clouds_8k.jpg  Blue Marble cloud layer (W+E hemispheres joined), grayscale
  landmask_4k.png  land=255 / ocean=0 from the GEBCO-derived work array
  seaice_4k.png    floating sea ice only (Blue Marble 2002), for showing or removing the polar ice cover

Rebuild a single group with:  py -3.14 scripts/build_earth_textures.py --only seaice
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / 'asset-sources' / 'raw'
WORK = ROOT / 'asset-sources' / 'work'
OUT = ROOT / 'assets' / 'library' / 'textures' / 'earth'
OUT.mkdir(parents=True, exist_ok=True)

def save(im, name, **kw):
    im.save(OUT / name, **kw)
    print(f'wrote {name} {im.size} {im.mode} {(OUT / name).stat().st_size / 1e6:.1f} MB', flush=True)

def build_base():
    day = Image.open(RAW / 'world.topo.bathy.200406.3x21600x10800.jpg')
    day.draft('RGB', (10800, 5400))
    save(day.convert('RGB').resize((8192, 4096), Image.LANCZOS), 'day_8k.jpg', quality=92, subsampling=0)
    del day

    night = Image.open(RAW / 'BlackMarble_2016_3km.jpg').convert('RGB')
    save(night.resize((8192, 4096), Image.LANCZOS), 'night_8k.jpg', quality=92)
    del night

    halves = []
    for name in ('cloud.W.2001210.21600x21600.png', 'cloud.E.2001210.21600x21600.png'):
        im = Image.open(RAW / name)
        im = im.convert('L') if im.mode != 'L' else im
        halves.append(im.resize((4096, 4096), Image.BOX))
        del im
    clouds = Image.new('L', (8192, 4096))
    clouds.paste(halves[0], (0, 0)); clouds.paste(halves[1], (4096, 0))
    save(clouds, 'clouds_8k.jpg', quality=90)

    land = np.load(WORK / 'land_r4.npy', mmap_mode='r')
    mask = Image.fromarray((np.clip(np.asarray(land), 0, 1) * 255).astype(np.uint8), 'L').resize((4096, 2048), Image.LANCZOS)
    save(mask, 'landmask_4k.png', optimize=True)


def build_seaice():
    """seaice_4k.png: floating sea ice only (white = ice over ocean) from Blue Marble 2002 land/ocean/ice, land masked out."""
    rgb = np.asarray(Image.open(RAW / 'land_ocean_ice_8192.png').convert('RGB').resize((4096, 2048), Image.LANCZOS)).astype(np.float32) / 255.0
    land = np.asarray(Image.fromarray((np.clip(np.asarray(np.load(WORK / 'land_r4.npy', mmap_mode='r')), 0, 1) * 255).astype(np.uint8), 'L').resize((4096, 2048), Image.LANCZOS)).astype(np.float32) / 255.0
    bright, spread = rgb.min(axis=2), rgb.max(axis=2) - rgb.min(axis=2)
    ice = np.clip((bright - 0.55) / 0.3, 0, 1) * np.clip(1 - spread / 0.18, 0, 1) * np.clip(1 - land * 1.6, 0, 1)
    save(Image.fromarray((ice * 255).astype(np.uint8), 'L'), 'seaice_4k.png', optimize=True)


if __name__ == '__main__':
    only = sys.argv[sys.argv.index('--only') + 1] if '--only' in sys.argv else None
    if only in (None, 'base'):
        build_base()
    if only in (None, 'seaice'):
        build_seaice()
