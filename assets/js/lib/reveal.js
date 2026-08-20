/**
 * Reveal on enter. One observer for the whole document; elements unobserve
 * themselves once shown, so nothing keeps ticking after the first pass.
 */
export function initReveal() {
  const items = document.querySelectorAll('.ix-reveal, .ix-line-mask, .ix-pillar, .ix-principle');
  if (!items.length) return;

  if (!('IntersectionObserver' in window) ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    items.forEach((el) => el.classList.add('is-in'));
    return;
  }

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });

  items.forEach((el) => io.observe(el));

  // Fail-safe. Reveal is an enhancement; it must never be the reason content
  // cannot be read. If the observer has not fired for an element by the time
  // the page has settled — zero-height viewport, odd embedding, a container
  // that never intersects — show it anyway.
  window.setTimeout(() => {
    items.forEach((el) => {
      if (!el.classList.contains('is-in')) {
        el.classList.add('is-in');
        io.unobserve(el);
      }
    });
  }, 2600);
}
