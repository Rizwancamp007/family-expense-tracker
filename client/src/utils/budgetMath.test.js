import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  budgetBarWidth,
  budgetPercent,
  budgetRemaining,
  isOverBudget,
} from "./budgetMath.js";

describe("budgetPercent", () => {
  test("half used is 50, fully used is 100, over is more than 100", () => {
    assert.equal(budgetPercent(5000, 10000), 50);
    assert.equal(budgetPercent(10000, 10000), 100);
    assert.equal(budgetPercent(11000, 10000), 110);
    assert.equal(budgetPercent(333, 1000), 33.3);
  });

  test("no limit, or a zero limit, is 0 percent", () => {
    assert.equal(budgetPercent(500, 0), 0);
    assert.equal(budgetPercent(500, undefined), 0);
    assert.equal(budgetPercent(0, 10000), 0);
  });
});

describe("budgetBarWidth", () => {
  test("the bar never goes past 100 or below 0", () => {
    assert.equal(budgetBarWidth(15000, 10000), 100);
    assert.equal(budgetBarWidth(5000, 10000), 50);
    assert.equal(budgetBarWidth(0, 10000), 0);
  });
});

describe("budgetRemaining and isOverBudget", () => {
  test("remaining is limit minus spent, negative when over", () => {
    assert.equal(budgetRemaining(10000, 6000), 4000);
    assert.equal(budgetRemaining(10000, 11000), -1000);
    assert.equal(budgetRemaining(10000, 10000), 0);
  });

  test("over budget only when spent is above a positive limit", () => {
    assert.equal(isOverBudget(11000, 10000), true);
    assert.equal(isOverBudget(10000, 10000), false);
    assert.equal(isOverBudget(500, 0), false);
  });
});
