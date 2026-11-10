import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createApp } from "../src/app.js";
import { requireRole } from "../src/middleware/auth.js";
import { createMemoryStore } from "../src/store/users.js";

process.env.JWT_SECRET = "test-secret-for-auth-tests";

let base;
let server;

before(async () => {
  const app = createApp({ store: createMemoryStore() });
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      base = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

async function post(path, body, token) {
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function get(path, token) {
  const res = await fetch(`${base}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

describe("auth", () => {
  test("health returns ok", async () => {
    const { status, body } = await get("/health");
    assert.equal(status, 200);
    assert.equal(body.status, "ok");
  });

  test("register creates a member and returns a token", async () => {
    const { status, body } = await post("/api/auth/register", {
      name: "Ayesha Khan",
      email: "ayesha@example.com",
      password: "at-least-8-chars",
    });
    assert.equal(status, 201);
    assert.equal(body.user.email, "ayesha@example.com");
    assert.equal(body.user.role, "member");
    assert.equal(body.user.passwordHash, undefined);
    assert.ok(body.token);
  });

  test("register accepts an admin role", async () => {
    const { status, body } = await post("/api/auth/register", {
      name: "Admin User",
      email: "admin@example.com",
      password: "at-least-8-chars",
      role: "admin",
    });
    assert.equal(status, 201);
    assert.equal(body.user.role, "admin");
  });

  test("register rejects a short password and a bad role", async () => {
    const short = await post("/api/auth/register", {
      name: "Short",
      email: "short@example.com",
      password: "short",
    });
    assert.equal(short.status, 400);
    const badRole = await post("/api/auth/register", {
      name: "Bad",
      email: "bad@example.com",
      password: "at-least-8-chars",
      role: "owner",
    });
    assert.equal(badRole.status, 400);
  });

  test("register rejects a duplicate email", async () => {
    const { status } = await post("/api/auth/register", {
      name: "Again",
      email: "ayesha@example.com",
      password: "at-least-8-chars",
    });
    assert.equal(status, 409);
  });

  test("login works and a wrong password does not", async () => {
    const ok = await post("/api/auth/login", {
      email: "ayesha@example.com",
      password: "at-least-8-chars",
    });
    assert.equal(ok.status, 200);
    assert.ok(ok.body.token);
    const bad = await post("/api/auth/login", {
      email: "ayesha@example.com",
      password: "wrong-password",
    });
    assert.equal(bad.status, 401);
  });

  test("me needs a valid token", async () => {
    const none = await get("/api/auth/me");
    assert.equal(none.status, 401);
    const bad = await get("/api/auth/me", "not-a-token");
    assert.equal(bad.status, 401);
    const { body: login } = await post("/api/auth/login", {
      email: "ayesha@example.com",
      password: "at-least-8-chars",
    });
    const me = await get("/api/auth/me", login.token);
    assert.equal(me.status, 200);
    assert.equal(me.body.user.email, "ayesha@example.com");
  });

  test("member cannot use an admin-only route", () => {
    const guard = requireRole("admin");
    let code = null;
    const res = {
      status(c) {
        code = c;
        return this;
      },
      json() {
        return this;
      },
    };
    guard({ user: { role: "member" } }, res, () => {
      code = "next";
    });
    assert.equal(code, 403);
    guard({ user: { role: "admin" } }, res, () => {
      code = "next";
    });
    assert.equal(code, "next");
  });

  test("register fails cleanly when no JWT secret is set", async () => {
    const saved = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    try {
      const { status, body } = await post("/api/auth/register", {
        name: "No Secret",
        email: "nosecret@example.com",
        password: "at-least-8-chars",
      });
      assert.equal(status, 500);
      assert.equal(body.message, "Server auth is not configured");
    } finally {
      process.env.JWT_SECRET = saved;
    }
  });
});
