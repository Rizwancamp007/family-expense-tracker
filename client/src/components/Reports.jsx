import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
} from "chart.js";
import { useEffect, useState } from "react";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import { downloadMonthlyCsv, fetchMonthlyReport } from "../api.js";
import { formatMoney, monthParam, shiftMonth } from "../utils/expenseFilters.js";
import {
  budgetChartData,
  categoryChartData,
  memberChartData,
  trendChartData,
} from "../utils/reportCharts.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

function monthLabel(month) {
  const [year, mon] = month.split("-").map(Number);
  return new Date(year, mon - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: "bottom" } },
};

export default function Reports({ familyId, token, refreshKey }) {
  const [month, setMonth] = useState(monthParam(new Date()));
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchMonthlyReport(familyId, month, token)
      .then((r) => {
        if (!cancelled) setReport(r);
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

  async function handleDownload() {
    setDownloadError("");
    setDownloading(true);
    try {
      await downloadMonthlyCsv(familyId, month, token);
    } catch (err) {
      setDownloadError(err.message);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <section>
      <div className="month-nav">
        <h2>Reports — {monthLabel(month)}</h2>
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

      {loading && <p>Loading the report...</p>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {!loading && !error && report && (
        <>
          <div className="cards">
            <div className="card">
              <div className="muted">Spent this month</div>
              <strong>{formatMoney(report.totalSpent)}</strong>
              <div className="muted">
                {report.expenseCount} expense{report.expenseCount === 1 ? "" : "s"}
              </div>
            </div>
            <div className="card">
              <div className="muted">Average per day</div>
              <strong>{formatMoney(report.dailyAverage)}</strong>
              <div className="muted">Across the whole month</div>
            </div>
            <div className="card">
              <div className="muted">Top category</div>
              <strong>
                {report.topCategories[0]
                  ? report.topCategories[0].category
                  : "Nothing yet"}
              </strong>
              <div className="muted">
                {report.topCategories[0]
                  ? formatMoney(report.topCategories[0].total)
                  : "Add an expense to see it here"}
              </div>
            </div>
          </div>

          {report.expenseCount === 0 ? (
            <p className="muted">No spending this month yet — add an expense and the charts will fill in.</p>
          ) : (
            <div className="charts">
              <div className="chart-card">
                <h3>Spending through the month</h3>
                <div className="chart">
                  <Line data={trendChartData(report.trend)} options={chartOptions} />
                </div>
              </div>
              <div className="chart-card">
                <h3>Where the money went</h3>
                <div className="chart">
                  <Doughnut
                    data={categoryChartData(report.categories)}
                    options={chartOptions}
                  />
                </div>
              </div>
              <div className="chart-card">
                <h3>Who spent what</h3>
                <div className="chart">
                  <Bar data={memberChartData(report.perMember)} options={chartOptions} />
                </div>
              </div>
              {report.budget.categories.length > 0 && (
                <div className="chart-card">
                  <h3>Budget vs actual</h3>
                  <div className="chart">
                    <Bar
                      data={budgetChartData(report.budget)}
                      options={chartOptions}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {report.topSpenders.length > 0 && (
            <>
              <h3>Top spenders</h3>
              <ul className="member-breakdown">
                {report.topSpenders.map((m) => (
                  <li key={m.userId}>
                    <span>{m.name}</span>
                    <strong>{formatMoney(m.total)}</strong>
                  </li>
                ))}
              </ul>
            </>
          )}

          <div>
            <button type="button" onClick={handleDownload} disabled={downloading}>
              {downloading ? "Preparing..." : "Download this month as CSV"}
            </button>
            {downloadError && (
              <p role="alert" className="error">
                {downloadError}
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
