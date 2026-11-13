import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createApp } from "../src/app.js";
import { budgetStatus, monthRange } from "../src/services/budgets.js";
import { monthKey } from "../src/services/summary.js";
import { createMemoryDb } from "../src/store/db.js";

process.env.JWT_SECRET = "test-secret-for-budget-tests";

describe("budgetStatus", () => {
  const budgets = [
    { category: "Overall", amount: 50000 },
    { category: "Groceries", amount: 10000 },
    { category: "Rent", amount: 15000 },
    { category: "Transport", amount: 3000 },
  ];
  const expenses = [
    { amount: 6000, category: "Groceries", date: "2026-11-05T10:00:00.000Z" },
    { amount: 5000, category: "Groceries", date: "2026-11-20T10:00:00.000Z" },
    { amount: 15000, category: "Rent", date: "2026-11-01T10:00:00.000Z" },
    { amount: 1000, category: "Health", date: "2026-11-10T10:00:00.000Z" },
    { amount: 9000, category: "Groceries", date: "2026-10-31T10:00:00.000Z" },
  ];

  test("spent, remaining and percent per category, sorted by percent used", () => {
    const status = budgetStatus(budgets, expenses, "2026-11");
    assert.equal(status.month, "2026-11");
    // October groceries and the unbudgeted Health spend don't count in
    // their categories, but Health does count towards the overall total.
    assert.equal(status.totalSpent, 27000);
    assert.deepEqual(status.overall, {
      category: "Overall",
      limit: 50000,
      spent: 27000,
      remaining: 23000,
      percent: 54,
      overBudget: false,
    });
    assert.deepEqual(status.categories, [
      {
        category: "Groceries",
        limit: 10000,
        spent: 11000,
        remaining: -1000,
        percent: 110,
        overBudget: true,
      },
      {
        category: "Rent",
        limit: 15000,
        spent: 15000,
        remaining: 0,
        percent: 100,
        overBudget: false,
      },
      {
        category: "Transport",
        limit: 3000,
        spent: 0,
        remaining: 3000,
        percent: 0,
        overBudget: false,
      },
    ]);
  });

  test("no budgets means no overall and no categories, but totals still count", () => {
    const status = budgetStatus([], expenses, "2026-11");
    assert.equal(status.overall, null);
    assert.deepEqual(status.categories, []);
    assert.equal(status.totalSpent, 27000);
  });

  test("monthRange covers the whole month", () => {
    const { from, to } = monthRange("2026-11");
    assert.equal(new Date(from).toISOString().slice(0, 10), "2026-11-01");
    assert.equal(new Date(to).toISOString().slice(0, 10), "2026-11-30");
  });
});

describe("budgets API", () => {
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
  const put = (p, b, t) => req("PUT", p, b, t);
  const del = (p, t) => req("DELETE", p, undefined, t);

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
    admin = await register("Family Admin", "bud-admin@example.com", "admin");
    member = await register("Second Member", "bud-member@example.com");
    outsider = await register("Not Family", "bud-outsider@example.com");
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
    // Admin spent 6000 on groceries, member spent 4000 — the status
    // endpoint should show the family total to the admin and only the
    // member's own 4000 to the member.
    await post(
      "/api/expenses",
      {
        familyId: family.id,
        amount: 6000,
        category: "Groceries",
        date: today,
      },
      admin.token
    );
    await post(
      "/api/expenses",
      {
        familyId: family.id,
        amount: 4000,
        category: "Groceries",
        date: today,
      },
      member.token
    );
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  test("only the admin can set a budget; bad values are rejected", async () => {
    const byMember = await put(
      "/api/budgets",
      { familyId: family.id, month, category: "Groceries", amount: 10000 },
      member.token
    );
    assert.equal(byMember.status, 403);

    const byOutsider = await put(
      "/api/budgets",
      { familyId: family.id, month, category: "Groceries", amount: 10000 },
      outsider.token
    );
    assert.equal(byOutsider.status, 403);

    const zero = await put(
      "/api/budgets",
      { familyId: family.id, month, category: "Groceries", amount: 0 },
      admin.token
    );
    assert.equal(zero.status, 400);
    const badCategory = await put(
      "/api/budgets",
      { familyId: family.id, month, category: "Yacht", amount: 10000 },
      admin.token
    );
    assert.equal(badCategory.status, 400);
    const badMonth = await put(
      "/api/budgets",
      { familyId: family.id, month: "november", category: "Groceries", amount: 10000 },
      admin.token
    );
    assert.equal(badMonth.status, 400);
    const noAuth = await put("/api/budgets", {
      familyId: family.id,
      month,
      category: "Groceries",
      amount: 10000,
    });
    assert.equal(noAuth.status, 401);
  });

  test("the admin can set budgets, and setting one again updates it", async () => {
    const first = await put(
      "/api/budgets",
      { familyId: family.id, month, category: "Groceries", amount: 8000 },
      admin.token
    );
    assert.equal(first.status, 200);
    assert.equal(first.body.budget.category, "Groceries");
    assert.equal(first.body.budget.amount, 8000);
    assert.equal(first.body.budget.month, month);

    const overall = await put(
      "/api/budgets",
      { familyId: family.id, month, category: "Overall", amount: 50000 },
      admin.token
    );
    assert.equal(overall.status, 200);

    const updated = await put(
      "/api/budgets",
      { familyId: family.id, month, category: "Groceries", amount: 10000 },
      admin.token
    );
    assert.equal(updated.status, 200);
    assert.equal(updated.body.budget.amount, 10000);

    const listed = await get(
      `/api/budgets?familyId=${family.id}&month=${month}`,
      member.token
    );
    assert.equal(listed.status, 200);
    assert.equal(listed.body.budgets.length, 2);
  });

  test("status shows family totals to the admin, own spending to a member", async () => {
    const adminView = await get(
      `/api/budgets/status?familyId=${family.id}&month=${month}`,
      admin.token
    );
    assert.equal(adminView.status, 200);
    const s = adminView.body.status;
    assert.equal(s.month, month);
    assert.equal(s.totalSpent, 10000);
    assert.equal(s.overall.spent, 10000);
    assert.equal(s.overall.limit, 50000);
    assert.equal(s.overall.remaining, 40000);
    assert.equal(s.overall.overBudget, false);
    assert.equal(s.categories.length, 1);
    assert.equal(s.categories[0].category, "Groceries");
    assert.equal(s.categories[0].limit, 10000);
    assert.equal(s.categories[0].spent, 10000);
    assert.equal(s.categories[0].remaining, 0);
    assert.equal(s.categories[0].percent, 100);
    assert.equal(s.categories[0].overBudget, false);

    const memberView = await get(
      `/api/budgets/status?familyId=${family.id}&month=${month}`,
      member.token
    );
    assert.equal(memberView.status, 200);
    assert.equal(memberView.body.status.totalSpent, 4000);
    assert.equal(memberView.body.status.categories[0].spent, 4000);
    assert.equal(memberView.body.status.categories[0].remaining, 6000);
    assert.equal(memberView.body.status.categories[0].percent, 40);
  });

  test("an over-budget category is flagged in the status", async () => {
    await put(
      "/api/budgets",
      { familyId: family.id, month, category: "Groceries", amount: 9000 },
      admin.token
    );
    const { status, body } = await get(
      `/api/budgets/status?familyId=${family.id}&month=${month}`,
      admin.token
    );
    assert.equal(status, 200);
    assert.equal(body.status.categories[0].overBudget, true);
    assert.equal(body.status.categories[0].remaining, -1000);
    // Put the limit back so later tests see the original numbers.
    await put(
      "/api/budgets",
      { familyId: family.id, month, category: "Groceries", amount: 10000 },
      admin.token
    );
  });

  test("only the admin can remove a budget, and outsiders get nothing", async () => {
    const byMember = await del(
      `/api/budgets?familyId=${family.id}&month=${month}&category=Overall`,
      member.token
    );
    assert.equal(byMember.status, 403);

    const denied = await get(
      `/api/budgets/status?familyId=${family.id}&month=${month}`,
      outsider.token
    );
    assert.equal(denied.status, 403);
    const badMonth = await get(
      `/api/budgets/status?familyId=${family.id}&month=november`,
      admin.token
    );
    assert.equal(badMonth.status, 400);

    const removed = await del(
      `/api/budgets?familyId=${family.id}&month=${month}&category=Overall`,
      admin.token
    );
    assert.equal(removed.status, 200);
    const gone = await del(
      `/api/budgets?familyId=${family.id}&month=${month}&category=Overall`,
      admin.token
    );
    assert.equal(gone.status, 404);

    const listed = await get(
      `/api/budgets?familyId=${family.id}&month=${month}`,
      admin.token
    );
    assert.equal(listed.body.budgets.length, 1);
    assert.equal(listed.body.budgets[0].category, "Groceries");
  });
});
