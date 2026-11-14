import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createApp } from "../src/app.js";
import {
  buildMonthlyReport,
  categoryBreakdown,
  expensesToCsv,
  monthlyTrend,
  perMemberTotals,
} from "../src/services/analytics.js";
import { monthKey } from "../src/services/summary.js";
import { createMemoryDb } from "../src/store/db.js";

process.env.JWT_SECRET = "test-secret-for-analytics-tests";

const expenses = [
  { amount: 2000, category: "Groceries", date: "2026-11-02T10:00:00.000Z", userId: "u1", paymentMethod: "Cash", note: "Weekly shop" },
  { amount: 1500, category: "Groceries", date: "2026-11-02T18:00:00.000Z", userId: "u2", paymentMethod: "Card", note: "" },
  { amount: 15000, category: "Rent", date: "2026-11-01T10:00:00.000Z", userId: "u1", paymentMethod: "Bank transfer", note: "November rent" },
  { amount: 800, category: "Transport", date: "2026-11-15T10:00:00.000Z", userId: "u2", paymentMethod: "Cash", note: "Fuel, \"Shell\" station" },
  // Outside the month — must not leak into any November number.
  { amount: 9999, category: "Groceries", date: "2026-10-31T10:00:00.000Z", userId: "u1", paymentMethod: "Cash", note: "" },
];
const budgets = [
  { category: "Overall", amount: 50000 },
  { category: "Groceries", amount: 10000 },
  { category: "Rent", amount: 15000 },
];
const names = { u1: "Ayesha", u2: "Bilal" };

describe("monthlyTrend", () => {
  test("one entry per day of the month, zero days included, totals add up", () => {
    const trend = monthlyTrend(expenses, "2026-11");
    assert.equal(trend.length, 30);
    assert.deepEqual(trend[0], { date: "2026-11-01", total: 15000 });
    assert.deepEqual(trend[1], { date: "2026-11-02", total: 3500 });
    assert.deepEqual(trend[14], { date: "2026-11-15", total: 800 });
    assert.deepEqual(trend[29], { date: "2026-11-30", total: 0 });
    assert.equal(
      trend.reduce((sum, day) => sum + day.total, 0),
      19300
    );
  });

  test("February has 28 days in a non-leap year", () => {
    assert.equal(monthlyTrend([], "2026-02").length, 28);
  });
});

describe("categoryBreakdown", () => {
  test("biggest first, shares of the month total, sums match the total", () => {
    const breakdown = categoryBreakdown(expenses, "2026-11");
    assert.deepEqual(breakdown, [
      { category: "Rent", total: 15000, percent: 77.7 },
      { category: "Groceries", total: 3500, percent: 18.1 },
      { category: "Transport", total: 800, percent: 4.1 },
    ]);
    const sum = breakdown.reduce((acc, row) => acc + row.total, 0);
    assert.equal(sum, 19300);
  });
});

describe("perMemberTotals", () => {
  test("biggest spender first, names attached", () => {
    assert.deepEqual(perMemberTotals(expenses, "2026-11", names), [
      { userId: "u1", name: "Ayesha", total: 17000 },
      { userId: "u2", name: "Bilal", total: 2300 },
    ]);
  });
});

describe("buildMonthlyReport", () => {
  test("totals, daily average, top lists and budget status agree", () => {
    const report = buildMonthlyReport({
      expenses,
      budgets,
      month: "2026-11",
      memberNames: names,
    });
    assert.equal(report.month, "2026-11");
    assert.equal(report.totalSpent, 19300);
    assert.equal(report.expenseCount, 4);
    assert.equal(report.dailyAverage, 643.33);
    assert.equal(report.trend.length, 30);
    assert.deepEqual(report.topCategories[0], {
      category: "Rent",
      total: 15000,
      percent: 77.7,
    });
    assert.deepEqual(report.topSpenders[0], {
      userId: "u1",
      name: "Ayesha",
      total: 17000,
    });
    assert.equal(report.budget.totalSpent, 19300);
    assert.equal(report.budget.overall.spent, 19300);
    assert.equal(report.budget.categories[0].category, "Rent");
    assert.equal(report.budget.categories[0].percent, 100);
  });

  test("an empty month still reports zeros, not a crash", () => {
    const report = buildMonthlyReport({
      expenses: [],
      budgets: [],
      month: "2026-11",
    });
    assert.equal(report.totalSpent, 0);
    assert.equal(report.expenseCount, 0);
    assert.equal(report.dailyAverage, 0);
    assert.deepEqual(report.categories, []);
    assert.deepEqual(report.perMember, []);
    assert.equal(report.trend.length, 30);
    assert.equal(report.budget.totalSpent, 0);
  });
});

describe("expensesToCsv", () => {
  test("header, one row per expense in date order, notes escaped", () => {
    const csv = expensesToCsv(expenses, "2026-11", names);
    const lines = csv.trim().split("\n");
    assert.equal(lines[0], "Date,Member,Category,Amount,Payment method,Note");
    assert.equal(lines.length, 5);
    assert.equal(lines[1], "2026-11-01,Ayesha,Rent,15000,Bank transfer,November rent");
    assert.equal(lines[2], "2026-11-02,Ayesha,Groceries,2000,Cash,Weekly shop");
    assert.equal(lines[3], "2026-11-02,Bilal,Groceries,1500,Card,");
    // A note with a comma and quotes is wrapped and doubled, per CSV rules.
    assert.equal(
      lines[4],
      '2026-11-15,Bilal,Transport,800,Cash,"Fuel, ""Shell"" station"'
    );
  });

  test("an empty month is just the header", () => {
    assert.equal(
      expensesToCsv([], "2026-11"),
      "Date,Member,Category,Amount,Payment method,Note\n"
    );
  });
});

describe("reports API", () => {
  let base;
  let server;
  let admin;
  let member;
  let outsider;
  let family;

  async function req(method, path, body, token, raw = false) {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (raw) return { status: res.status, text: await res.text(), headers: res.headers };
    return { status: res.status, body: await res.json().catch(() => ({})) };
  }
  const post = (p, b, t) => req("POST", p, b, t);
  const put = (p, b, t) => req("PUT", p, b, t);
  const get = (p, t) => req("GET", p, undefined, t);

  async function register(name, email, role) {
    const { status, body } = await post("/api/auth/register", {
      name,
      email,
      password: "secret123",
      ...(role ? { role } : {}),
    });
    assert.equal(status, 201);
    return body;
  }

  const month = monthKey(new Date());
  const today = new Date().toISOString().slice(0, 10);

  before(async () => {
    const app = createApp({ db: createMemoryDb() });
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        base = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });
    admin = await register("Report Admin", "rep-admin@example.com", "admin");
    member = await register("Report Member", "rep-member@example.com");
    outsider = await register("Not Family", "rep-outsider@example.com");
    const created = await post(
      "/api/families",
      { name: "Khan Family" },
      admin.token
    );
    family = created.body.family;
    await post(
      "/api/families/join",
      { inviteCode: family.inviteCode },
      member.token
    );
    await post(
      "/api/expenses",
      { familyId: family.id, amount: 6000, category: "Groceries", date: today, note: "Weekly shop" },
      admin.token
    );
    await post(
      "/api/expenses",
      { familyId: family.id, amount: 4000, category: "Groceries", date: today, note: "Top-up" },
      member.token
    );
    await post(
      "/api/expenses",
      { familyId: family.id, amount: 15000, category: "Rent", date: today },
      admin.token
    );
    await put(
      "/api/budgets",
      { familyId: family.id, month, category: "Groceries", amount: 8000 },
      admin.token
    );
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  test("the monthly report totals agree with the expenses added", async () => {
    const { status, body } = await get(
      `/api/reports/monthly?familyId=${family.id}&month=${month}`,
      admin.token
    );
    assert.equal(status, 200);
    const r = body.report;
    assert.equal(r.month, month);
    assert.equal(r.totalSpent, 25000);
    assert.equal(r.expenseCount, 3);
    assert.equal(r.topCategories[0].category, "Rent");
    assert.equal(r.topCategories[0].total, 15000);
    assert.equal(r.topCategories[1].category, "Groceries");
    assert.equal(r.topCategories[1].total, 10000);
    assert.equal(r.topSpenders[0].name, "Report Admin");
    assert.equal(r.topSpenders[0].total, 21000);
    assert.equal(r.topSpenders[1].name, "Report Member");
    assert.equal(r.topSpenders[1].total, 4000);
    // Trend and breakdown sums match the headline total.
    assert.equal(
      r.trend.reduce((sum, day) => sum + day.total, 0),
      r.totalSpent
    );
    assert.equal(
      r.categories.reduce((sum, row) => sum + row.total, 0),
      r.totalSpent
    );
    // Groceries is over its 8000 budget; rent has no budget set.
    assert.equal(r.budget.categories[0].category, "Groceries");
    assert.equal(r.budget.categories[0].overBudget, true);
    assert.equal(r.budget.categories[0].spent, 10000);
  });

  test("a member's report only counts their own spending", async () => {
    const { status, body } = await get(
      `/api/reports/monthly?familyId=${family.id}&month=${month}`,
      member.token
    );
    assert.equal(status, 200);
    assert.equal(body.report.totalSpent, 4000);
    assert.equal(body.report.expenseCount, 1);
    assert.equal(body.report.topSpenders.length, 1);
    assert.equal(body.report.topSpenders[0].name, "Report Member");
  });

  test("outsiders and bad months get nothing; login is required", async () => {
    const denied = await get(
      `/api/reports/monthly?familyId=${family.id}&month=${month}`,
      outsider.token
    );
    assert.equal(denied.status, 403);
    const badMonth = await get(
      `/api/reports/monthly?familyId=${family.id}&month=november`,
      admin.token
    );
    assert.equal(badMonth.status, 400);
    const noAuth = await get(
      `/api/reports/monthly?familyId=${family.id}&month=${month}`
    );
    assert.equal(noAuth.status, 401);
  });

  test("CSV export has the right shape, rows and download headers", async () => {
    const { status, text, headers } = await req(
      "GET",
      `/api/reports/export?familyId=${family.id}&month=${month}`,
      undefined,
      admin.token,
      true
    );
    assert.equal(status, 200);
    assert.match(headers.get("content-type"), /text\/csv/);
    assert.match(
      headers.get("content-disposition"),
      new RegExp(`expenses-${month}\\.csv`)
    );
    const lines = text.trim().split("\n");
    assert.equal(lines[0], "Date,Member,Category,Amount,Payment method,Note");
    assert.equal(lines.length, 4);
    assert.ok(lines.some((l) => l.includes("Rent,15000")));
    assert.ok(lines.some((l) => l.includes("Weekly shop")));
    // A member's export only holds their own rows.
    const memberCsv = await req(
      "GET",
      `/api/reports/export?familyId=${family.id}&month=${month}`,
      undefined,
      member.token,
      true
    );
    assert.equal(memberCsv.status, 200);
    const memberLines = memberCsv.text.trim().split("\n");
    assert.equal(memberLines.length, 2);
    assert.ok(memberLines[1].includes("Top-up"));
  });
});
