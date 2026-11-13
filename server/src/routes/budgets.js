import express from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { BUDGET_CATEGORIES } from "../models/Budget.js";
import { monthKey } from "../services/summary.js";
import { budgetStatus, monthRange } from "../services/budgets.js";
import { publicBudget } from "../store/budgets.js";
import { familyMembership, isFamilyAdmin } from "./families.js";

const MONTH_PATTERN = /^\d{4}-\d{2}$/;

export function createBudgetsRouter(db) {
  const router = express.Router();
  const { families, expenses, budgets } = db;

  // The family the request is about, and proof this user belongs to it.
  async function loadFamily(req, res) {
    const familyId = req.body?.familyId || req.query.familyId;
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

  // Every budget set for one month. Any family member can read them.
  router.get(
    "/",
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
      const rows = await budgets.list({
        familyId: String(family.id ?? family._id),
        month,
      });
      return res.json({ budgets: rows.map(publicBudget) });
    })
  );

  // What was spent against each budget this month. Admins see the whole
  // family's spending; members see their own spending against the same
  // limits, so the numbers match what they can actually change.
  router.get(
    "/status",
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
      const rows = await budgets.list({
        familyId: String(family.id ?? family._id),
        month,
      });
      return res.json({ status: budgetStatus(rows, items, month) });
    })
  );

  // Set (or change) one budget. Admin only — members can read budgets
  // but never write them.
  router.put(
    "/",
    requireAuth,
    asyncHandler(async (req, res) => {
      const family = await loadFamily(req, res);
      if (!family) return;
      if (!isFamilyAdmin(family, req.user.id)) {
        return res
          .status(403)
          .json({ message: "Only the family admin can set budgets" });
      }
      const { month, category } = req.body || {};
      const amount = Number(req.body?.amount);
      if (!validMonth(month)) {
        return res
          .status(400)
          .json({ message: "month must look like YYYY-MM" });
      }
      if (!BUDGET_CATEGORIES.includes(category)) {
        return res.status(400).json({
          message: `Category must be one of: ${BUDGET_CATEGORIES.join(", ")}`,
        });
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        return res
          .status(400)
          .json({ message: "Amount must be more than 0" });
      }
      const saved = await budgets.upsert({
        familyId: String(family.id ?? family._id),
        month,
        category,
        amount,
      });
      return res.json({ budget: publicBudget(saved) });
    })
  );

  // Remove one budget. Admin only.
  router.delete(
    "/",
    requireAuth,
    asyncHandler(async (req, res) => {
      const family = await loadFamily(req, res);
      if (!family) return;
      if (!isFamilyAdmin(family, req.user.id)) {
        return res
          .status(403)
          .json({ message: "Only the family admin can remove budgets" });
      }
      const { month, category } = req.query;
      if (!validMonth(month)) {
        return res
          .status(400)
          .json({ message: "month must look like YYYY-MM" });
      }
      if (!BUDGET_CATEGORIES.includes(category)) {
        return res.status(400).json({
          message: `Category must be one of: ${BUDGET_CATEGORIES.join(", ")}`,
        });
      }
      const removed = await budgets.remove({
        familyId: String(family.id ?? family._id),
        month,
        category,
      });
      if (!removed) {
        return res.status(404).json({ message: "Budget not found" });
      }
      return res.json({ message: "Budget removed" });
    })
  );

  return router;
}
