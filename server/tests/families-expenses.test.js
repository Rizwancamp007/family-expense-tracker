import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createApp } from "../src/app.js";
import { createMemoryDb } from "../src/store/db.js";

process.env.JWT_SECRET = "test-secret-for-family-tests";

let base;
let server;
let admin;
let member;
let other;
let outsider;

before(async () => {
  const app = createApp({ db: createMemoryDb() });
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      base = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
  admin = await register("Family Admin", "admin@example.com", "admin");
  member = await register("Second Member", "member@example.com");
  other = await register("Third Member", "other@example.com");
  outsider = await register("Not Family", "outsider@example.com");
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

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
    password: "at-least-8-chars",
    ...(role ? { role } : {}),
  });
  assert.equal(status, 201, `register ${email} failed: ${JSON.stringify(body)}`);
  return body;
}

let family;
let secondFamily;

describe("families", () => {
  test("creating a family returns an invite code and the creator as admin", async () => {
    const { status, body } = await post(
      "/api/families",
      { name: "Khan Family" },
      admin.token
    );
    assert.equal(status, 201);
    assert.equal(body.family.name, "Khan Family");
    assert.match(body.family.inviteCode, /^[A-Z0-9]{6}$/);
    assert.deepEqual(body.family.members, [
      { userId: admin.user.id, role: "admin" },
    ]);
    family = body.family;
  });

  test("creating a family needs a name and a login", async () => {
    const noName = await post("/api/families", {}, admin.token);
    assert.equal(noName.status, 400);
    const noAuth = await post("/api/families", { name: "Nope" });
    assert.equal(noAuth.status, 401);
  });

  test("joining with the invite code works, a bad code does not", async () => {
    const joined = await post(
      "/api/families/join",
      { inviteCode: family.inviteCode.toLowerCase() },
      member.token
    );
    assert.equal(joined.status, 200);
    assert.equal(joined.body.family.members.length, 2);

    const bad = await post(
      "/api/families/join",
      { inviteCode: "XXXXXX" },
      other.token
    );
    assert.equal(bad.status, 404);
  });

  test("joining twice is rejected", async () => {
    const again = await post(
      "/api/families/join",
      { inviteCode: family.inviteCode },
      member.token
    );
    assert.equal(again.status, 409);
  });

  test("member list shows names; outsiders get nothing", async () => {
    const { status, body } = await get(
      `/api/families/${family.id}/members`,
      member.token
    );
    assert.equal(status, 200);
    assert.equal(body.members.length, 2);
    const names = body.members.map((m) => m.name).sort();
    assert.deepEqual(names, ["Family Admin", "Second Member"]);

    const denied = await get(`/api/families/${family.id}`, outsider.token);
    assert.equal(denied.status, 403);
    const membersDenied = await get(
      `/api/families/${family.id}/members`,
      outsider.token
    );
    assert.equal(membersDenied.status, 403);
  });

  test("only the admin can remove a member, and not themselves", async () => {
    await post("/api/families/join", { inviteCode: family.inviteCode }, other.token);

    const byMember = await del(
      `/api/families/${family.id}/members/${other.user.id}`,
      member.token
    );
    assert.equal(byMember.status, 403);

    const self = await del(
      `/api/families/${family.id}/members/${admin.user.id}`,
      admin.token
    );
    assert.equal(self.status, 400);

    const removed = await del(
      `/api/families/${family.id}/members/${other.user.id}`,
      admin.token
    );
    assert.equal(removed.status, 200);
    assert.equal(removed.body.family.members.length, 2);

    const gone = await get(`/api/families/${family.id}`, other.token);
    assert.equal(gone.status, 403);
  });

  test("a second family is fully separate", async () => {
    const { status, body } = await post(
      "/api/families",
      { name: "Other Family" },
      outsider.token
    );
    assert.equal(status, 201);
    secondFamily = body.family;
    const mine = await get("/api/families/mine", outsider.token);
    assert.equal(mine.body.families.length, 1);
    assert.equal(mine.body.families[0].id, secondFamily.id);
  });
});

describe("expenses", () => {
  let memberExpense;
  let adminExpense;

  const goodExpense = {
    amount: 2500,
    category: "Groceries",
    date: "2026-11-11",
    paymentMethod: "Cash",
    note: "Weekly groceries",
  };

  test("expense validation rejects bad amount, category and date", async () => {
    const zero = await post(
      "/api/expenses",
      { ...goodExpense, familyId: family.id, amount: 0 },
      member.token
    );
    assert.equal(zero.status, 400);
    const negative = await post(
      "/api/expenses",
      { ...goodExpense, familyId: family.id, amount: -50 },
      member.token
    );
    assert.equal(negative.status, 400);
    const badCategory = await post(
      "/api/expenses",
      { ...goodExpense, familyId: family.id, category: "Yacht" },
      member.token
    );
    assert.equal(badCategory.status, 400);
    const noDate = await post(
      "/api/expenses",
      { ...goodExpense, familyId: family.id, date: undefined },
      member.token
    );
    assert.equal(noDate.status, 400);
    const badMethod = await post(
      "/api/expenses",
      { ...goodExpense, familyId: family.id, paymentMethod: "Barter" },
      member.token
    );
    assert.equal(badMethod.status, 400);
  });

  test("a member can add an expense to their family", async () => {
    const { status, body } = await post(
      "/api/expenses",
      { ...goodExpense, familyId: family.id },
      member.token
    );
    assert.equal(status, 201);
    assert.equal(body.expense.amount, 2500);
    assert.equal(body.expense.category, "Groceries");
    assert.equal(body.expense.userId, member.user.id);
    assert.equal(body.expense.familyId, family.id);
    memberExpense = body.expense;
  });

  test("an outsider cannot add expenses to a family they are not in", async () => {
    const { status } = await post(
      "/api/expenses",
      { ...goodExpense, familyId: family.id },
      outsider.token
    );
    assert.equal(status, 403);
  });

  test("the admin can add an expense too", async () => {
    const { status, body } = await post(
      "/api/expenses",
      {
        amount: 15000,
        category: "Rent",
        date: "2026-11-01",
        paymentMethod: "Bank Transfer",
        note: "November rent",
        familyId: family.id,
      },
      admin.token
    );
    assert.equal(status, 201);
    adminExpense = body.expense;
  });

  test("members only see their own expenses, admins see the whole family", async () => {
    const mine = await get(
      `/api/expenses?familyId=${family.id}`,
      member.token
    );
    assert.equal(mine.status, 200);
    assert.equal(mine.body.total, 1);
    assert.equal(mine.body.expenses[0].id, memberExpense.id);

    const all = await get(`/api/expenses?familyId=${family.id}`, admin.token);
    assert.equal(all.status, 200);
    assert.equal(all.body.total, 2);

    const otherFamily = await get(
      `/api/expenses?familyId=${family.id}`,
      outsider.token
    );
    assert.equal(otherFamily.status, 403);
  });

  test("filters narrow the list: category, date range, search", async () => {
    const byCategory = await get(
      `/api/expenses?familyId=${family.id}&category=Rent`,
      admin.token
    );
    assert.equal(byCategory.body.total, 1);
    assert.equal(byCategory.body.expenses[0].category, "Rent");

    const byDate = await get(
      `/api/expenses?familyId=${family.id}&from=2026-11-10&to=2026-11-12`,
      admin.token
    );
    assert.equal(byDate.body.total, 1);
    assert.equal(byDate.body.expenses[0].id, memberExpense.id);

    const bySearch = await get(
      `/api/expenses?familyId=${family.id}&search=rent`,
      admin.token
    );
    assert.equal(bySearch.body.total, 1);
    assert.equal(bySearch.body.expenses[0].id, adminExpense.id);

    const paged = await get(
      `/api/expenses?familyId=${family.id}&limit=1&page=2`,
      admin.token
    );
    assert.equal(paged.body.expenses.length, 1);
    assert.equal(paged.body.total, 2);
    assert.equal(paged.body.page, 2);
  });

  test("a member cannot edit or delete another member's expense", async () => {
    const edit = await put(
      `/api/expenses/${adminExpense.id}`,
      { amount: 1 },
      member.token
    );
    assert.equal(edit.status, 403);
    const remove = await del(`/api/expenses/${adminExpense.id}`, member.token);
    assert.equal(remove.status, 403);
    const view = await get(`/api/expenses/${adminExpense.id}`, member.token);
    assert.equal(view.status, 403);
  });

  test("the admin can edit any expense in the family", async () => {
    const { status, body } = await put(
      `/api/expenses/${memberExpense.id}`,
      { amount: 3000, note: "Weekly groceries, updated" },
      admin.token
    );
    assert.equal(status, 200);
    assert.equal(body.expense.amount, 3000);
    assert.equal(body.expense.note, "Weekly groceries, updated");

    const bad = await put(
      `/api/expenses/${memberExpense.id}`,
      { amount: 0 },
      admin.token
    );
    assert.equal(bad.status, 400);
  });

  test("a member can edit and delete their own expense", async () => {
    const { status, body } = await put(
      `/api/expenses/${memberExpense.id}`,
      { note: "Weekly groceries" },
      member.token
    );
    assert.equal(status, 200);
    assert.equal(body.expense.note, "Weekly groceries");

    const removed = await del(`/api/expenses/${memberExpense.id}`, member.token);
    assert.equal(removed.status, 200);
    const gone = await get(`/api/expenses/${memberExpense.id}`, admin.token);
    assert.equal(gone.status, 404);
  });

  test("one family never sees another family's expenses", async () => {
    const { status, body } = await post(
      "/api/expenses",
      { ...goodExpense, familyId: secondFamily.id },
      outsider.token
    );
    assert.equal(status, 201);
    const otherExpense = body.expense;

    const peek = await get(`/api/expenses/${otherExpense.id}`, admin.token);
    assert.equal(peek.status, 403);
    const list = await get(
      `/api/expenses?familyId=${secondFamily.id}`,
      admin.token
    );
    assert.equal(list.status, 403);
  });
});
