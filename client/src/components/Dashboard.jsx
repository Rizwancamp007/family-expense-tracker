import { useEffect, useState } from "react";
import { fetchSummary } from "../api.js";
import { formatMoney, monthParam, shiftMonth } from "../utils/expenseFilters.js";

function monthLabel(month) {
  const [year, mon] = month.split("-").map(Number);
  return new Date(year, mon - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export default function Dashboard({ familyId, token, refreshKey }) {
  const [month, setMonth] = useState(monthParam(new Date()));
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchSummary(familyId, month, token)
      .then((s) => {
        if (!cancelled) setSummary(s);
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

  return (
    <section>
      <div className="month-nav">
        <h2>{monthLabel(month)}</h2>
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

      {loading && <p>Loading the dashboard...</p>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {!loading && !error && summary && (
        <>
          <div className="cards">
            <div className="card">
              <div className="muted">Spent this month</div>
              <strong>{formatMoney(summary.monthTotal)}</strong>
              <div className="muted">
                {summary.expenseCount} expense{summary.expenseCount === 1 ? "" : "s"}
              </div>
            </div>
            <div className="card">
              <div className="muted">Spent this week</div>
              <strong>{formatMoney(summary.weekTotal)}</strong>
              <div className="muted">Last 7 days</div>
            </div>
            <div className="card">
              <div className="muted">Top category</div>
              <strong>
                {summary.topCategory
                  ? summary.topCategory.category
                  : "Nothing yet"}
              </strong>
              <div className="muted">
                {summary.topCategory
                  ? formatMoney(summary.topCategory.total)
                  : "Add an expense to see it here"}
              </div>
            </div>
          </div>

          <h3>Who spent what</h3>
          {summary.perMember.length === 0 ? (
            <p className="muted">No spending this month yet.</p>
          ) : (
            <ul className="member-breakdown">
              {summary.perMember.map((m) => (
                <li key={m.userId}>
                  <span>{m.name}</span>
                  <strong>{formatMoney(m.total)}</strong>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
