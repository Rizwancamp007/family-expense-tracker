// Small pure helpers for the expense UI. No React here, so these run under
// plain node --test as well as in the browser.

// Turn the filter form state into the query string for GET /api/expenses.
// Empty filters are left out so the server sees only what was picked.
export function buildExpenseQuery(filters) {
  const params = new URLSearchParams();
  for (const key of ["memberId", "category", "from", "to", "search", "page", "limit"]) {
    const value = filters[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      params.set(key, String(value).trim());
    }
  }
  return params.toString();
}

// "2026-11" for a Date, used for the monthly summary.
export function monthParam(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Step a "YYYY-MM" month forward or back one month.
export function shiftMonth(month, delta) {
  const [year, mon] = month.split("-").map(Number);
  const d = new Date(year, mon - 1 + delta, 1);
  return monthParam(d);
}

// "2026-11-12" for a Date, for <input type="date"> values.
export function dateInputValue(date) {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayInputValue() {
  return dateInputValue(new Date());
}

// "Rs 1,250" — amounts are shown in rupees, no decimals for whole numbers.
export function formatMoney(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "Rs 0";
  return `Rs ${n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

// Check an expense form before it goes to the server. Returns a map of
// field name -> message, empty when the form is fine.
export function validateExpenseForm({ amount, category, date }) {
  const errors = {};
  const value = Number(amount);
  if (amount === "" || amount === undefined || !Number.isFinite(value) || value <= 0) {
    errors.amount = "Amount must be more than 0";
  }
  if (!category) {
    errors.category = "Pick a category";
  }
  if (!date || Number.isNaN(new Date(date).getTime())) {
    errors.date = "Pick a date";
  }
  return errors;
}
