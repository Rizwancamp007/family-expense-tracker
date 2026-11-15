import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createApp } from "../src/app.js";
import { createMemoryDb } from "../src/store/db.js";

process.env.JWT_SECRET = "test-secret";

let base;
let server;

before(async () => {
  const app = createApp({ db: createMemoryDb() });
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

async function raw(path, body, contentType = "application/json") {
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": contentType },
    body,
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

describe("error handling", () => {
  test("a body that isn't valid JSON gets a 400 with a plain message", async () => {
    const { status, body } = await raw("/api/auth/login", "{not json");
    assert.equal(status, 400);
    assert.equal(typeof body.message, "string");
    assert.ok(body.message.length > 0);
  });

  test("an unknown path still answers JSON, not an HTML error page", async () => {
    const res = await fetch(`${base}/api/nope`);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.message, "Not found");
  });

  test("a good request still works after a bad one", async () => {
    await raw("/api/auth/login", "{not json");
    const res = await fetch(`${base}/health`);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).status, "ok");
  });
});
