/**
 * Navigation: stuck state, mobile drawer, current-page marking.
 * The drawer is a real overlay with focus containment and a scroll lock.
 */
export function initNav() {
  const nav = document.querySelector('.ix-nav');
  const burger = document.querySelector('.ix-burger');
  const drawer = document.querySelector('.ix-drawer');
  if (!nav) return;

  // stuck state
  const onScroll = () => nav.classList.toggle('is-stuck', window.scrollY > 24);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // mark the current page
  const here = location.pathname.replace(/index\.html$/, '').replace(/\/$/, '') || '/';
  document.querySelectorAll('.ix-nav-link, .ix-drawer-links a').forEach((a) => {
    const href = a.getAttribute('href') || '';
    if (href.startsWith('#') || href.startsWith('mailto:')) return;
    const path = href.replace(/index\.html$/, '').replace(/\.html$/, '').replace(/\/$/, '') || '/';
    if (path === here || (path !== '/' && here.startsWith(path))) {
      a.setAttribute('aria-current', 'page');
    }
  });

  if (!burger || !drawer) return;

  let open = false;
  const setOpen = (next) => {
    open = next;
    burger.setAttribute('aria-expanded', String(open));
    drawer.classList.toggle('is-open', open);
    drawer.setAttribute('aria-hidden', String(!open));
    document.body.classList.toggle('ix-locked', open);
    if (open) {
      const first = drawer.querySelector('a, button');
      if (first) first.focus({ preventScroll: true });
    } else {
      burger.focus({ preventScroll: true });
    }
  };

  drawer.setAttribute('aria-hidden', 'true');
  burger.addEventListener('click', () => setOpen(!open));
  drawer.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setOpen(false)));

  document.addEventListener('keydown', (e) => {
    if (!open) return;
    if (e.key === 'Escape') { setOpen(false); return; }
    if (e.key !== 'Tab') return;
    const focusables = drawer.querySelectorAll('a[href], button:not([disabled])');
    if (!focusables.length) return;
    const first = focusables[0], last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  // leaving mobile with the drawer open would strand the scroll lock
  const mq = window.matchMedia('(min-width: 901px)');
  mq.addEventListener('change', (e) => { if (e.matches && open) setOpen(false); });
}
