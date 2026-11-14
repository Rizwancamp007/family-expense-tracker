import express from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { buildMonthlyReport, expensesToCsv } from "../services/analytics.js";
import { monthRange } from "../services/budgets.js";
import { monthKey } from "../services/summary.js";
import { familyMembership, isFamilyAdmin } from "./families.js";

const MONTH_PATTERN = /^\d{4}-\d{2}$/;

export function createReportsRouter(db) {
  const router = express.Router();
  const { families, expenses, budgets, users } = db;

  // The family the request is about, and proof this user belongs to it.
  async function loadFamily(req, res) {
    const familyId = req.query.familyId;
    if (!familyId) {
      res.status(400).json({ message: "familyId is required" });
      return null;
    }
    const family = await families.findById(familyId);
    if (!family || !familyMembership(family, req.user.id)) {
      res.status(403).json({ message: "You are not part of this family" });
      return null;
    }
    return family;
  }

  function validMonth(month) {
    return typeof month === "string" && MONTH_PATTERN.test(month);
  }

  // The month's expenses, scoped the same way as the budget status:
  // admins see the whole family, members see only their own spending.
  async function loadMonthData(family, month, req) {
    const admin = isFamilyAdmin(family, req.user.id);
    const userId = admin ? undefined : String(req.user.id);
    const { from, to } = monthRange(month);
    const { items } = await expenses.list({
      familyId: String(family.id ?? family._id),
      userId,
      from,
      to,
      page: 1,
      limit: 10000,
    });
    const memberNames = {};
    for (const expense of items) {
      const id = String(expense.userId);
      if (!(id in memberNames)) {
        const user = await users.findById(id);
        memberNames[id] = user?.name || "Unknown";
      }
    }
    const rows = await budgets.list({
      familyId: String(family.id ?? family._id),
      month,
    });
    return { items, memberNames, rows };
  }

  // The monthly report: totals, trend, category and member breakdowns,
  // top categories and spenders, and how the month did against budgets.
  router.get(
    "/monthly",
    requireAuth,
    asyncHandler(async (req, res) => {
      const family = await loadFamily(req, res);
      if (!family) return;
      const month = req.query.month || monthKey(new Date());
      if (!validMonth(month)) {
        return res
          .status(400)
          .json({ message: "month must look like YYYY-MM" });
      }
      const { items, memberNames, rows } = await loadMonthData(family, month, req);
      return res.json({
        report: buildMonthlyReport({
          expenses: items,
          budgets: rows,
          month,
          memberNames,
        }),
      });
    })
  );

  // The same month as a CSV download, for a spreadsheet or a printed record.
  router.get(
    "/export",
    requireAuth,
    asyncHandler(async (req, res) => {
      const family = await loadFamily(req, res);
      if (!family) return;
      const month = req.query.month || monthKey(new Date());
      if (!validMonth(month)) {
        return res
          .status(400)
          .json({ message: "month must look like YYYY-MM" });
      }
      const { items, memberNames } = await loadMonthData(family, month, req);
      const csv = expensesToCsv(items, month, memberNames);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="expenses-${month}.csv"`
      );
      return res.send(csv);
    })
  );

  return router;
}
