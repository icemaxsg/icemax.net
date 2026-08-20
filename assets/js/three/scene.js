import {
  WebGLRenderer, Scene, PerspectiveCamera, Color, FogExp2, Vector3, Group
} from 'three';
import { createTerrain } from './terrain.js';
import { createNodes, createMotes } from './nodes.js';
import { createRoutes } from './routes.js';
import { createInterior } from './interior.js';

/**
 * The iceMax environment.
 *
 * One fixed canvas behind the whole document. Scroll drives a camera that
 * descends through the valley, climbs the massif and finally looks back down
 * across the network — edge, to core, to peak. Quality is tiered so a phone
 * renders the same composition at a fraction of the cost, and reduced-motion
 * users get a single still frame instead of a loop.
 */

const KEYS = [
  // p,  camera position,           look-at target
  // The massif is the identity of the site, so the track stays close to it and
  // keeps the summit high in frame rather than admiring it from the horizon.
  { p: 0.00, pos: [  90, 104, 190], look: [ -30, 140, -300] },
  { p: 0.26, pos: [ 140, 118,  40], look: [ -30, 150, -300] },
  { p: 0.52, pos: [  20, 168, -70], look: [ -30, 160, -320] },
  { p: 0.76, pos: [-190, 236,-160], look: [ -30, 120, -320] },
  { p: 1.00, pos: [ -60, 348,-120], look: [ -30,  60, -400] }
];

function lerp(a, b, t) { return a + (b - a) * t; }

function sampleTrack(p) {
  const c = Math.min(Math.max(p, 0), 1);
  let i = 0;
  while (i < KEYS.length - 2 && c > KEYS[i + 1].p) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const span = b.p - a.p || 1;
  let t = (c - a.p) / span;
  t = t * t * (3 - 2 * t);                       // smoothstep between keys
  return {
    pos: [lerp(a.pos[0], b.pos[0], t), lerp(a.pos[1], b.pos[1], t), lerp(a.pos[2], b.pos[2], t)],
    look: [lerp(a.look[0], b.look[0], t), lerp(a.look[1], b.look[1], t), lerp(a.look[2], b.look[2], t)]
  };
}

export function detectTier() {
  const w = window.innerWidth;
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  if (w < 760 || cores <= 4 || mem <= 4) return 'low';
  if (w < 1280 || cores <= 8) return 'mid';
  return 'high';
}

export function createEnvironment(canvas, opts = {}) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tier = detectTier();

  let renderer;
  try {
    renderer = new WebGLRenderer({
      canvas, antialias: tier === 'high', alpha: true,
      powerPreference: 'high-performance', failIfMajorPerformanceCaveat: false
    });
  } catch (err) {
    return null;                                  // caller falls back to the still frame
  }

  const dprCap = tier === 'low' ? 1.5 : 2;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.setClearColor(0x04070c, 0);

  const scene = new Scene();
  scene.fog = new FogExp2(0x04070c, 0.0016);

  const startAspect = window.innerWidth / window.innerHeight;
  const camera = new PerspectiveCamera(startAspect < 1 ? 62 : 46, startAspect, 1, 2400);
  const world = new Group();
  scene.add(world);

  const segments = tier === 'low' ? 110 : tier === 'mid' ? 170 : 230;
  const interior = createInterior({ reduced: tier === 'low' });
  const terrain = createTerrain({ segments, reduced: tier === 'low' });
  const nodes   = createNodes({ count: tier === 'low' ? 18 : tier === 'mid' ? 26 : 36 });
  const routes  = createRoutes({ routes: tier === 'low' ? 5 : tier === 'mid' ? 7 : 10, samples: tier === 'low' ? 56 : 90 });
  const motes   = createMotes({ count: tier === 'low' ? 220 : tier === 'mid' ? 460 : 760 });

  world.add(interior.group, terrain.group, nodes.object, routes.object, motes.object);
  nodes.object.renderOrder = 3;
  routes.object.renderOrder = 3;
  motes.object.renderOrder = 4;

  const layers = [interior, terrain, nodes, routes, motes];

  // --- state ---
  let progress = opts.startProgress ?? 0;
  let target = progress;
  let reveal = 0;
  let pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let raf = 0;
  let running = false;
  let clock = 0;
  let last = performance.now();
  const lookAt = new Vector3();

  const camPos = new Vector3();

  function applyCamera(p, dt) {
    const s = sampleTrack(p);
    // parallax: the camera leans toward the pointer, never enough to disorient
    pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 2.2);
    pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 2.2);

    camPos.set(
      s.pos[0] + pointer.x * 26,
      s.pos[1] - pointer.y * 16,
      s.pos[2]
    );
    lookAt.set(s.look[0], s.look[1], s.look[2]);

    // Portrait crops the horizontal field, which would slice the massif out of
    // frame. Rather than ship a cropped desktop shot, pull the camera back
    // along its own view vector so the whole range fits the taller format.
    if (camera.aspect < 1) {
      const pull = 1 + (1 - camera.aspect) * 0.95;
      camPos.sub(lookAt).multiplyScalar(pull).add(lookAt);
      camPos.y += (1 - camera.aspect) * 26;
    }

    camera.position.copy(camPos);
    camera.lookAt(lookAt);
  }

  function renderFrame(dt) {
    clock += dt;
    for (const l of layers) l.update(clock);
    applyCamera(progress, dt);
    renderer.render(scene, camera);
  }

  function loop() {
    if (!running) return;
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    progress += (target - progress) * Math.min(1, dt * 3.0);   // eased scroll follow
    if (reveal < 1) {
      reveal = Math.min(1, reveal + dt * 0.55);
      for (const l of layers) l.setReveal(reveal);
    }
    renderFrame(dt);
    raf = requestAnimationFrame(loop);
  }

  function start() {
    if (running || reducedMotion) return;
    running = true; last = performance.now();
    raf = requestAnimationFrame(loop);
  }
  function stop() { running = false; cancelAnimationFrame(raf); }

  function applyDepth() {
    // Portrait pulls the camera back, which would otherwise bury the massif in
    // distance fog. Push the depth cues out by the same factor so the range
    // stays visible instead of fading into the void.
    const k = camera.aspect < 1 ? 1 + (1 - camera.aspect) * 1.15 : 1;
    for (const l of layers) if (l.setFar) l.setFar(k);
    scene.fog.density = 0.0016 / k;
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    // widen the lens in portrait so the landscape still has breadth
    camera.fov = camera.aspect < 1 ? 62 : 46;
    camera.updateProjectionMatrix();
    applyDepth();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
    renderer.setSize(w, h, false);
    if (reducedMotion) renderFrame(0);
  }

  applyDepth();

  // reduced motion: compose one frame, fully revealed, and never loop
  if (reducedMotion) {
    reveal = 1;
    for (const l of layers) l.setReveal(1);
    clock = 6;
    for (const l of layers) l.update(clock);
    applyCamera(progress, 0.016);
    renderer.render(scene, camera);
  }

  return {
    tier,
    reducedMotion,
    start, stop, resize,
    setProgress(p) { target = Math.min(Math.max(p, 0), 1); },
    setPointer(nx, ny) { pointer.tx = nx; pointer.ty = ny; },
    dispose() {
      stop();
      for (const l of layers) l.dispose();
      renderer.dispose();
    }
  };
}
