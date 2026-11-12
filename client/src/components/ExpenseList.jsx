import { useCallback, useEffect, useState } from "react";
import { deleteExpense, listExpenses } from "../api.js";
import { CATEGORIES } from "../constants.js";
import { dateInputValue, formatMoney } from "../utils/expenseFilters.js";

const PAGE_SIZE = 20;

export default function ExpenseList({
  familyId,
  token,
  members,
  isAdmin,
  userId,
  onEdit,
  refreshKey,
}) {
  const [filters, setFilters] = useState({
    memberId: "",
    category: "",
    from: "",
    to: "",
    search: "",
  });
  const [page, setPage] = useState(1);
  const [expenses, setExpenses] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listExpenses(
        familyId,
        { ...filters, page, limit: PAGE_SIZE },
        token
      );
      setExpenses(data.expenses);
      setTotal(data.total);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [familyId, token, filters, page]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  function updateFilter(key, value) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }

  function clearFilters() {
    setFilters({ memberId: "", category: "", from: "", to: "", search: "" });
    setPage(1);
  }

  async function handleDelete(expense) {
    if (!window.confirm(`Delete this ${formatMoney(expense.amount)} ${expense.category} expense?`)) {
      return;
    }
    try {
      await deleteExpense(expense.id, token);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  const memberName = (id) =>
    members.find((m) => String(m.userId) === String(id))?.name || "Unknown";
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtersActive = Object.values(filters).some((v) => v !== "");

  return (
    <section>
      <h2>Expenses</h2>
      <div className="filters">
        {isAdmin && (
          <label>
            Member{" "}
            <select
              value={filters.memberId}
              onChange={(e) => updateFilter("memberId", e.target.value)}
            >
              <option value="">Everyone</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Category{" "}
          <select
            value={filters.category}
            onChange={(e) => updateFilter("category", e.target.value)}
          >
            <option value="">All</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          From{" "}
          <input
            type="date"
            value={filters.from}
            onChange={(e) => updateFilter("from", e.target.value)}
          />
        </label>
        <label>
          To{" "}
          <input
            type="date"
            value={filters.to}
            onChange={(e) => updateFilter("to", e.target.value)}
          />
        </label>
        <label>
          Search{" "}
          <input
            type="search"
            value={filters.search}
            onChange={(e) => updateFilter("search", e.target.value)}
            placeholder="Search notes"
          />
        </label>
        {filtersActive && (
          <button type="button" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>

      {loading && <p>Loading expenses...</p>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {!loading && !error && expenses.length === 0 && (
        <p className="muted">
          No expenses match — add one above, or clear the filters.
        </p>
      )}
      {!loading && expenses.length > 0 && (
        <ul className="expense-list">
          {expenses.map((expense) => (
            <li key={expense.id} className="expense-row">
              <div>
                <strong>{formatMoney(expense.amount)}</strong> · {expense.category}
                <div className="muted">
                  {dateInputValue(expense.date)} · {expense.paymentMethod}
                  {isAdmin && ` · ${memberName(expense.userId)}`}
                </div>
                {expense.note && <div>{expense.note}</div>}
              </div>
              {(isAdmin || String(expense.userId) === String(userId)) && (
                <div className="row-actions">
                  <button type="button" onClick={() => onEdit(expense)}>
                    Edit
                  </button>{" "}
                  <button type="button" onClick={() => handleDelete(expense)}>
                    Delete
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {totalPages > 1 && (
        <div>
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            Previous
          </button>{" "}
          <span>
            Page {page} of {totalPages} ({total} expenses)
          </span>{" "}
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}
