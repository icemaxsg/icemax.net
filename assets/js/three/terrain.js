import {
  PlaneGeometry, Mesh, ShaderMaterial, Color, DoubleSide,
  BufferAttribute, Group, AdditiveBlending, Vector3
} from 'three';
import { ridged, valueNoise } from './noise.js';

/**
 * The mountain. A ridged-fBm heightfield with one dominant massif in front of
 * the camera, drawn as a faceted dark surface lit by contour bands and a
 * fresnel rim — topography, not a lit rock. Flat shading keeps the facets
 * crystalline rather than smooth.
 */

export const TERRAIN = { width: 720, depth: 980, peak: 88 };

/** The dominant massif — exported so the interior lattice can be built inside it. */
export const MASSIF = { x: -30, z: -300, radius: 210 };

/** Height at a world (x,z). Exported so nodes and routes can sit on the surface. */
export function heightAt(x, z) {
  const nx = x * 0.0062;
  const nz = z * 0.0062;
  let h = ridged(nx + 40, nz + 40, 5) * TERRAIN.peak;

  // One dominant peak, offset slightly off-axis so the composition is not
  // centred. This is the identity of the site, so it carries most of the mass.
  const d = Math.hypot(x - MASSIF.x, z - MASSIF.z);
  const massif = Math.exp(-(d * d) / (2 * MASSIF.radius * MASSIF.radius));
  h += massif * TERRAIN.peak * 3.6;

  // a secondary shoulder, keeps the silhouette from reading as a single cone
  const d2 = Math.hypot(x + 230, z + 40);
  h += Math.exp(-(d2 * d2) / (2 * 160 * 160)) * TERRAIN.peak * 0.55;

  // The camera opens at +z looking north into the range, so the ground has to
  // fall away on the near side — otherwise the frame is filled by whatever
  // happens to sit under the lens instead of the massif.
  const near = 1 - Math.exp(-((z - 250) * (z - 250)) / (2 * 260 * 260));
  h *= 0.06 + 0.94 * near;

  return h;
}

const VERT = /* glsl */ `
  uniform float uTime;
  varying vec3 vWorld;
  varying vec3 vNormalW;
  varying float vHeight;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vHeight = position.z;           // plane is displaced along local z before rotation
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform vec3  uVoid;
  uniform vec3  uIce;
  uniform vec3  uBlue;
  uniform float uTime;
  uniform float uPeak;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform float uReveal;
  uniform float uFar;
  uniform float uOpacity;
  varying vec3  vWorld;
  varying vec3  vNormalW;
  varying float vHeight;

  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorld);
    float facing = clamp(dot(normalize(vNormalW), viewDir), 0.0, 1.0);

    // --- contour bands: the topographic signature ---
    float h = vHeight;
    float band = fract(h / 5.5);
    float bandLine = 1.0 - smoothstep(0.0, 0.10, min(band, 1.0 - band));
    // fade contours out where the surface faces away — keeps crests legible
    bandLine *= smoothstep(0.05, 0.55, facing);

    // --- altitude tint: ice at the crests, deep blue in the valleys ---
    float alt = clamp(h / (uPeak * 1.9), 0.0, 1.0);
    vec3 lineCol = mix(uBlue, uIce, smoothstep(0.25, 0.92, alt));

    // --- fresnel rim, so silhouettes read against the void ---
    float rim = pow(1.0 - facing, 3.2);

    // --- slope shading: steep faces stay dark, giving mass ---
    float slope = 1.0 - clamp(vNormalW.y, 0.0, 1.0);
    vec3 base = mix(uVoid, uVoid * 4.2, 1.0 - slope);

    // contours fade with distance — near ridges stay legible, the far field
    // settles into silhouette instead of a moiré of lines
    float dist = length(cameraPosition - vWorld);
    float near = 1.0 - smoothstep(120.0 * uFar, 620.0 * uFar, dist);

    vec3 col = base;
    col += lineCol * bandLine * (0.55 + 0.95 * near);
    col += mix(uBlue, uIce, alt) * rim * 0.34;

    // --- a slow cold sweep, the only thing that moves on the surface ---
    float sweep = smoothstep(0.86, 1.0, sin(h * 0.05 - uTime * 0.22));
    col += uIce * sweep * 0.05;

    // --- distance fog into the void ---
    float d = length(cameraPosition - vWorld);
    float fog = smoothstep(uFogNear * uFar, uFogFar * uFar, d);
    col = mix(col, uVoid, fog);

    // reveal from the horizon inward on load
    // The shell is ice: partly transparent, so the lattice engineered inside
    // the massif reads through it. Grazing angles stay denser, as ice does.
    float shell = mix(uOpacity, 1.0, rim * 0.7);
    float a = (1.0 - fog) * uReveal * shell;
    if (a < 0.004) discard;
    gl_FragColor = vec4(col, a);
  }
`;

export function createTerrain({ segments = 220, reduced = false }) {
  const group = new Group();
  const segX = segments;
  const segZ = Math.round(segments * 1.35);

  const geo = new PlaneGeometry(TERRAIN.width, TERRAIN.depth, segX, segZ);
  const pos = geo.attributes.position;

  // displace along local z (plane is rotated flat afterwards)
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);           // becomes -z once rotated
    pos.setZ(i, heightAt(x, -y));
  }
  geo.computeVertexNormals();
  // flat shading needs unwelded triangles for hard facets
  const flat = geo.toNonIndexed();
  flat.computeVertexNormals();
  geo.dispose();

  const mat = new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: true,
    side: DoubleSide,
    uniforms: {
      uTime:    { value: 0 },
      uVoid:    { value: new Color('#04070C') },
      uIce:     { value: new Color('#C4E4F2') },
      uBlue:    { value: new Color('#2E628C') },
      uPeak:    { value: TERRAIN.peak },
      uFogNear: { value: 150 },
      uFogFar:  { value: reduced ? 720 : 900 },
      uReveal:  { value: 0 },
      uFar:     { value: 1 },
      uOpacity: { value: 0.58 }
    }
  });

  const mesh = new Mesh(flat, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.frustumCulled = false;
  // Drawn after the interior so the lattice is already in the colour buffer and
  // shows through the ice; still depth-writes so the landform occludes itself.
  mesh.renderOrder = 2;
  group.add(mesh);

  return {
    group,
    material: mat,
    update(t) { mat.uniforms.uTime.value = t; },
    setReveal(v) { mat.uniforms.uReveal.value = v; },
    setFar(k) { mat.uniforms.uFar.value = k; },
    dispose() { flat.dispose(); mat.dispose(); }
  };
}
