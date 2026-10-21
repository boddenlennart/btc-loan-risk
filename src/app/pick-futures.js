// "What happens when BTC falls" shows 5 sets of 20 simulated futures. They are picked so that, together,
// exactly as many end in a forced sale as the answer says (say 15 of 100): the first 100 futures of the
// simulation are a random draw and had, for example, 13 (owner's question, 21 Oct 2026). Which futures
// are shown stays random: the calculation keeps the first ones of each group in the order they came.

/**
 * pickFutures({ sold, safe }, nSold, total = 100, setSize = 20) → total futures, set after set.
 * The futures with a sale are spread over the sets as evenly as possible (15 → 3 per set; 17 → 4, 4, 3, 3, 3).
 */
export function pickFutures(pool, nSold, total = 100, setSize = 20) {
  const sold = pool.sold.slice(0, Math.max(0, Math.min(nSold, total, pool.sold.length)));
  const safe = pool.safe.slice(0, total - sold.length);
  const n = sold.length + safe.length;
  const sets = Math.max(1, Math.floor(n / setSize));
  const out = [];
  let s = 0; let f = 0;
  for (let k = 0; k < sets; k++) {
    const size = k < sets - 1 ? setSize : n - k * setSize;
    const nS = Math.floor(sold.length / sets) + (k < sold.length % sets ? 1 : 0);
    const take = Math.min(nS, sold.length - s);
    out.push(...safe.slice(f, f + size - take), ...sold.slice(s, s + take)); // the ✕ lines drawn last, on top
    f += size - take; s += take;
  }
  return out;
}
