/**
 * The perimeter, drawn literally: traffic approaches the massif from the open
 * network, meets the edge, and only clean traffic continues to origin.
 * A 2D canvas — cheap, sharp at any DPR, and it pauses when off-screen.
 */
export function initEdgeViz(canvas) {
  if (!canvas || !canvas.getContext) return null;
  const ctx = canvas.getContext('2d');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let w = 0, h = 0, dpr = 1;
  let raf = 0, running = false, t = 0;
  const packets = [];

  const COL = { ice: '#C4E4F2', blue: '#2E628C', threat: '#D96A7A', line: 'rgba(226,240,246,.16)' };

  function resize() {
    const rect = canvas.getBoundingClientRect();
    // A collapsed measurement (hidden container, mid-transition layout) would
    // pin the perimeter at x≈0 and strand every packet. Keep the last good
    // size instead of adopting a zero.
    if (rect.width < 2 || rect.height < 2) return false;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = rect.width; h = rect.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return true;
  }

  const edgeX = () => w * 0.52;      // the perimeter plane
  const originX = () => w * 0.83;    // origin infrastructure

  function spawn() {
    const threat = Math.random() < 0.42;
    packets.push({
      x: -10,
      y: h * (0.16 + Math.random() * 0.68),
      v: 0.9 + Math.random() * 1.5,
      threat,
      dead: false,
      flash: 0
    });
  }

  function drawMassif() {
    // the origin infrastructure the perimeter exists to protect
    const baseY = h * 0.95;
    const ridge = [
      [0.62, 0.95], [0.72, 0.60], [0.79, 0.72], [0.86, 0.30],
      [0.93, 0.55], [0.98, 0.42], [1.04, 0.62], [1.04, 0.95]
    ];
    ctx.beginPath();
    ridge.forEach(([rx, ry], i) => {
      const x = w * rx, y = h * ry;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.closePath();
    const g = ctx.createLinearGradient(0, h * 0.28, 0, baseY);
    g.addColorStop(0, 'rgba(56,105,154,.26)');
    g.addColorStop(1, 'rgba(4,7,12,0)');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(196,228,242,.42)'; ctx.lineWidth = 1; ctx.stroke();

    // contour hint, echoing the terrain shader
    ctx.strokeStyle = 'rgba(196,228,242,.10)';
    for (let i = 1; i <= 3; i++) {
      const y = h * (0.95 - i * 0.14);
      ctx.beginPath(); ctx.moveTo(w * (0.64 + i * 0.02), y); ctx.lineTo(w * 1.04, y); ctx.stroke();
    }

    ctx.fillStyle = 'rgba(150,167,186,.85)';
    ctx.font = '9px ui-monospace, monospace';
    ctx.fillText('ORIGIN', w * 0.66, h * 0.90);
  }

  function drawPerimeter() {
    const x = edgeX();
    const pulse = 0.30 + 0.14 * Math.sin(t * 1.6);
    const g = ctx.createLinearGradient(x - 26, 0, x + 26, 0);
    g.addColorStop(0, 'rgba(196,228,242,0)');
    g.addColorStop(0.5, `rgba(196,228,242,${pulse * 0.5})`);
    g.addColorStop(1, 'rgba(196,228,242,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 26, 0, 52, h);

    ctx.beginPath();
    ctx.setLineDash([5, 7]);
    ctx.lineDashOffset = -t * 26;
    ctx.moveTo(x, 0); ctx.lineTo(x, h);
    ctx.strokeStyle = `rgba(196,228,242,${pulse + 0.35})`;
    ctx.lineWidth = 1.2; ctx.stroke();
    ctx.setLineDash([]);
  }

  function frame(dt) {
    ctx.clearRect(0, 0, w, h);

    // faint horizon grid — the open network
    ctx.strokeStyle = COL.line; ctx.lineWidth = 1;
    for (let i = 1; i < 6; i++) {
      const y = (h / 6) * i;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(edgeX(), y); ctx.stroke();
    }

    drawMassif();
    drawPerimeter();

    const ex = edgeX(), ox = originX();

    for (const p of packets) {
      if (p.dead) { p.flash -= dt * 2.6; continue; }
      p.x += p.v * dt * 62;

      // threats are neutralised the moment they touch the perimeter
      if (p.threat && p.x >= ex) { p.dead = true; p.flash = 1; p.x = ex; }
      if (p.x > ox + 40) p.dead = true;
    }

    for (const p of packets) {
      if (p.dead && p.flash > 0) {
        // neutralisation burst
        const r = (1 - p.flash) * 16 + 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(217,106,122,${Math.max(p.flash, 0) * 0.9})`;
        ctx.lineWidth = 1.4; ctx.stroke();
        continue;
      }
      if (p.dead) continue;

      const past = p.x > ex;
      ctx.beginPath();
      ctx.moveTo(p.x - 16, p.y); ctx.lineTo(p.x, p.y);
      ctx.strokeStyle = p.threat ? 'rgba(217,106,122,.75)' : (past ? 'rgba(196,228,242,.95)' : 'rgba(155,167,180,.75)');
      ctx.lineWidth = past ? 1.7 : 1.2;
      ctx.stroke();
    }

    // retire finished packets
    for (let i = packets.length - 1; i >= 0; i--) {
      const p = packets[i];
      if (p.dead && p.flash <= 0) packets.splice(i, 1);
    }
  }

  let acc = 0, lastT = performance.now();
  function loop() {
    if (!running) return;
    const now = performance.now();
    const dt = Math.min((now - lastT) / 1000, 0.05);
    lastT = now; t += dt; acc += dt;
    while (acc > 0.11) { spawn(); acc -= 0.11; }
    frame(dt);
    raf = requestAnimationFrame(loop);
  }

  function start() { if (running || reduced) return; running = true; lastT = performance.now(); raf = requestAnimationFrame(loop); }
  function stop() { running = false; cancelAnimationFrame(raf); }

  resize();
  // The panel is fluid and lays out after fonts settle, so watch the element
  // itself — a stale width would strand packets short of the perimeter.
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(() => resize());
    ro.observe(canvas);
  } else {
    window.addEventListener('resize', resize);
  }

  if (reduced) {
    if (!w || !h) resize();
    // a composed still: some traffic stopped at the edge, some through
    for (let i = 0; i < 14; i++) {
      const threat = i % 3 === 0;
      packets.push({ x: threat ? edgeX() : edgeX() + 30 + i * 14, y: h * (0.14 + (i % 7) * 0.11), v: 0, threat, dead: false, flash: 0 });
    }
    frame(0);
  } else if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()), { threshold: 0.15 });
    io.observe(canvas);
  } else {
    start();
  }

  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  return { start, stop, resize };
}
