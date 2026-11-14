// Turn a monthly report into the data objects Chart.js needs. Pure
// functions, no React, so they run under plain node --test as well.

const PALETTE = [
  "#2563eb",
  "#16a34a",
  "#dc2626",
  "#d97706",
  "#7c3aed",
  "#0891b2",
  "#db2777",
  "#65a30d",
];

// Daily spending for the month, one point per day.
export function trendChartData(trend) {
  return {
    labels: (trend || []).map((day) => day.date.slice(5)),
    datasets: [
      {
        label: "Spent (Rs)",
        data: (trend || []).map((day) => day.total),
        borderColor: "#2563eb",
        backgroundColor: "rgba(37, 99, 235, 0.15)",
        fill: true,
        tension: 0.2,
      },
    ],
  };
}

// Share of the month's spending per category.
export function categoryChartData(categories) {
  return {
    labels: (categories || []).map((row) => row.category),
    datasets: [
      {
        data: (categories || []).map((row) => row.total),
        backgroundColor: PALETTE,
      },
    ],
  };
}

// Who spent what, biggest first.
export function memberChartData(perMember) {
  return {
    labels: (perMember || []).map((row) => row.name),
    datasets: [
      {
        label: "Spent (Rs)",
        data: (perMember || []).map((row) => row.total),
        backgroundColor: "#16a34a",
      },
    ],
  };
}

// What was spent against each budget, side by side.
export function budgetChartData(budget) {
  const rows = budget?.categories || [];
  return {
    labels: rows.map((row) => row.category),
    datasets: [
      {
        label: "Spent (Rs)",
        data: rows.map((row) => row.spent),
        backgroundColor: "#dc2626",
      },
      {
        label: "Budget (Rs)",
        data: rows.map((row) => row.limit),
        backgroundColor: "#2563eb",
      },
    ],
  };
}
