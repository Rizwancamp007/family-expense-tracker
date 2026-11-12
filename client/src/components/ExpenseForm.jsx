import { useEffect, useState } from "react";
import { createExpense, updateExpense } from "../api.js";
import { CATEGORIES, PAYMENT_METHODS } from "../constants.js";
import {
  dateInputValue,
  todayInputValue,
  validateExpenseForm,
} from "../utils/expenseFilters.js";

export default function ExpenseForm({ familyId, token, initial, onSaved, onCancel }) {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [date, setDate] = useState(todayInputValue());
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0]);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initial) {
      setAmount(String(initial.amount));
      setCategory(initial.category);
      setDate(dateInputValue(initial.date));
      setPaymentMethod(initial.paymentMethod || PAYMENT_METHODS[0]);
      setNote(initial.note || "");
    } else {
      setAmount("");
      setCategory(CATEGORIES[0]);
      setDate(todayInputValue());
      setPaymentMethod(PAYMENT_METHODS[0]);
      setNote("");
    }
    setErrors({});
    setServerError("");
  }, [initial]);

  async function handleSubmit(e) {
    e.preventDefault();
    const problems = validateExpenseForm({ amount, category, date });
    setErrors(problems);
    if (Object.keys(problems).length) return;
    setServerError("");
    setSaving(true);
    try {
      const data = {
        amount: Number(amount),
        category,
        date,
        paymentMethod,
        note: note.trim(),
      };
      if (initial) {
        await updateExpense(initial.id, data, token);
      } else {
        await createExpense(familyId, data, token);
      }
      onSaved();
    } catch (err) {
      setServerError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <h2>{initial ? "Edit expense" : "Add an expense"}</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>
            Amount (Rs){" "}
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 1200"
            />
          </label>
          {errors.amount && (
            <p role="alert" className="error">
              {errors.amount}
            </p>
          )}
        </div>
        <div>
          <label>
            Category{" "}
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          {errors.category && (
            <p role="alert" className="error">
              {errors.category}
            </p>
          )}
        </div>
        <div>
          <label>
            Date{" "}
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          {errors.date && (
            <p role="alert" className="error">
              {errors.date}
            </p>
          )}
        </div>
        <div>
          <label>
            Paid with{" "}
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div>
          <label>
            Note{" "}
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What was this for?"
              maxLength={200}
            />
          </label>
        </div>
        {serverError && (
          <p role="alert" className="error">
            {serverError}
          </p>
        )}
        <button type="submit" disabled={saving}>
          {saving ? "Saving..." : initial ? "Save changes" : "Add expense"}
        </button>{" "}
        {initial && (
          <button type="button" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
        )}
      </form>
    </section>
  );
}
