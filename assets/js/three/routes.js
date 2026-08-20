import {
  BufferGeometry, BufferAttribute, LineSegments, ShaderMaterial,
  Color, AdditiveBlending, CatmullRomCurve3, Vector3
} from 'three';
import { heightAt } from './terrain.js';

/**
 * Network routes: traffic paths that climb the landscape toward the peak.
 * The faint line is the route; the bright head travelling along it is the
 * traffic. All routes live in one LineSegments draw call.
 */
export function createRoutes({ routes = 9, samples = 90 }) {
  const positions = [];
  const ts = [];        // 0..1 along the route
  const seeds = [];     // per-route phase

  const peak = new Vector3(-30, heightAt(-30, -300) + 10, -300);

  for (let r = 0; r < routes; r++) {
    const seed = Math.random();
    // start on the outer perimeter, fan around the front half
    const a = (r / routes) * Math.PI * 1.55 + Math.PI * 0.72 + (Math.random() - 0.5) * 0.18;
    const radius = 300 + Math.random() * 190;
    const sx = peak.x + Math.cos(a) * radius;
    const sz = peak.z + Math.sin(a) * radius;

    const ctrl = [];
    const steps = 5;
    for (let i = 0; i <= steps; i++) {
      const k = i / steps;
      // ease inward toward the peak, with lateral wander so routes are not spokes
      const wob = Math.sin(k * Math.PI) * (Math.random() - 0.5) * 130;
      const x = sx + (peak.x - sx) * k + wob;
      const z = sz + (peak.z - sz) * k + wob * 0.4;
      const y = heightAt(x, z) + 5 + Math.sin(k * Math.PI) * 16;
      ctrl.push(new Vector3(x, y, z));
    }

    const curve = new CatmullRomCurve3(ctrl, false, 'catmullrom', 0.4);
    const pts = curve.getPoints(samples);
    for (let i = 0; i < pts.length - 1; i++) {
      const t0 = i / (pts.length - 1);
      const t1 = (i + 1) / (pts.length - 1);
      positions.push(pts[i].x, pts[i].y, pts[i].z, pts[i + 1].x, pts[i + 1].y, pts[i + 1].z);
      ts.push(t0, t1);
      seeds.push(seed, seed);
    }
  }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geo.setAttribute('aT', new BufferAttribute(new Float32Array(ts), 1));
  geo.setAttribute('aSeed', new BufferAttribute(new Float32Array(seeds), 1));

  const mat = new ShaderMaterial({
    transparent: true, depthWrite: false, blending: AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uIce:  { value: new Color('#C4E4F2') },
      uBlue: { value: new Color('#2E628C') },
      uReveal: { value: 0 },
      uFar: { value: 1 }
    },
    vertexShader: /* glsl */ `
      attribute float aT; attribute float aSeed;
      varying float vT; varying float vSeed; varying float vDist;
      void main() {
        vT = aT; vSeed = aSeed;
        vec4 mv = viewMatrix * modelMatrix * vec4(position, 1.0);
        vDist = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      precision mediump float;
      uniform float uTime; uniform vec3 uIce; uniform vec3 uBlue; uniform float uReveal; uniform float uFar;
      varying float vT; varying float vSeed; varying float vDist;
      void main() {
        // the route itself: faint, brighter as it nears the summit
        float base = 0.10 + vT * 0.16;

        // the packet: a head that runs the route and wraps
        float head = fract(uTime * 0.19 + vSeed);
        float d = vT - head;
        d = d - floor(d + 0.5);                 // shortest wrapped distance
        float pulse = exp(-abs(d) * 46.0);

        vec3 col = mix(uBlue, uIce, clamp(vT + pulse, 0.0, 1.0));
        float a = (base + pulse * 0.95) * uReveal;
        a *= 1.0 - smoothstep(420.0 * uFar, 1050.0 * uFar, vDist);
        if (a < 0.004) discard;
        gl_FragColor = vec4(col, a);
      }
    `
  });

  const lines = new LineSegments(geo, mat);
  lines.frustumCulled = false;

  return {
    object: lines,
    update(t) { mat.uniforms.uTime.value = t; },
    setReveal(v) { mat.uniforms.uReveal.value = v; },
    setFar(k) { mat.uniforms.uFar.value = k; },
    dispose() { geo.dispose(); mat.dispose(); }
  };
}
