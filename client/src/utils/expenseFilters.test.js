import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  buildExpenseQuery,
  dateInputValue,
  formatMoney,
  monthParam,
  shiftMonth,
  todayInputValue,
  validateExpenseForm,
} from "./expenseFilters.js";

describe("buildExpenseQuery", () => {
  test("only set filters go in the query, empty ones are left out", () => {
    assert.equal(
      buildExpenseQuery({
        category: "Groceries",
        from: "2026-11-01",
        to: "",
        search: "  ",
        memberId: undefined,
        page: 2,
      }),
      "category=Groceries&from=2026-11-01&page=2"
    );
  });

  test("search text is sent as-is and everything is encoded", () => {
    const q = buildExpenseQuery({ search: "school fees" });
    assert.equal(q, "search=school+fees");
  });

  test("no filters means an empty query", () => {
    assert.equal(buildExpenseQuery({}), "");
  });
});

describe("month helpers", () => {
  test("monthParam formats YYYY-MM", () => {
    assert.equal(monthParam(new Date(2026, 10, 12)), "2026-11");
    assert.equal(monthParam(new Date(2026, 0, 5)), "2026-01");
  });

  test("shiftMonth steps across year boundaries", () => {
    assert.equal(shiftMonth("2026-11", 1), "2026-12");
    assert.equal(shiftMonth("2026-12", 1), "2027-01");
    assert.equal(shiftMonth("2026-01", -1), "2025-12");
    assert.equal(shiftMonth("2026-11", -1), "2026-10");
  });

  test("dateInputValue formats a date input value", () => {
    assert.equal(dateInputValue(new Date(2026, 10, 5)), "2026-11-05");
  });

  test("todayInputValue is today", () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    assert.equal(todayInputValue(), expected);
  });
});

describe("formatMoney", () => {
  test("whole amounts show without decimals, large ones grouped", () => {
    assert.equal(formatMoney(1250), "Rs 1,250");
    assert.equal(formatMoney(50000), "Rs 50,000");
    assert.equal(formatMoney(99.5), "Rs 99.5");
  });

  test("bad input falls back to zero", () => {
    assert.equal(formatMoney("nope"), "Rs 0");
  });
});

describe("validateExpenseForm", () => {
  test("a good form has no errors", () => {
    assert.deepEqual(
      validateExpenseForm({ amount: "250", category: "Groceries", date: "2026-11-12" }),
      {}
    );
  });

  test("bad amount, missing category and missing date are all flagged", () => {
    const errors = validateExpenseForm({ amount: "0", category: "", date: "" });
    assert.equal(errors.amount, "Amount must be more than 0");
    assert.equal(errors.category, "Pick a category");
    assert.equal(errors.date, "Pick a date");
  });

  test("a negative amount and a nonsense date are flagged", () => {
    const errors = validateExpenseForm({
      amount: "-50",
      category: "Rent",
      date: "not a date",
    });
    assert.ok(errors.amount);
    assert.ok(errors.date);
    assert.equal(errors.category, undefined);
  });
});
