import {
  BufferGeometry, BufferAttribute, LineSegments, ShaderMaterial, Color,
  AdditiveBlending, Group, OctahedronGeometry, InstancedMesh, Object3D,
  InstancedBufferAttribute
} from 'three';
import { heightAt, TERRAIN, MASSIF } from './terrain.js';

/**
 * The infrastructure inside the mountain.
 *
 * The massif is rendered as translucent ice, so this lattice reads through the
 * surface: strata rings marking the stack (edge, security, network, compute,
 * data), vertical risers connecting them, and a data path climbing from the
 * base to the peak. It is the company diagram built into the landform rather
 * than drawn beside it.
 */

const STRATA = [0.16, 0.34, 0.52, 0.70, 0.86];   // fractions of peak height

export function createInterior({ reduced = false }) {
  const group = new Group();
  const cx = MASSIF.x, cz = MASSIF.z;
  const peakY = heightAt(cx, cz);

  const pos = [];
  const kind = [];   // 0 = stratum ring, 1 = riser, 2 = data path
  const tAttr = [];  // height fraction, drives colour

  const push = (a, b, k, t0, t1) => {
    pos.push(a[0], a[1], a[2], b[0], b[1], b[2]);
    kind.push(k, k);
    tAttr.push(t0, t1);
  };

  // --- strata rings: horizontal sections through the massif ---
  const segs = reduced ? 26 : 48;
  STRATA.forEach((f) => {
    const y = peakY * f;
    // ring radius tapers toward the summit, following the landform
    const r = MASSIF.radius * (1 - f) * 0.92;
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI * 2;
      const a1 = ((i + 1) / segs) * Math.PI * 2;
      push(
        [cx + Math.cos(a0) * r, y, cz + Math.sin(a0) * r],
        [cx + Math.cos(a1) * r, y, cz + Math.sin(a1) * r],
        0, f, f
      );
    }
  });

  // --- risers: vertical struts tying the strata together ---
  const risers = reduced ? 6 : 12;
  for (let i = 0; i < risers; i++) {
    const a = (i / risers) * Math.PI * 2 + 0.2;
    for (let s = 0; s < STRATA.length - 1; s++) {
      const f0 = STRATA[s], f1 = STRATA[s + 1];
      const r0 = MASSIF.radius * (1 - f0) * 0.92;
      const r1 = MASSIF.radius * (1 - f1) * 0.92;
      push(
        [cx + Math.cos(a) * r0, peakY * f0, cz + Math.sin(a) * r0],
        [cx + Math.cos(a) * r1, peakY * f1, cz + Math.sin(a) * r1],
        1, f0, f1
      );
    }
  }

  // --- the core: a single path from the base to the summit ---
  const coreSteps = 40;
  for (let i = 0; i < coreSteps; i++) {
    const f0 = (i / coreSteps) * 0.96;
    const f1 = ((i + 1) / coreSteps) * 0.96;
    const wob = (h) => Math.sin(h * 9.0) * MASSIF.radius * 0.05;
    push(
      [cx + wob(f0), peakY * f0, cz + wob(f0) * 0.6],
      [cx + wob(f1), peakY * f1, cz + wob(f1) * 0.6],
      2, f0, f1
    );
  }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute('aKind', new BufferAttribute(new Float32Array(kind), 1));
  geo.setAttribute('aT', new BufferAttribute(new Float32Array(tAttr), 1));

  const mat = new ShaderMaterial({
    // depthTest off: the lattice is meant to be seen *through* the ice shell.
    // Blending it under a 50%-opaque surface crushed it to nothing, so it is
    // drawn as an x-ray pass over the massif instead.
    transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending,
    uniforms: {
      uTime: { value: 0 }, uReveal: { value: 0 }, uFar: { value: 1 },
      uIce: { value: new Color('#C4E4F2') },
      uCyan: { value: new Color('#7FB4CC') },
      uBlue: { value: new Color('#2E628C') }
    },
    vertexShader: /* glsl */ `
      attribute float aKind; attribute float aT;
      varying float vKind; varying float vT; varying float vDist;
      void main() {
        vKind = aKind; vT = aT;
        vec4 mv = viewMatrix * modelMatrix * vec4(position, 1.0);
        vDist = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      precision mediump float;
      uniform float uTime; uniform float uReveal; uniform float uFar;
      uniform vec3 uIce; uniform vec3 uCyan; uniform vec3 uBlue;
      varying float vKind; varying float vT; varying float vDist;
      void main() {
        // strata sit cool and quiet; the core path carries the moving signal
        vec3 col = mix(uBlue, uCyan, vT * 0.85 + 0.15);
        float a = 0.40 + vT * 0.26;

        if (vKind > 1.5) {
          float head = fract(uTime * 0.14);
          float d = vT - head;
          d = d - floor(d + 0.5);
          float pulse = exp(-abs(d) * 30.0);
          col = mix(uCyan, uIce, clamp(vT + pulse, 0.0, 1.0));
          a = 0.34 + pulse * 1.05;
        } else if (vKind > 0.5) {
          a *= 0.70;                       // risers stay subordinate to rings
        } else {
          // rings brighten in sequence, reading as layers coming online
          float phase = fract(uTime * 0.10 - vT * 0.8);
          a += smoothstep(0.80, 1.0, 1.0 - phase) * 0.45;
        }

        a *= 1.0 - smoothstep(700.0 * uFar, 1500.0 * uFar, vDist);
        a *= uReveal;
        if (a < 0.004) discard;
        gl_FragColor = vec4(col, a);
      }
    `
  });

  const lines = new LineSegments(geo, mat);
  lines.frustumCulled = false;
  lines.renderOrder = 5;                    // drawn through the ice shell
  group.add(lines);

  // --- compute nodes suspended inside the massif ---
  const nodeCount = reduced ? 10 : 22;
  const ngeo = new OctahedronGeometry(2.4, 0);
  const nmat = new ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uReveal: { value: 0 }, uFar: { value: 1 }, uIce: { value: new Color('#C4E4F2') } },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      uniform float uTime;
      varying float vPulse; varying float vDist;
      void main() {
        vPulse = 0.5 + 0.5 * sin(uTime * 0.9 + aSeed * 19.3);
        vec4 world = modelMatrix * instanceMatrix * vec4(position * (1.0 + vPulse * 0.2), 1.0);
        vec4 mv = viewMatrix * world;
        vDist = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      precision mediump float;
      uniform vec3 uIce; uniform float uReveal; uniform float uFar;
      varying float vPulse; varying float vDist;
      void main() {
        float a = (0.30 + vPulse * 0.55) * uReveal;
        a *= 1.0 - smoothstep(700.0 * uFar, 1500.0 * uFar, vDist);
        gl_FragColor = vec4(uIce, a * 0.5);
      }
    `
  });

  const nodes = new InstancedMesh(ngeo, nmat, nodeCount);
  nodes.frustumCulled = false;
  nodes.renderOrder = 5;
  const dummy = new Object3D();
  const seeds = new Float32Array(nodeCount);
  for (let i = 0; i < nodeCount; i++) {
    const f = 0.14 + Math.random() * 0.72;
    const r = MASSIF.radius * (1 - f) * 0.92 * (0.25 + Math.random() * 0.6);
    const a = Math.random() * Math.PI * 2;
    dummy.position.set(cx + Math.cos(a) * r, peakY * f, cz + Math.sin(a) * r);
    dummy.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    dummy.updateMatrix();
    nodes.setMatrixAt(i, dummy.matrix);
    seeds[i] = Math.random();
  }
  ngeo.setAttribute('aSeed', new InstancedBufferAttribute(seeds, 1));
  group.add(nodes);

  return {
    group,
    update(t) { mat.uniforms.uTime.value = t; nmat.uniforms.uTime.value = t; },
    setReveal(v) { mat.uniforms.uReveal.value = v; nmat.uniforms.uReveal.value = v; },
    setFar(k) { mat.uniforms.uFar.value = k; nmat.uniforms.uFar.value = k; },
    dispose() { geo.dispose(); mat.dispose(); ngeo.dispose(); nmat.dispose(); }
  };
}
