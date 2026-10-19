// Seeded random numbers so every simulation can be repeated exactly.

// murmur3's finaliser: every input bit affects every output bit
function fmix(h) {
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Mixes a run's seed and a path number into a well-spread 32-bit seed (one random stream per path).
 * The seed is mixed on its own first, so two runs with neighbouring seeds share no paths (found in the
 * maths audit: combining both by XOR first made runs 1001 and 1002 share 9,998 of 10,000 paths).
 */
export function mixSeed(a, b) {
  return fmix((fmix((a ^ 0x9e3779b9) >>> 0) + Math.imul(b + 1, 0x7f4a7c15)) >>> 0);
}

/** Returns { uniform(), normal(), studentT(nu) } driven by an integer seed (sfc32 generator). */
export function makeRng(seed) {
  let a = 0x9e3779b9;
  let b = 0x243f6a88;
  let c = 0xb7e15162;
  let d = seed >>> 0;
  const next = () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
  for (let i = 0; i < 12; i++) next(); // warm up
  const uniform = () => {
    let u = next();
    while (u === 0) u = next();
    return u; // in (0, 1)
  };
  let spare = null;
  const normal = () => {
    if (spare !== null) { const s = spare; spare = null; return s; }
    const r = Math.sqrt(-2 * Math.log(uniform()));
    const th = 2 * Math.PI * uniform();
    spare = r * Math.sin(th);
    return r * Math.cos(th);
  };
  // Gamma(k, 1) by Marsaglia-Tsang; used for the chi-square part of Student-t.
  const gamma = (k) => {
    if (k < 1) return gamma(k + 1) * uniform() ** (1 / k);
    const d3 = k - 1 / 3;
    const c3 = 1 / Math.sqrt(9 * d3);
    for (;;) {
      let x; let v;
      do { x = normal(); v = 1 + c3 * x; } while (v <= 0);
      v = v * v * v;
      const u = uniform();
      if (Math.log(u) < 0.5 * x * x + d3 - d3 * v + d3 * Math.log(v)) return d3 * v;
    }
  };
  /** Student-t scaled to variance 1 (needs nu > 2). Bailey's polar method: exact, one power per draw. */
  const studentT = (nu) => {
    let u; let v; let w;
    do { u = 2 * next() - 1; v = 2 * next() - 1; w = u * u + v * v; } while (w >= 1 || w === 0);
    return u * Math.sqrt((nu * (w ** (-2 / nu) - 1)) / w) * Math.sqrt((nu - 2) / nu);
  };
  return { uniform, normal, studentT, gamma };
}
