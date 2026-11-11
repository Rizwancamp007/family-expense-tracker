import mongoose from "mongoose";

export const CATEGORIES = [
  "Groceries",
  "Rent",
  "Utilities",
  "Transport",
  "Education",
  "Health",
  "Entertainment",
  "Other",
];

export const PAYMENT_METHODS = ["Cash", "Card", "Bank Transfer", "Mobile Wallet", "Other"];

const expenseSchema = new mongoose.Schema(
  {
    familyId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    amount: { type: Number, required: true, min: 0.01 },
    category: { type: String, enum: CATEGORIES, required: true },
    date: { type: Date, required: true },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: "Cash" },
    note: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

export const Expense = mongoose.model("Expense", expenseSchema);
