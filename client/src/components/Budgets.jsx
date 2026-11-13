import { useEffect, useState } from "react";
import { deleteBudget, fetchBudgetStatus, setBudget } from "../api.js";
import { CATEGORIES } from "../constants.js";
import { budgetBarWidth, isOverBudget } from "../utils/budgetMath.js";
import { formatMoney, monthParam, shiftMonth } from "../utils/expenseFilters.js";

function monthLabel(month) {
  const [year, mon] = month.split("-").map(Number);
  return new Date(year, mon - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function BudgetRow({ entry, spentLabel, isAdmin, onRemove }) {
  const over = isOverBudget(entry.spent, entry.limit);
  return (
    <li className={over ? "budget-row over" : "budget-row"}>
      <div className="budget-head">
        <span>
          <strong>{entry.category === "Overall" ? "Whole family" : entry.category}</strong>
          {over && <span className="over-warning"> · Over budget</span>}
        </span>
        <strong>
          {formatMoney(entry.spent)} of {formatMoney(entry.limit)}
        </strong>
      </div>
      <div
        className="budget-bar"
        role="progressbar"
        aria-valuenow={Math.round(entry.percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${entry.category} budget used`}
      >
        <div
          className={over ? "budget-fill over" : "budget-fill"}
          style={{ width: `${budgetBarWidth(entry.spent, entry.limit)}%` }}
        />
      </div>
      <div className="muted">
        {entry.percent}% used ·{" "}
        {entry.remaining >= 0
          ? `${formatMoney(entry.remaining)} left`
          : `${formatMoney(-entry.remaining)} over`}
        {spentLabel ? ` · ${spentLabel}` : ""}
      </div>
      {isAdmin && (
        <button type="button" onClick={() => onRemove(entry.category)}>
          Remove budget
        </button>
      )}
    </li>
  );
}

export default function Budgets({ familyId, token, isAdmin, refreshKey }) {
  const [month, setMonth] = useState(monthParam(new Date()));
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("Groceries");
  const [amount, setAmount] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchBudgetStatus(familyId, month, token)
      .then((s) => {
        if (!cancelled) setStatus(s);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [familyId, month, token, refreshKey]);

  async function handleSetBudget(e) {
    e.preventDefault();
    const value = Number(amount);
    if (!amount || !Number.isFinite(value) || value <= 0) {
      setFormError("Amount must be more than 0");
      return;
    }
    setFormError("");
    setSaving(true);
    try {
      await setBudget(familyId, month, category, value, token);
      setAmount("");
      setStatus(await fetchBudgetStatus(familyId, month, token));
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveBudget(budgetCategory) {
    setError("");
    try {
      await deleteBudget(familyId, month, budgetCategory, token);
      setStatus(await fetchBudgetStatus(familyId, month, token));
    } catch (err) {
      setError(err.message);
    }
  }

  const spentLabel = isAdmin ? "family spending" : "your spending";

  return (
    <section>
      <div className="month-nav">
        <h2>Budgets — {monthLabel(month)}</h2>
        <div>
          <button type="button" onClick={() => setMonth((m) => shiftMonth(m, -1))}>
            ← Previous
          </button>{" "}
          <button
            type="button"
            onClick={() => setMonth(monthParam(new Date()))}
            disabled={month === monthParam(new Date())}
          >
            This month
          </button>{" "}
          <button
            type="button"
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            disabled={month >= monthParam(new Date())}
          >
            Next →
          </button>
        </div>
      </div>

      {loading && <p>Loading budgets...</p>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {!loading && !error && status && (
        <>
          {status.overall || status.categories.length > 0 ? (
            <ul className="budget-list">
              {status.overall && (
                <BudgetRow
                  entry={status.overall}
                  spentLabel={spentLabel}
                  isAdmin={isAdmin}
                  onRemove={handleRemoveBudget}
                />
              )}
              {status.categories.map((entry) => (
                <BudgetRow
                  key={entry.category}
                  entry={entry}
                  spentLabel={spentLabel}
                  isAdmin={isAdmin}
                  onRemove={handleRemoveBudget}
                />
              ))}
            </ul>
          ) : (
            <p className="muted">
              No budgets set for this month yet
              {isAdmin ? " — set one below." : "."}
            </p>
          )}
          <p className="muted">
            Spent this month: {formatMoney(status.totalSpent)} ({spentLabel})
          </p>
        </>
      )}

      {isAdmin && (
        <form onSubmit={handleSetBudget}>
          <h3>Set a budget</h3>
          <div>
            <label>
              Category{" "}
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="Overall">Overall — whole family</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div>
            <label>
              Monthly amount (Rs){" "}
              <input
                type="number"
                min="1"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="10000"
              />
            </label>
          </div>
          {formError && (
            <p role="alert" className="error">
              {formError}
            </p>
          )}
          <button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Set budget"}
          </button>
        </form>
      )}
    </section>
  );
}
