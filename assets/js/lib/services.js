/**
 * Services behave as an accordion of infrastructure layers. Opening one
 * illuminates the matching nodes in the topology diagram, so the list and the
 * diagram are one control rather than two decorations.
 */
export function initServices() {
  const items = Array.from(document.querySelectorAll('.ix-svc-item'));
  if (!items.length) return;

  const topoNodes = document.querySelectorAll('.ix-topo-node');

  const illuminate = (key) => {
    topoNodes.forEach((n) => {
      const tags = (n.dataset.layer || '').split(/\s+/);
      n.classList.toggle('is-active', Boolean(key) && tags.includes(key));
    });
  };

  const setOpen = (item, open) => {
    const btn = item.querySelector('.ix-svc-row');
    const body = item.querySelector('.ix-svc-body');
    item.classList.toggle('is-open', open);
    if (btn) btn.setAttribute('aria-expanded', String(open));
    if (body) body.setAttribute('aria-hidden', String(!open));
  };

  items.forEach((item, i) => {
    const btn = item.querySelector('.ix-svc-row');
    if (!btn) return;
    setOpen(item, i === 0);                 // the core focus opens by default
    if (i === 0) illuminate(item.dataset.layer);

    btn.addEventListener('click', () => {
      const willOpen = !item.classList.contains('is-open');
      items.forEach((other) => setOpen(other, false));
      setOpen(item, willOpen);
      illuminate(willOpen ? item.dataset.layer : null);
    });

    btn.addEventListener('mouseenter', () => {
      if (!item.classList.contains('is-open')) illuminate(item.dataset.layer);
    });
    btn.addEventListener('mouseleave', () => {
      const open = items.find((n) => n.classList.contains('is-open'));
      illuminate(open ? open.dataset.layer : null);
    });
  });
}
