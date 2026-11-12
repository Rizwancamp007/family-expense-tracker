// Dashboard totals for one month, from a plain list of expenses. Kept pure
// so the maths can be tested without a server or a database.
function roundMoney(n) {
  return Math.round(n * 100) / 100;
}

export function monthKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// The date window the summary endpoint needs to fetch: the whole month,
// plus the last 7 days when the week reaches back into the previous month.
export function summaryWindow(month, now = new Date()) {
  const [year, mon] = month.split("-").map(Number);
  const monthStart = new Date(year, mon - 1, 1, 0, 0, 0, 0);
  const monthEnd = new Date(year, mon, 0, 23, 59, 59, 999);
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);
  const from = new Date(Math.min(monthStart.getTime(), weekStart.getTime()));
  return { from: from.toISOString(), to: monthEnd.toISOString() };
}

export function summarizeExpenses(expenses, { month, now = new Date(), memberNames = {} } = {}) {
  const monthKeyValue = month || monthKey(now);
  const [year, mon] = monthKeyValue.split("-").map(Number);
  const monthStart = new Date(year, mon - 1, 1, 0, 0, 0, 0);
  const monthEnd = new Date(year, mon, 1, 0, 0, 0, 0);
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(now);
  dayEnd.setHours(23, 59, 59, 999);

  let monthTotal = 0;
  let weekTotal = 0;
  let expenseCount = 0;
  const byCategory = new Map();
  const byMember = new Map();

  for (const expense of expenses) {
    const when = new Date(expense.date);
    if (when >= weekStart && when <= dayEnd) {
      weekTotal += expense.amount;
    }
    if (when < monthStart || when >= monthEnd) continue;
    monthTotal += expense.amount;
    expenseCount += 1;
    byCategory.set(
      expense.category,
      (byCategory.get(expense.category) || 0) + expense.amount
    );
    const userId = String(expense.userId);
    byMember.set(userId, (byMember.get(userId) || 0) + expense.amount);
  }

  let topCategory = null;
  for (const [category, total] of byCategory) {
    if (!topCategory || total > topCategory.total) {
      topCategory = { category, total: roundMoney(total) };
    }
  }

  const perMember = [...byMember.entries()]
    .map(([userId, total]) => ({
      userId,
      name: memberNames[userId] || "Unknown",
      total: roundMoney(total),
    }))
    .sort((a, b) => b.total - a.total);

  return {
    month: monthKeyValue,
    monthTotal: roundMoney(monthTotal),
    weekTotal: roundMoney(weekTotal),
    topCategory,
    perMember,
    expenseCount,
  };
}
