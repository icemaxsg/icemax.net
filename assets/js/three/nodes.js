import {
  OctahedronGeometry, InstancedMesh, ShaderMaterial, Color, Object3D,
  InstancedBufferAttribute, BufferGeometry, BufferAttribute, Points,
  AdditiveBlending, Group
} from 'three';
import { heightAt } from './terrain.js';

/**
 * Edge nodes: the points of presence scattered across the landscape, each
 * sitting on the terrain surface and breathing on its own phase. One
 * InstancedMesh, so cost stays flat regardless of count.
 */
export function createNodes({ count = 34, reduced = false }) {
  const geo = new OctahedronGeometry(1.7, 0);
  const seeds = new Float32Array(count);
  const dummy = new Object3D();

  const mat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uIce:  { value: new Color('#C4E4F2') },
      uCyan: { value: new Color('#7FB4CC') },
      uReveal: { value: 0 },
      uFar: { value: 1 }
    },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      uniform float uTime;
      varying float vPulse;
      varying vec3 vNormalW;
      varying vec3 vWorld;
      void main() {
        // each node breathes on its own phase
        vPulse = 0.5 + 0.5 * sin(uTime * 1.15 + aSeed * 21.7);
        vec3 p = position * (1.0 + vPulse * 0.16);
        vec4 world = instanceMatrix * vec4(p, 1.0);
        world = modelMatrix * world;
        vWorld = world.xyz;
        vNormalW = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      precision mediump float;
      uniform vec3 uIce; uniform vec3 uCyan; uniform float uReveal; uniform float uFar;
      varying float vPulse; varying vec3 vNormalW; varying vec3 vWorld;
      void main() {
        vec3 viewDir = normalize(cameraPosition - vWorld);
        float rim = pow(1.0 - clamp(dot(normalize(vNormalW), viewDir), 0.0, 1.0), 2.0);
        vec3 col = mix(uCyan, uIce, vPulse);
        float a = (0.22 + rim * 0.85) * (0.55 + vPulse * 0.45);
        float d = length(cameraPosition - vWorld);
        a *= 1.0 - smoothstep(420.0 * uFar, 1000.0 * uFar, d);
        gl_FragColor = vec4(col, a * uReveal);
      }
    `
  });

  const mesh = new InstancedMesh(geo, mat, count);
  mesh.frustumCulled = false;

  // scatter across the field, biased toward ridges (higher ground reads better)
  let placed = 0, guard = 0;
  while (placed < count && guard < count * 60) {
    guard++;
    const x = (Math.random() - 0.5) * 560;
    const z = -Math.random() * 780 + 60;
    const h = heightAt(x, z);
    if (h < 16 && Math.random() > 0.28) continue;   // prefer elevated ground
    dummy.position.set(x, h + 2.4, z);
    dummy.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    dummy.scale.setScalar(0.7 + Math.random() * 0.9);
    dummy.updateMatrix();
    mesh.setMatrixAt(placed, dummy.matrix);
    seeds[placed] = Math.random();
    placed++;
  }
  mesh.count = placed;
  geo.setAttribute('aSeed', new InstancedBufferAttribute(seeds, 1));

  return {
    object: mesh,
    update(t) { mat.uniforms.uTime.value = t; },
    setReveal(v) { mat.uniforms.uReveal.value = v; },
    setFar(k) { mat.uniforms.uFar.value = k; },
    dispose() { geo.dispose(); mat.dispose(); }
  };
}

/** Ice motes — a thin volumetric haze of drifting particles. */
export function createMotes({ count = 700 }) {
  const geo = new BufferGeometry();
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3]     = (Math.random() - 0.5) * 700;
    pos[i * 3 + 1] = Math.random() * 190 + 4;
    pos[i * 3 + 2] = -Math.random() * 880 + 80;
    seed[i] = Math.random();
  }
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new BufferAttribute(seed, 1));

  const mat = new ShaderMaterial({
    transparent: true, depthWrite: false, blending: AdditiveBlending,
    uniforms: {
      uTime: { value: 0 }, uIce: { value: new Color('#9FE9FF') }, uReveal: { value: 0 }, uFar: { value: 1 },
      uSize: { value: Math.min(window.devicePixelRatio, 2) * 1.6 }
    },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      uniform float uTime; uniform float uSize; uniform float uFar;
      varying float vA;
      void main() {
        vec3 p = position;
        p.y += sin(uTime * 0.22 + aSeed * 30.0) * 5.0;
        p.x += cos(uTime * 0.16 + aSeed * 24.0) * 4.0;
        vec4 mv = viewMatrix * modelMatrix * vec4(p, 1.0);
        float d = -mv.z;
        vA = (0.30 + 0.7 * aSeed) * (1.0 - smoothstep(260.0 * uFar, 940.0 * uFar, d));
        gl_PointSize = uSize * (170.0 / max(d, 1.0));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      precision mediump float;
      uniform vec3 uIce; uniform float uReveal;
      varying float vA;
      void main() {
        float r = length(gl_PointCoord - 0.5);
        if (r > 0.5) discard;
        float a = (1.0 - smoothstep(0.16, 0.5, r)) * vA * uReveal;
        gl_FragColor = vec4(uIce, a * 0.5);
      }
    `
  });

  const points = new Points(geo, mat);
  points.frustumCulled = false;
  return {
    object: points,
    update(t) { mat.uniforms.uTime.value = t; },
    setReveal(v) { mat.uniforms.uReveal.value = v; },
    setFar(k) { mat.uniforms.uFar.value = k; },
    dispose() { geo.dispose(); mat.dispose(); }
  };
}
