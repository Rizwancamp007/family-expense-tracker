// Small pure helpers for the budget UI. No React here, so these run under
// plain node --test as well as in the browser.

// Percent of a budget used, to one decimal. No limit means nothing to
// measure against.
export function budgetPercent(spent, limit) {
  const used = Number(spent);
  const cap = Number(limit);
  if (!Number.isFinite(used) || !Number.isFinite(cap) || cap <= 0) return 0;
  return Math.round((used / cap) * 1000) / 10;
}

// Width for the progress bar, clamped so it never overflows its track.
export function budgetBarWidth(spent, limit) {
  return Math.min(100, Math.max(0, budgetPercent(spent, limit)));
}

// What's left of a budget. Negative means over budget.
export function budgetRemaining(limit, spent) {
  const cap = Number(limit);
  const used = Number(spent);
  if (!Number.isFinite(cap) || !Number.isFinite(used)) return 0;
  return Math.round((cap - used) * 100) / 100;
}

export function isOverBudget(spent, limit) {
  const cap = Number(limit);
  const used = Number(spent);
  return Number.isFinite(cap) && Number.isFinite(used) && cap > 0 && used > cap;
}
