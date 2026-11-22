/*
 * Shader do fundo das telas de autenticação (redesign 2026-11, mockup v3): tinta líquida marinho/petróleo/oliva
 * girando perto do ponteiro + o losango do logo em "vidro" (3D simulado num passe só: altura chanfrada, normal por
 * diferenças finitas, refração do fundo, reflexo e borda). Sem textura e sem Three.js de propósito — pesa poucos KB.
 * Mesma fonte do protótipo no canvas do mockup: mudou aqui, mude lá.
 */

export const LIQUID_VERTEX = `#version 300 es
void main() {
  vec2 p = vec2(gl_VertexID << 1 & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

export const LIQUID_FRAGMENT = `#version 300 es
precision highp float;
out vec4 outColor;
uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uMouse;
uniform float uPress;
uniform vec2 uCenter;
uniform float uSize;
uniform vec3 uNavy;
uniform vec3 uTeal;
uniform vec3 uOlive;
uniform float uRefract;
uniform float uSwirl;
uniform float uTilt;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5; mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = r * p * 2.02; a *= 0.5; }
  return v;
}

/* background: soft ink of navy, teal and olive, swirling near the pointer */
vec3 liquid(vec2 px) {
  float k = 2.4 / uResolution.y;
  vec2 p = px * k;
  vec2 m = uMouse * uResolution * k;
  vec2 dm = p - m;
  float a = exp(-dot(dm, dm) * 1.8) * uSwirl * (1.0 + uPress);
  p = m + mat2(cos(a), -sin(a), sin(a), cos(a)) * dm;
  float t = uTime * 0.07;
  vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3) - t));
  float f = fbm(p + 1.7 * q + vec2(0.7 * t, -0.4 * t));
  vec3 col = uNavy;
  col = mix(col, uTeal * 0.62, smoothstep(0.42, 0.82, f) * 0.85);
  col = mix(col, uOlive * 0.78, smoothstep(0.5, 0.95, f * q.y * 1.7) * 0.75);
  col += vec3(0.06, 0.07, 0.05) * smoothstep(0.62, 0.95, q.x);
  return col;
}

/* rounded diamond (the icon); the Y spin squashes x */
float roundBox(vec2 r, float b, float rad) {
  vec2 a = abs(r) - vec2(b - rad);
  return length(max(a, 0.0)) + min(max(a.x, a.y), 0.0) - rad;
}
float shape(vec2 p, float squash) {
  vec2 q = vec2(p.x / squash, p.y);
  vec2 r = mat2(0.70710678, -0.70710678, 0.70710678, 0.70710678) * q;
  return roundBox(r, 0.70710678, 0.17);
}
float height(vec2 p, float squash) {
  float k = clamp(-shape(p, squash) / 0.24, 0.0, 1.0);
  float h = sqrt(max(1.0 - (1.0 - k) * (1.0 - k), 0.0));
  return h + 0.045 * k * sin(p.x * 6.5 + uTime * 1.2) * sin(p.y * 5.5 - uTime);
}

void main() {
  vec2 px = gl_FragCoord.xy;
  float size = max(uSize, 8.0);
  vec2 rel = (px - uCenter) / size;
  vec2 mrel = (uMouse * uResolution - uCenter) / size;

  float ang = 0.32 * sin(uTime * 0.33) + clamp(mrel.x * 0.12, -0.45, 0.45) * uTilt;
  float squash = max(cos(ang), 0.4);
  float d = shape(rel, squash);
  float aa = 1.5 / size;

  /* glass normal (cheap, no noise) */
  float e = 0.006;
  float hx = height(rel + vec2(e, 0.0), squash) - height(rel - vec2(e, 0.0), squash);
  float hy = height(rel + vec2(0.0, e), squash) - height(rel - vec2(0.0, e), squash);
  vec3 n = normalize(vec3(-hx / (2.0 * e) * 0.22, -hy / (2.0 * e) * 0.22, 1.0));
  float inside = 1.0 - smoothstep(-aa, aa, d);

  /* background, and what the lens bends */
  vec3 col = liquid(px);
  vec3 behind = col;
  if (d < 0.05) behind = liquid(px + n.xy * uRefract * size * 0.55);
  behind = behind * 1.25 + 0.04;

  float glow = exp(-max(d, 0.0) * 4.5);
  col += uOlive * 0.2 * glow;
  float shadow = 1.0 - smoothstep(-0.1, 0.35, shape(rel + vec2(0.0, 0.16), squash * 1.04));
  col *= 1.0 - 0.35 * shadow * smoothstep(-aa, aa, d);
  float vign = length((px - 0.5 * uResolution) / uResolution.y);
  col *= 1.0 - 0.35 * smoothstep(0.35, 1.0, vign);

  /* logo colors: teal left, olive right, navy lower left */
  float x = rel.x / squash;
  float right = smoothstep(-0.015, 0.015, x);
  float low = 1.0 - smoothstep(-0.04, 0.04, rel.y + 0.12 + 0.42 * x);
  vec3 tint = mix(uTeal, uOlive, right);
  tint = mix(tint, uNavy * 1.3, low * (1.0 - right));
  tint *= 1.0 - 0.18 * low * right;
  vec3 glass = mix(behind, tint, 0.66);

  vec3 L = normalize(vec3(mrel * 0.5 - rel * 0.2 + vec2(-0.4, 0.6), 1.3));
  float diff = 0.78 + 0.32 * dot(n, L);
  vec3 R = reflect(-L, n);
  float spec = pow(max(R.z, 0.0), 70.0) * 0.95 + pow(max(R.z, 0.0), 9.0) * 0.12;
  float rim = pow(clamp(1.0 - n.z, 0.0, 1.0), 2.2) * 0.55;
  glass = glass * diff + vec3(1.0, 0.99, 0.96) * (spec + rim);
  glass += vec3(0.95, 0.93, 0.9) * 0.18 * (1.0 - smoothstep(-0.02, 0.02, abs(d + 0.012) - 0.01));

  col = mix(col, glass, inside);
  col += (hash(px + fract(uTime)) - 0.5) * 0.02;
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
