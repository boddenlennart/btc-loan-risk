// "Make it safer": the one change suggested under the answer is the smallest step that clearly lowers the number, not the
// biggest one ("Starting LTV 5% → 0 of 100" for a loan at 25% asked for five times the BTC; owner, 21 Oct 2026).
// Clearly lower: at least a quarter and at least 1 point below the answer. The starting LTV is tried 5, 10 and
// 20 points lower; the smallest of these steps that is clearly lower is suggested (the slider right below shows
// the steps in between). Only if no LTV step clearly helps, the other change that lowers the number most.
export function bestLever(levers, answer, shownOf) {
  if (!levers || !levers.length) return null;
  const clearly = (l) => shownOf(l.p) <= answer - Math.max(1, Math.ceil(answer / 4));
  const ltv = levers.filter((l) => l.id === 'lowerLtv' && clearly(l)).sort((a, b) => b.value - a.value)[0];
  if (ltv) return ltv;
  const others = levers.filter((l) => l.id !== 'lowerLtv' && clearly(l));
  const best = (others.length ? others : levers).reduce((a, b) => (b.p < a.p ? b : a));
  return shownOf(best.p) < answer ? best : null;
}
