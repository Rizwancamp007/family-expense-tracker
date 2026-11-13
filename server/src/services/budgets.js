// Budget maths, kept pure so it can be tested without a server.
// Takes the month's budgets and the month's expenses (already fetched and
// scoped — family-wide for an admin, one member's own for a member) and
// returns what was spent against each limit, what's left, and whether the
// limit is blown.

function roundMoney(n) {
  return Math.round(n * 100) / 100;
}

// The date window for a "YYYY-MM" month, for fetching that month's expenses.
export function monthRange(month) {
  const [year, mon] = month.split("-").map(Number);
  const from = new Date(year, mon - 1, 1, 0, 0, 0, 0);
  const to = new Date(year, mon, 0, 23, 59, 59, 999);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function budgetStatus(budgets, expenses, month) {
  const [year, mon] = month.split("-").map(Number);
  const monthStart = new Date(year, mon - 1, 1, 0, 0, 0, 0);
  const monthEnd = new Date(year, mon, 1, 0, 0, 0, 0);

  let totalSpent = 0;
  const spentByCategory = new Map();
  for (const expense of expenses) {
    const when = new Date(expense.date);
    if (when < monthStart || when >= monthEnd) continue;
    totalSpent += expense.amount;
    spentByCategory.set(
      expense.category,
      (spentByCategory.get(expense.category) || 0) + expense.amount
    );
  }

  function entry(category, limit) {
    const spent = roundMoney(
      category === "Overall"
        ? totalSpent
        : spentByCategory.get(category) || 0
    );
    const remaining = roundMoney(limit - spent);
    return {
      category,
      limit: roundMoney(limit),
      spent,
      remaining,
      percent: limit > 0 ? Math.round((spent / limit) * 1000) / 10 : 0,
      overBudget: spent > limit,
    };
  }

  let overall = null;
  const categories = [];
  for (const budget of budgets) {
    if (budget.category === "Overall") {
      overall = entry("Overall", budget.amount);
    } else {
      categories.push(entry(budget.category, budget.amount));
    }
  }
  categories.sort((a, b) => b.percent - a.percent);

  return {
    month,
    overall,
    categories,
    totalSpent: roundMoney(totalSpent),
  };
}
