/**
 * Deterministic value-noise + ridged fBm.
 * Self-contained so the terrain is identical on every load and on the server
 * side of nothing — no dependency, no texture fetch, a few hundred bytes.
 */
function hash2(x, y) {
  // integer hash -> [0,1)
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

const smooth = (t) => t * t * (3 - 2 * t);

export function valueNoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = smooth(xf), v = smooth(yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

/** Ridged multifractal — gives sharp crests instead of rolling hills. */
export function ridged(x, y, octaves = 5, lacunarity = 2.03, gain = 0.5) {
  let sum = 0, freq = 1, amp = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(valueNoise(x * freq, y * freq) * 2 - 1);
    sum += n * n * amp;
    norm += amp;
    freq *= lacunarity;
    amp *= gain;
  }
  return sum / norm;
}
