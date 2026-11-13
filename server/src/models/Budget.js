import mongoose from "mongoose";
import { CATEGORIES } from "./Expense.js";

// One budget per family, month and category. Category "Overall" is the
// cap for the whole family's month; the rest are per-category limits.
export const BUDGET_CATEGORIES = [...CATEGORIES, "Overall"];

const budgetSchema = new mongoose.Schema(
  {
    familyId: { type: String, required: true, index: true },
    month: { type: String, required: true, match: /^\d{4}-\d{2}$/ },
    category: { type: String, enum: BUDGET_CATEGORIES, required: true },
    amount: { type: Number, required: true, min: 0.01 },
  },
  { timestamps: true }
);

budgetSchema.index({ familyId: 1, month: 1, category: 1 }, { unique: true });

export const Budget = mongoose.model("Budget", budgetSchema);
