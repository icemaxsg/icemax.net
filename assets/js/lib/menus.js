/**
 * Dropdown navigation.
 *
 * Desktop: hover opens, but pointer alone is never the only way in — the
 * trigger is a real button, so keyboard and touch open it too. Escape closes
 * and returns focus to the trigger.
 * Mobile: the same markup behaves as an accordion inside the drawer.
 */
export function initMenus() {
  const items = Array.from(document.querySelectorAll('.ix-nav-item--has-menu'));
  const desktop = window.matchMedia('(min-width: 901px)');
  let openItem = null;

  const setOpen = (item, open) => {
    const btn = item.querySelector('.ix-nav-toggle');
    const menu = item.querySelector('.ix-nav-menu');
    if (!btn || !menu) return;
    item.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', String(open));
    menu.hidden = !open;
    openItem = open ? item : (openItem === item ? null : openItem);
  };

  const closeAll = () => items.forEach((i) => setOpen(i, false));

  items.forEach((item) => {
    const btn = item.querySelector('.ix-nav-toggle');
    if (!btn) return;

    btn.addEventListener('click', () => {
      const willOpen = !item.classList.contains('is-open');
      closeAll();
      setOpen(item, willOpen);
    });

    // hover is an accelerator on pointer devices, not the mechanism
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      item.addEventListener('mouseenter', () => { if (desktop.matches) { closeAll(); setOpen(item, true); } });
      item.addEventListener('mouseleave', () => { if (desktop.matches) setOpen(item, false); });
    }

    item.addEventListener('focusout', (e) => {
      if (!item.contains(e.relatedTarget)) setOpen(item, false);
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !openItem) return;
    const btn = openItem.querySelector('.ix-nav-toggle');
    setOpen(openItem, false);
    if (btn) btn.focus();
  });

  document.addEventListener('click', (e) => {
    if (openItem && !openItem.contains(e.target)) closeAll();
  });

  desktop.addEventListener('change', closeAll);

  // --- drawer accordions ---
  document.querySelectorAll('.ix-drawer-toggle').forEach((btn) => {
    const sub = document.getElementById(btn.getAttribute('aria-controls'));
    if (!sub) return;
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', String(open));
      sub.hidden = !open;
      btn.closest('.ix-drawer-group').classList.toggle('is-open', open);
    });
  });
}
