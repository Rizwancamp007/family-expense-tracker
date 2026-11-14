// Analytics and monthly reports for one month, kept pure so the maths
// can be tested without a server. Every function takes the month's
// expenses already fetched and scoped — family-wide for an admin, one
// member's own for a member — and only counts expenses dated in that month.
import { budgetStatus } from "./budgets.js";

function roundMoney(n) {
  return Math.round(n * 100) / 100;
}

// "2026-11" -> { year: 2026, month: 11, days: 30 }
export function monthParts(month) {
  const [year, mon] = month.split("-").map(Number);
  return { year, month: mon, days: new Date(year, mon, 0).getDate() };
}

function inMonth(expense, month) {
  const { year, month: mon } = monthParts(month);
  const when = new Date(expense.date);
  return (
    when.getFullYear() === year &&
    when.getMonth() + 1 === mon
  );
}

// One total per day of the month, including zero days, so a trend line
// never has gaps. [{ date: "2026-11-01", total: 1250 }, ...]
export function monthlyTrend(expenses, month) {
  const { year, month: mon, days } = monthParts(month);
  const totals = new Array(days).fill(0);
  for (const expense of expenses) {
    if (!inMonth(expense, month)) continue;
    const day = new Date(expense.date).getDate();
    totals[day - 1] += expense.amount;
  }
  return totals.map((total, i) => ({
    date: `${year}-${String(mon).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`,
    total: roundMoney(total),
  }));
}

// Spending per category, biggest first, with each category's share of
// the month's total.
export function categoryBreakdown(expenses, month) {
  const byCategory = new Map();
  let total = 0;
  for (const expense of expenses) {
    if (!inMonth(expense, month)) continue;
    total += expense.amount;
    byCategory.set(
      expense.category,
      (byCategory.get(expense.category) || 0) + expense.amount
    );
  }
  return [...byCategory.entries()]
    .map(([category, amount]) => ({
      category,
      total: roundMoney(amount),
      percent: total > 0 ? Math.round((amount / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

// Spending per member, biggest first.
export function perMemberTotals(expenses, month, memberNames = {}) {
  const byMember = new Map();
  for (const expense of expenses) {
    if (!inMonth(expense, month)) continue;
    const userId = String(expense.userId);
    byMember.set(userId, (byMember.get(userId) || 0) + expense.amount);
  }
  return [...byMember.entries()]
    .map(([userId, total]) => ({
      userId,
      name: memberNames[userId] || "Unknown",
      total: roundMoney(total),
    }))
    .sort((a, b) => b.total - a.total);
}

// Everything the monthly report page needs in one object.
export function buildMonthlyReport({ expenses, budgets, month, memberNames = {} }) {
  const { days } = monthParts(month);
  const trend = monthlyTrend(expenses, month);
  const categories = categoryBreakdown(expenses, month);
  const perMember = perMemberTotals(expenses, month, memberNames);
  const totalSpent = roundMoney(
    trend.reduce((sum, day) => sum + day.total, 0)
  );
  const expenseCount = expenses.filter((e) => inMonth(e, month)).length;
  return {
    month,
    totalSpent,
    expenseCount,
    dailyAverage: days > 0 ? roundMoney(totalSpent / days) : 0,
    trend,
    categories,
    perMember,
    topCategories: categories.slice(0, 3),
    topSpenders: perMember.slice(0, 3),
    budget: budgetStatus(budgets, expenses, month),
  };
}

function csvCell(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

// The month's expenses as CSV, oldest first, ready for a spreadsheet.
// Amounts stay plain numbers so they can be summed.
export function expensesToCsv(expenses, month, memberNames = {}) {
  const rows = expenses
    .filter((e) => inMonth(e, month))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const lines = [
    "Date,Member,Category,Amount,Payment method,Note",
  ];
  for (const expense of rows) {
    lines.push(
      [
        new Date(expense.date).toISOString().slice(0, 10),
        memberNames[String(expense.userId)] || "Unknown",
        expense.category,
        expense.amount,
        expense.paymentMethod || "",
        expense.note || "",
      ]
        .map(csvCell)
        .join(",")
    );
  }
  return lines.join("\n") + "\n";
}
