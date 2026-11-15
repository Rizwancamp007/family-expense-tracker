import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { isSessionExpired } from "./session.js";

describe("isSessionExpired", () => {
  test("a 401 from the server means the session expired", () => {
    assert.equal(isSessionExpired({ status: 401 }), true);
    const err = new Error("Your session expired — log in again");
    err.status = 401;
    assert.equal(isSessionExpired(err), true);
  });

  test("other failures are not a session problem", () => {
    assert.equal(isSessionExpired({ status: 403 }), false);
    assert.equal(isSessionExpired({ status: 500 }), false);
    assert.equal(isSessionExpired(new Error("Could not reach the server")), false);
    assert.equal(isSessionExpired(null), false);
    assert.equal(isSessionExpired(undefined), false);
  });
});
