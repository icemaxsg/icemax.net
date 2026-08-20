import Lenis from 'lenis';
import { initNav } from './lib/nav.js';
import { initReveal } from './lib/reveal.js';
import { initServices } from './lib/services.js';
import { initMenus } from './lib/menus.js';
import { initEdgeViz } from './lib/edgeviz.js';

document.documentElement.classList.add('js');

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------- smooth scroll ---------------- */
let lenis = null;
try {
if (!reduced) {
  lenis = new Lenis({ duration: 1.05, smoothWheel: true, touchMultiplier: 1.6 });
  const raf = (time) => { lenis.raf(time); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);

  // in-page anchors go through Lenis so the easing is consistent
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (!id || id === '#') return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { offset: -80 });
    });
  });
}
} catch (err) {
  // native scrolling is a perfectly good fallback
  lenis = null;
  console.error('[icemax] smooth scroll unavailable:', err);
}

/* ---------------- scroll progress hairline ---------------- */
const bar = document.querySelector('.ix-progress');
function scrollFraction() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  return max > 0 ? Math.min(Math.max(window.scrollY / max, 0), 1) : 0;
}

/* ---------------- WebGL environment ---------------- */
const stage = document.querySelector('.ix-stage');
const canvas = document.querySelector('#ix-canvas');
const fallback = document.querySelector('.ix-stage-fallback');
let env = null;

async function bootEnvironment() {
  if (!canvas || !stage) return;
  try {
    // URL is injected by the template; the expression form stops esbuild from
    // inlining the Three.js runtime into this bundle.
    const src = stage.dataset.sceneSrc;
    if (!src) return;
    const { createEnvironment } = await import(/* @vite-ignore */ src);
    env = createEnvironment(canvas, { startProgress: Number(stage.dataset.start || 0) });
    if (!env) throw new Error('no webgl');
    stage.classList.add('is-ready');
    if (fallback) fallback.remove();
    if (!env.reducedMotion) env.start();

    window.addEventListener('resize', () => env.resize(), { passive: true });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) env.stop();
      else if (!env.reducedMotion) env.start();
    });

    // pointer parallax, desktop only — on touch it fights the scroll
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      window.addEventListener('pointermove', (e) => {
        env.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
      }, { passive: true });
    }
  } catch (err) {
    // No WebGL, or the module failed to load. The still frame stays and the
    // site is intact — but say so, rather than removing the stage in silence.
    console.error('[icemax] environment unavailable:', err);
    if (stage) stage.remove();
  }
}

/* ---------------- scroll wiring ---------------- */
function onScroll() {
  const f = scrollFraction();
  if (bar) bar.style.transform = `scaleX(${f})`;
  if (env) env.setProgress(f);
}
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* ---------------- boot ---------------- */
/* Each enhancement is isolated. A failure in one must not stop the others —
   and must never leave content hidden, which is why reveal runs first. */
function safely(name, fn) {
  try { fn(); }
  catch (err) { console.error(`[icemax] ${name} failed:`, err); }
}

safely('reveal', initReveal);
safely('nav', initNav);
safely('menus', initMenus);
safely('services', initServices);
safely('edge-viz', () => document.querySelectorAll('.ix-edge-canvas').forEach((c) => initEdgeViz(c)));

// Defer the heavy import until the browser is idle, but never depend on idle
// alone — requestIdleCallback can go unserviced indefinitely (a background or
// occluded tab), which would silently mean no environment at all.
let booted = false;
const bootOnce = () => { if (booted) return; booted = true; bootEnvironment(); };
if ('requestIdleCallback' in window) requestIdleCallback(bootOnce, { timeout: 1600 });
window.addEventListener('load', () => window.setTimeout(bootOnce, 1800));
