import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createApp } from "../src/app.js";
import {
  monthKey,
  summarizeExpenses,
  summaryWindow,
} from "../src/services/summary.js";
import { createMemoryDb } from "../src/store/db.js";

process.env.JWT_SECRET = "test-secret";

describe("summarizeExpenses", () => {
  const now = new Date("2026-11-12T15:00:00");
  const names = { u1: "Ayesha", u2: "Bilal" };
  const expenses = [
    { userId: "u1", amount: 1200, category: "Groceries", date: "2026-11-12T10:00:00.000Z" },
    { userId: "u2", amount: 800, category: "Groceries", date: "2026-11-09T10:00:00.000Z" },
    { userId: "u1", amount: 5000, category: "Rent", date: "2026-11-01T10:00:00.000Z" },
    { userId: "u1", amount: 300, category: "Transport", date: "2026-11-04T10:00:00.000Z" },
    { userId: "u2", amount: 400, category: "Health", date: "2026-10-28T10:00:00.000Z" },
  ];

  test("month total, top category and per-member totals for the month", () => {
    const summary = summarizeExpenses(expenses, {
      month: "2026-11",
      now,
      memberNames: names,
    });
    assert.equal(summary.month, "2026-11");
    assert.equal(summary.monthTotal, 7300);
    assert.equal(summary.expenseCount, 4);
    assert.deepEqual(summary.topCategory, { category: "Rent", total: 5000 });
    assert.deepEqual(summary.perMember, [
      { userId: "u1", name: "Ayesha", total: 6500 },
      { userId: "u2", name: "Bilal", total: 800 },
    ]);
  });

  test("week total only counts the last 7 days", () => {
    const summary = summarizeExpenses(expenses, {
      month: "2026-11",
      now,
      memberNames: names,
    });
    // Nov 12 + Nov 9 are inside the week; Nov 4, Nov 1 and Oct 28 are not.
    assert.equal(summary.weekTotal, 2000);
  });

  test("an empty month has zero totals and no top category", () => {
    const summary = summarizeExpenses([], { month: "2026-11", now });
    assert.equal(summary.monthTotal, 0);
    assert.equal(summary.weekTotal, 0);
    assert.equal(summary.topCategory, null);
    assert.deepEqual(summary.perMember, []);
    assert.equal(summary.expenseCount, 0);
  });

  test("summaryWindow covers the month and the week reaching back", () => {
    const { from, to } = summaryWindow("2026-11", now);
    assert.ok(new Date(from) <= new Date("2026-11-01T00:00:00.000Z"));
    assert.ok(new Date(to) >= new Date("2026-11-30T23:59:59.000Z"));
    // The week reaches back to Nov 6, inside the month, so the window
    // starts at the month itself.
    assert.equal(new Date(from).toISOString().slice(0, 10), "2026-11-01");
  });

  test("summaryWindow reaches into the previous month early in a month", () => {
    const early = new Date("2026-11-03T15:00:00");
    const { from } = summaryWindow("2026-11", early);
    assert.equal(new Date(from).toISOString().slice(0, 10), "2026-10-28");
  });
});

describe("GET /api/expenses/summary", () => {
  let base;
  let server;
  let admin;
  let member;
  let outsider;
  let family;

  async function req(method, path, body, token) {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  }
  const post = (p, b, t) => req("POST", p, b, t);
  const get = (p, t) => req("GET", p, undefined, t);

  // Fixtures are dated relative to today so the test holds on any day:
  // today, 3 days ago, 8 days ago, and one day last month. Expected
  // totals are worked out from those dates in the tests below.
  const fixtures = [
    { who: "admin", amount: 1200, category: "Groceries", daysAgo: 0 },
    { who: "member", amount: 800, category: "Groceries", daysAgo: 3 },
    { who: "admin", amount: 5000, category: "Rent", daysAgo: 8 },
    { who: "member", amount: 400, category: "Health", monthsAgo: 1 },
  ];
  const fixtureDates = [];

  function inCurrentMonth(date) {
    const now = new Date();
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth()
    );
  }

  function inLastWeek(date) {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(now);
    dayEnd.setHours(23, 59, 59, 999);
    return date >= weekStart && date <= dayEnd;
  }

  function expectedTotals(who) {
    let monthTotal = 0;
    let weekTotal = 0;
    let expenseCount = 0;
    const byMember = new Map();
    const byCategory = new Map();
    fixtures.forEach((f, i) => {
      if (who && f.who !== who) return;
      const date = fixtureDates[i];
      if (inLastWeek(date)) weekTotal += f.amount;
      if (!inCurrentMonth(date)) return;
      monthTotal += f.amount;
      expenseCount += 1;
      byMember.set(f.who, (byMember.get(f.who) || 0) + f.amount);
      byCategory.set(f.category, (byCategory.get(f.category) || 0) + f.amount);
    });
    let topCategory = null;
    for (const [category, total] of byCategory) {
      if (!topCategory || total > topCategory.total) {
        topCategory = { category, total };
      }
    }
    return { monthTotal, weekTotal, expenseCount, topCategory, byMember };
  }

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

  async function addExpense(token, fields) {
    const { status, body } = await post("/api/expenses", {
      familyId: family.id,
      amount: 100,
      category: "Groceries",
      date: new Date().toISOString().slice(0, 10),
      ...fields,
    }, token);
    assert.equal(status, 201, JSON.stringify(body));
    return body.expense;
  }

  before(async () => {
    const app = createApp({ db: createMemoryDb() });
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        base = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });
    admin = await register("Family Admin", "sum-admin@example.com", "admin");
    member = await register("Second Member", "sum-member@example.com");
    outsider = await register("Not Family", "sum-outsider@example.com");
    const created = await post("/api/families", { name: "Khan Family" }, admin.token);
    family = created.body.family;
    await post("/api/families/join", { inviteCode: family.inviteCode }, member.token);
    const tokens = { admin: admin.token, member: member.token };
    for (const f of fixtures) {
      const date = new Date();
      if (f.monthsAgo) date.setMonth(date.getMonth() - f.monthsAgo);
      if (f.daysAgo !== undefined) date.setDate(date.getDate() - f.daysAgo);
      fixtureDates.push(date);
      await addExpense(tokens[f.who], {
        amount: f.amount,
        category: f.category,
        date: date.toISOString().slice(0, 10),
      });
    }
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  test("admin sees the whole family's month: totals, top category, per-member", async () => {
    const month = monthKey(new Date());
    const { status, body } = await get(
      `/api/expenses/summary?familyId=${family.id}&month=${month}`,
      admin.token
    );
    assert.equal(status, 200);
    const s = body.summary;
    const expected = expectedTotals();
    assert.equal(s.month, month);
    assert.equal(s.monthTotal, expected.monthTotal);
    assert.equal(s.weekTotal, expected.weekTotal);
    assert.equal(s.expenseCount, expected.expenseCount);
    assert.deepEqual(s.topCategory, expected.topCategory);
    const expectedMembers = [...expected.byMember.entries()]
      .map(([who, total]) => ({
        userId: who === "admin" ? admin.user.id : member.user.id,
        name: who === "admin" ? "Family Admin" : "Second Member",
        total,
      }))
      .sort((a, b) => b.total - a.total);
    assert.deepEqual(s.perMember, expectedMembers);
  });

  test("a member only sees their own spending in the summary", async () => {
    const month = monthKey(new Date());
    const { status, body } = await get(
      `/api/expenses/summary?familyId=${family.id}&month=${month}`,
      member.token
    );
    assert.equal(status, 200);
    const expected = expectedTotals("member");
    assert.equal(body.summary.monthTotal, expected.monthTotal);
    assert.equal(body.summary.expenseCount, expected.expenseCount);
    assert.deepEqual(body.summary.perMember, [
      { userId: member.user.id, name: "Second Member", total: expected.monthTotal },
    ]);
  });

  test("summary defaults to the current month and rejects a bad month", async () => {
    const current = await get(
      `/api/expenses/summary?familyId=${family.id}`,
      admin.token
    );
    assert.equal(current.status, 200);
    assert.equal(current.body.summary.month, monthKey(new Date()));

    const bad = await get(
      `/api/expenses/summary?familyId=${family.id}&month=november`,
      admin.token
    );
    assert.equal(bad.status, 400);
  });

  test("outsiders and missing familyId get nothing", async () => {
    const denied = await get(
      `/api/expenses/summary?familyId=${family.id}`,
      outsider.token
    );
    assert.equal(denied.status, 403);
    const missing = await get("/api/expenses/summary", admin.token);
    assert.equal(missing.status, 400);
  });
});
