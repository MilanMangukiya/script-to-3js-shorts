// Shared GLSL chunks. Import and interpolate into ShaderMaterial sources.

export const GLSL_NOISE = /* glsl */ `
float hash11(float p){ p = fract(p*0.1031); p *= p+33.33; p *= p+p; return fract(p); }
float hash21(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
float hash31(vec3 p){ p = fract(p*0.1031); p += dot(p, p.zyx+31.32); return fract((p.x+p.y)*p.z); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash21(i),hash21(i+vec2(1.0,0.0)),f.x), mix(hash21(i+vec2(0.0,1.0)),hash21(i+vec2(1.0,1.0)),f.x), f.y); }
float vnoise3(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(hash31(i),hash31(i+vec3(1.0,0.0,0.0)),f.x), mix(hash31(i+vec3(0.0,1.0,0.0)),hash31(i+vec3(1.0,1.0,0.0)),f.x), f.y),
             mix(mix(hash31(i+vec3(0.0,0.0,1.0)),hash31(i+vec3(1.0,0.0,1.0)),f.x), mix(hash31(i+vec3(0.0,1.0,1.0)),hash31(i+vec3(1.0,1.0,1.0)),f.x), f.y), f.z); }
float fbm(vec2 p){ float a=0.5, s=0.0; for(int i=0;i<5;i++){ s+=a*vnoise(p); p=p*2.03+vec2(17.1,9.2); a*=0.5; } return s; }
float fbm3(vec3 p){ float a=0.5, s=0.0; for(int i=0;i<4;i++){ s+=a*vnoise3(p); p=p*2.03+vec3(17.1,9.2,5.3); a*=0.5; } return s; }
`;

/** Exponential-squared distance fog helper for custom shaders: fogMix(color, fogColor, density, dist). */
export const GLSL_FOG = /* glsl */ `
vec3 fogMix(vec3 c, vec3 fogColor, float density, float dist){ float f = 1.0 - exp(-density*density*dist*dist); return mix(c, fogColor, clamp(f,0.0,1.0)); }
`;
