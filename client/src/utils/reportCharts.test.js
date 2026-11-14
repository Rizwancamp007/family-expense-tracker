import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  budgetChartData,
  categoryChartData,
  memberChartData,
  trendChartData,
} from "./reportCharts.js";

describe("trendChartData", () => {
  test("one label and one point per day, values match the trend", () => {
    const data = trendChartData([
      { date: "2026-11-01", total: 15000 },
      { date: "2026-11-02", total: 3500 },
      { date: "2026-11-03", total: 0 },
    ]);
    assert.deepEqual(data.labels, ["11-01", "11-02", "11-03"]);
    assert.deepEqual(data.datasets[0].data, [15000, 3500, 0]);
  });

  test("an empty trend gives empty labels and data, not a crash", () => {
    const data = trendChartData([]);
    assert.deepEqual(data.labels, []);
    assert.deepEqual(data.datasets[0].data, []);
  });
});

describe("categoryChartData", () => {
  test("labels and totals line up, and the slices sum to the month total", () => {
    const data = categoryChartData([
      { category: "Rent", total: 15000, percent: 77.7 },
      { category: "Groceries", total: 3500, percent: 18.1 },
    ]);
    assert.deepEqual(data.labels, ["Rent", "Groceries"]);
    assert.deepEqual(data.datasets[0].data, [15000, 3500]);
    assert.equal(
      data.datasets[0].data.reduce((sum, n) => sum + n, 0),
      18500
    );
  });
});

describe("memberChartData", () => {
  test("one bar per member, names as labels", () => {
    const data = memberChartData([
      { userId: "u1", name: "Ayesha", total: 17000 },
      { userId: "u2", name: "Bilal", total: 2300 },
    ]);
    assert.deepEqual(data.labels, ["Ayesha", "Bilal"]);
    assert.deepEqual(data.datasets[0].data, [17000, 2300]);
  });
});

describe("budgetChartData", () => {
  test("spent and budget side by side per category", () => {
    const data = budgetChartData({
      categories: [
        { category: "Groceries", limit: 10000, spent: 11000 },
        { category: "Rent", limit: 15000, spent: 15000 },
      ],
    });
    assert.deepEqual(data.labels, ["Groceries", "Rent"]);
    assert.deepEqual(data.datasets[0].data, [11000, 15000]);
    assert.deepEqual(data.datasets[1].data, [10000, 15000]);
  });

  test("no budgets means empty chart data, not a crash", () => {
    const data = budgetChartData({ categories: [] });
    assert.deepEqual(data.labels, []);
    assert.deepEqual(data.datasets[0].data, []);
    assert.deepEqual(budgetChartData(null).labels, []);
  });
});
