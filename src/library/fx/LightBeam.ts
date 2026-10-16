import * as THREE from 'three';

/**
 * Soft volumetric light beam: an open cone drawn additively whose brightness fades toward its silhouette (view-angle
 * falloff, so there are no hard geometric edges), along its length away from the source, and close to the camera
 * (so a beam sweeping over the lens never floods the frame). Use for lighthouse beams, street-lamp cones, spotlights
 * and searchlights. The template cone has its apex at the origin and opens along −Y; rotate the geometry or the mesh.
 */
export interface LightBeamOptions {
  length: number; radius: number; color?: THREE.ColorRepresentation;
  /** Peak brightness multiplier (HDR, before tone mapping). */
  intensity?: number;
  /** Silhouette softness exponent (higher = a narrower bright core). */
  edge?: number;
  /** Fall-off exponent along the beam (0 = uniform, 1 = linear to zero at the far end). */
  falloff?: number;
  /** Distance (m) from the camera below which the beam fades out. */
  nearFade?: number;
  radialSegments?: number;
}

export function beamGeometry(length: number, radius: number, radialSegments = 32) {
  const g = new THREE.ConeGeometry(radius, length, radialSegments, 6, true).translate(0, -length / 2, 0);
  const pos = g.attributes.position as THREE.BufferAttribute, along = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) along[i] = Math.min(1, Math.max(0, -pos.getY(i) / length));
  g.setAttribute('aAlong', new THREE.BufferAttribute(along, 1));
  return g;
}

export function beamMaterial(o: Omit<LightBeamOptions, 'length' | 'radius' | 'radialSegments'> = {}) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { uColor: { value: new THREE.Color(o.color ?? 0xffe2b0) }, uIntensity: { value: o.intensity ?? 1 }, uEdge: { value: o.edge ?? 2 },
      uFalloff: { value: o.falloff ?? 1 }, uNearFade: { value: o.nearFade ?? 4 } },
    vertexShader: /* glsl */ `
      attribute float aAlong; varying float vAlong; varying vec3 vWorld; varying vec3 vNrm;
      void main(){ vAlong = aAlong; vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz;
        vNrm = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uIntensity, uEdge, uFalloff, uNearFade;
      varying float vAlong; varying vec3 vWorld; varying vec3 vNrm;
      void main(){
        vec3 V = normalize(cameraPosition - vWorld);
        float facing = abs(dot(normalize(vNrm), V));
        float a = pow(facing, uEdge) * pow(max(1.0 - vAlong, 0.0), uFalloff) * smoothstep(0.0, 0.03, vAlong);
        a *= smoothstep(uNearFade * 0.3, uNearFade, length(cameraPosition - vWorld));
        gl_FragColor = vec4(uColor * uIntensity * a, 1.0);
      }`,
  });
}

export class LightBeam {
  readonly mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial; private peak: number;
  constructor(o: LightBeamOptions) {
    this.mat = beamMaterial(o); this.peak = o.intensity ?? 1;
    this.mesh = new THREE.Mesh(beamGeometry(o.length, o.radius, o.radialSegments), this.mat);
    this.mesh.userData.noDepthFx = true; this.mesh.renderOrder = 2; this.mesh.frustumCulled = false;
  }
  /** 0..1 of the peak brightness (0 hides the mesh). */
  set level(v: number) { this.mat.uniforms.uIntensity.value = this.peak * v; this.mesh.visible = v > 0.002; }
  set color(c: THREE.ColorRepresentation) { this.mat.uniforms.uColor.value.set(c); }
}
