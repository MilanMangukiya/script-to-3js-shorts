import * as THREE from 'three';
import { projectToScreen, type FilmDefinition, type OverlayContext } from '../../library/render/FilmPipeline';
import { loadEarthTextures } from '../../library/planet/Earth';
import { drawCallout, drawChip, drawRich, drawTag } from '../../library/overlay/Labels';
import { smoothstep } from '../../library/util/math';
import { frac, type Timing } from './stages/common';
import { GlobeStage } from './stages/GlobeStage';
import { DesertStage } from './stages/DesertStage';
import { CoastStage } from './stages/CoastStage';
import { DioramaStage } from './stages/DioramaStage';
import { ReefStage } from './stages/ReefStage';

const SLUG = 'continents-one-landmass';
const TEAL = '#6bd4cb', AMBER = '#ffc37a', ORANGE = '#ff9a3c';

/** Labels per shot: [chip title, chip value, tag, chip appears at fraction, tag appears at fraction, chip dot colour]. */
const NOTES: Record<string, [string, string, string, number, number, string?]> = {
  'S01/SH01': ['WHAT IF', 'ONE CONTINENT', 'SCHEMATIC · MILLIONS OF YEARS SPED UP', 0.45, 0.45],
  'S02/SH01': ['PANGAEA', 'SPLIT ~200 MILLION YEARS AGO', 'SCHEMATIC ARRANGEMENT · NOT AN EXACT RECONSTRUCTION', 0.62, 0.66, TEAL],
  'S03/SH01': ['THE FIT', 'SOUTH AMERICA + AFRICA', 'SCHEMATIC', 0.05, 0.05, TEAL],
  'S03/SH02': ['PLATE SPEED', '≈ FINGERNAIL GROWTH', 'SCHEMATIC · DRIFT SPED UP', 0.25, 0.25, TEAL],
  'S04/SH01': ['RAIN', 'STAYS NEAR THE COASTS', 'SCHEMATIC', 0.3, 0.3],
  'S04/SH02': ['INTERIOR', 'THOUSANDS OF KM FROM THE SEA', 'ILLUSTRATIVE', 0.05, 0.05],
  'S05/SH01': ['COASTS', 'MONSOON RAINS', 'ILLUSTRATIVE', 0.05, 0.05],
  'S05/SH02': ['INLAND', 'HOT DAYS · FRIGID NIGHTS', 'ILLUSTRATIVE · TIME-LAPSE', 0.05, 0.05],
  'S06/SH01': ['WILDLIFE', 'THE AMERICAS JOIN', 'SCHEMATIC · GREAT AMERICAN INTERCHANGE', 0.05, 0.05, TEAL],
  'S07/SH01': ['CORAL REEFS', 'NEED SHALLOW, SUNLIT WATER', 'MOSTLY SHALLOWER THAN ~30 M', 0.05, 0.55, TEAL],
  'S08/SH01': ['NEXT SUPERCONTINENT', '~250 MILLION YEARS AWAY', 'MODEL RESULT · PANGEA ULTIMA (SCHEMATIC SHAPE)', 0.05, 0.5],
  'S08/SH02': ['MAMMALS', '8–16% OF LAND LIVABLE', 'MODEL · WIDESPREAD 40–50 °C', 0.05, 0.3],
};

export async function createFilm(ctx: { renderer: THREE.WebGLRenderer; base: string }): Promise<FilmDefinition> {
  const story = await fetch(`${ctx.base}stories/${SLUG}.json`).then((r) => r.json());
  const T: Timing = {};
  for (const sc of story.scenes) { T[sc.id] = { start: sc.start_s, end: sc.end_s }; for (const sh of sc.shots) T[`${sc.id}/${sh.id}`] = { start: sh.start_s, end: sh.end_s }; }
  const tex = await loadEarthTextures(ctx.base, Math.min(8, ctx.renderer.capabilities.getMaxAnisotropy()));
  const R = ctx.renderer, D = story.project.duration_s;
  const globe = new GlobeStage(T, tex, D), desert = new DesertStage(T, R), coast = new CoastStage(T, R), diorama = new DioramaStage(T), reef = new ReefStage(T);

  const space = { bloomStrength: 0.28, vignette: 0.5 };
  const shots: FilmDefinition['shots'] = {
    'S01/SH01': { stage: globe, post: space }, 'S02/SH01': { stage: globe, post: space },
    'S03/SH01': { stage: globe, post: space }, 'S03/SH02': { stage: globe, post: { ...space, bloomStrength: 0.34 } },
    'S04/SH01': { stage: globe, post: { ...space, bloomStrength: 0.32 } }, 'S04/SH02': { stage: desert, post: { bloomStrength: 0.2, saturation: 1.05, tint: [1.03, 1.0, 0.95] } },
    'S05/SH01': { stage: coast, post: { bloomStrength: 0.18, saturation: 0.85, vignette: 0.5, tint: [0.97, 1.0, 1.0] } },
    'S05/SH02': { stage: desert, post: { bloomStrength: 0.22, saturation: 1.0 } },
    'S06/SH01': { stage: diorama, post: { bloomStrength: 0.2, vignette: 0.5 } },
    'S07/SH01': { stage: reef, post: { bloomStrength: 0.3, saturation: 1.1 } },
    'S08/SH01': { stage: globe, post: { ...space, bloomStrength: 0.38 } }, 'S08/SH02': { stage: desert, post: { exposure: 1.06, bloomStrength: 0.3, saturation: 1.1, tint: [1.06, 0.99, 0.9] } },
    'S09/SH01': { stage: globe, post: space },
  };

  const overlay = (o: OverlayContext) => {
    const { ctx: c, shot, time_s: t, alpha, stage } = o;
    const u = frac(T, shot.key, t), note = NOTES[shot.key];
    const at = (p: THREE.Vector3) => projectToScreen(stage.camera, p, o.width, o.height);
    c.globalAlpha = alpha;
    if (note) {
      const [title, value, tag, chipAt, tagAt, dot] = note;
      c.globalAlpha = alpha * smoothstep(chipAt, chipAt + 0.06, u); drawChip(c, title, value, 85, 225, { dot: dot ?? AMBER, valueColor: AMBER });
      c.globalAlpha = alpha * smoothstep(tagAt, tagAt + 0.06, u); drawTag(c, tag, 105, 342, { accent: AMBER, size: 20 });
      c.globalAlpha = alpha;
    }
    switch (shot.key) {
      case 'S03/SH01': {
        const p = at(globe.globe.pointOn(-36, -6, 'south-america')), k = smoothstep(0.72, 0.8, u);
        if (p && k > 0) drawCallout(c, 'THE COASTS FIT', p.x, p.y, -120, 330, { alpha: k * alpha, size: 44 });
        break;
      }
      case 'S03/SH02': {
        const k = smoothstep(0.15, 0.3, u);
        c.save(); c.globalAlpha = alpha * k; c.strokeStyle = AMBER; c.fillStyle = AMBER; c.lineWidth = 5; c.lineCap = 'round';
        for (const [lon, lat] of [[-31, 40], [-24, 2], [-14, -30]] as const) {
          const p = at(globe.globe.pointOn(lon, lat)); if (!p) continue;
          for (const s of [-1, 1]) {
            const x0 = p.x + s * 18, x1 = p.x + s * 70;
            c.beginPath(); c.moveTo(x0, p.y); c.lineTo(x1, p.y); c.stroke();
            c.beginPath(); c.moveTo(x1 + s * 14, p.y); c.lineTo(x1 - s * 6, p.y - 11); c.lineTo(x1 - s * 6, p.y + 11); c.closePath(); c.fill();
          }
        }
        c.restore(); break;
      }
      case 'S04/SH01': {
        const p = at(globe.center.clone().multiplyScalar(1.02)), k = smoothstep(0.55, 0.65, u);
        if (p && k > 0) drawRich(c, 'DRY INTERIOR', p.x, p.y, { size: 34, weight: 700, color: '#ffd9a6', align: 'center', alpha: k });
        break;
      }
      case 'S06/SH01': {
        const n = at(new THREE.Vector3(-0.05, 0.12, -0.95)), s = at(new THREE.Vector3(0.22, 0.12, 1.05));
        const k = smoothstep(0.75, 0.83, u);   // the fact box replaces the region labels
        if (n) drawRich(c, 'NORTH AMERICA', n.x, n.y, { size: 30, weight: 700, color: TEAL, align: 'center', tracking: 1.5, alpha: 1 - k });
        if (s) drawRich(c, 'SOUTH AMERICA', s.x, s.y, { size: 30, weight: 700, color: ORANGE, align: 'center', tracking: 1.5, alpha: 1 - k });
        if (k > 0) {
          c.save(); c.globalAlpha = alpha * k * 0.55; c.fillStyle = '#080b14'; c.fillRect(110, 560, 860, 128); c.restore();
          drawRich(c, "≈ HALF OF SOUTH AMERICA'S MAMMALS", 540, 612, { size: 34, weight: 700, color: '#F6F0E4', align: 'center', alpha: k });
          drawRich(c, 'NOW HAVE NORTHERN ANCESTORS', 540, 660, { size: 28, weight: 600, tracking: 2, color: AMBER, align: 'center', alpha: k });
        }
        break;
      }
    }
    c.globalAlpha = 1;
  };
  return { shots, overlay };
}
