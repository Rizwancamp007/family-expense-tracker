import express from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { CATEGORIES, PAYMENT_METHODS } from "../models/Expense.js";
import {
  monthKey,
  summarizeExpenses,
  summaryWindow,
} from "../services/summary.js";
import { publicExpense } from "../store/expenses.js";
import { familyMembership, isFamilyAdmin } from "./families.js";

// Shared validation for create + update, so both reject the same bad data.
function validateExpense(body, partial = false) {
  const errors = [];
  const patch = {};

  if (body.amount !== undefined || !partial) {
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      errors.push("Amount must be more than 0");
    } else {
      patch.amount = amount;
    }
  }

  if (body.category !== undefined || !partial) {
    if (!CATEGORIES.includes(body.category)) {
      errors.push(`Category must be one of: ${CATEGORIES.join(", ")}`);
    } else {
      patch.category = body.category;
    }
  }

  if (body.date !== undefined || !partial) {
    const date = new Date(body.date);
    if (!body.date || Number.isNaN(date.getTime())) {
      errors.push("A valid date is required");
    } else {
      patch.date = date;
    }
  }

  if (body.paymentMethod !== undefined) {
    if (!PAYMENT_METHODS.includes(body.paymentMethod)) {
      errors.push(`Payment method must be one of: ${PAYMENT_METHODS.join(", ")}`);
    } else {
      patch.paymentMethod = body.paymentMethod;
    }
  }

  if (body.note !== undefined) {
    if (typeof body.note !== "string") {
      errors.push("Note must be text");
    } else {
      patch.note = body.note.trim();
    }
  }

  return { errors, patch };
}

export function createExpensesRouter(db) {
  const router = express.Router();
  const { families, expenses, users } = db;

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

  // An expense plus the family check: it exists, it's in this family, and
  // this user may touch it (own expense, or family admin).
  async function loadExpense(req, res) {
    const expense = await expenses.findById(req.params.id);
    if (!expense) {
      res.status(404).json({ message: "Expense not found" });
      return null;
    }
    const family = await families.findById(expense.familyId);
    if (!family || !familyMembership(family, req.user.id)) {
      res.status(403).json({ message: "You are not part of this family" });
      return null;
    }
    if (
      String(expense.userId) !== String(req.user.id) &&
      !isFamilyAdmin(family, req.user.id)
    ) {
      res
        .status(403)
        .json({ message: "You can only change your own expenses" });
      return null;
    }
    return { expense, family };
  }

  router.post(
    "/",
    requireAuth,
    asyncHandler(async (req, res) => {
      const family = await loadFamily(req, res);
      if (!family) return;
      const { errors, patch } = validateExpense(req.body);
      if (errors.length) return res.status(400).json({ message: errors[0] });
      const expense = await expenses.create({
        familyId: String(family.id ?? family._id),
        userId: String(req.user.id),
        paymentMethod: "Cash",
        note: "",
        ...patch,
      });
      return res.status(201).json({ expense: publicExpense(expense) });
    })
  );

  router.get(
    "/",
    requireAuth,
    asyncHandler(async (req, res) => {
      const family = await loadFamily(req, res);
      if (!family) return;
      const admin = isFamilyAdmin(family, req.user.id);
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(
        100,
        Math.max(1, parseInt(req.query.limit, 10) || 20)
      );
      // Members only ever see their own rows. Admins see the whole family,
      // and can narrow it to one member.
      const userId = admin
        ? req.query.memberId || undefined
        : String(req.user.id);
      const { items, total } = await expenses.list({
        familyId: String(family.id ?? family._id),
        userId,
        category: req.query.category || undefined,
        from: req.query.from || undefined,
        to: req.query.to || undefined,
        search: req.query.search || undefined,
        page,
        limit,
      });
      return res.json({
        expenses: items.map(publicExpense),
        total,
        page,
        limit,
      });
    })
  );

  // Family dashboard totals for one month. Registered before /:id so the
  // word "summary" isn't read as an expense id. A family month is small,
  // so one fetch covers the whole window and the totals come from that.
  router.get(
    "/summary",
    requireAuth,
    asyncHandler(async (req, res) => {
      const family = await loadFamily(req, res);
      if (!family) return;
      const month = req.query.month || monthKey(new Date());
      if (!/^\d{4}-\d{2}$/.test(month)) {
        return res
          .status(400)
          .json({ message: "month must look like YYYY-MM" });
      }
      const admin = isFamilyAdmin(family, req.user.id);
      const userId = admin ? undefined : String(req.user.id);
      const { from, to } = summaryWindow(month);
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
      return res.json({
        summary: summarizeExpenses(items, { month, memberNames }),
      });
    })
  );

  router.get(
    "/:id",
    requireAuth,
    asyncHandler(async (req, res) => {
      const found = await loadExpense(req, res);
      if (!found) return;
      return res.json({ expense: publicExpense(found.expense) });
    })
  );

  router.put(
    "/:id",
    requireAuth,
    asyncHandler(async (req, res) => {
      const found = await loadExpense(req, res);
      if (!found) return;
      const { errors, patch } = validateExpense(req.body, true);
      if (errors.length) return res.status(400).json({ message: errors[0] });
      if (!Object.keys(patch).length) {
        return res.status(400).json({ message: "Nothing to update" });
      }
      const updated = await expenses.update(found.expense.id ?? found.expense._id, patch);
      return res.json({ expense: publicExpense(updated) });
    })
  );

  router.delete(
    "/:id",
    requireAuth,
    asyncHandler(async (req, res) => {
      const found = await loadExpense(req, res);
      if (!found) return;
      await expenses.remove(found.expense.id ?? found.expense._id);
      return res.json({ message: "Expense deleted" });
    })
  );

  return router;
}
