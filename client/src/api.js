import { buildExpenseQuery } from "./utils/expenseFilters.js";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// A dropped connection or a server that isn't running shows up as a bare
// fetch failure — turn it into something a user can act on.
function friendlyError(err) {
  if (err instanceof TypeError) {
    return new Error("Could not reach the server — check your connection and try again");
  }
  return err;
}

async function request(method, path, body, token) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (err) {
    throw friendlyError(err);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.message || "Request failed");
    error.status = res.status;
    throw error;
  }
  return data;
}

export function login(email, password) {
  return request("POST", "/api/auth/login", { email, password });
}

export function register(name, email, password, role) {
  return request("POST", "/api/auth/register", { name, email, password, role });
}

export function fetchMe(token) {
  return request("GET", "/api/auth/me", undefined, token).then((d) => d.user);
}

export function createFamily(name, token) {
  return request("POST", "/api/families", { name }, token);
}

export function joinFamily(inviteCode, token) {
  return request("POST", "/api/families/join", { inviteCode }, token);
}

export function fetchMyFamilies(token) {
  return request("GET", "/api/families/mine", undefined, token).then(
    (d) => d.families
  );
}

export function fetchMembers(familyId, token) {
  return request(
    "GET",
    `/api/families/${familyId}/members`,
    undefined,
    token
  ).then((d) => d.members);
}

export function listExpenses(familyId, filters, token) {
  const query = buildExpenseQuery({ ...filters });
  const qs = query ? `?familyId=${familyId}&${query}` : `?familyId=${familyId}`;
  return request("GET", `/api/expenses${qs}`, undefined, token);
}

export function createExpense(familyId, expense, token) {
  return request("POST", "/api/expenses", { familyId, ...expense }, token);
}

export function updateExpense(id, expense, token) {
  return request("PUT", `/api/expenses/${id}`, expense, token);
}

export function deleteExpense(id, token) {
  return request("DELETE", `/api/expenses/${id}`, undefined, token);
}

export function fetchSummary(familyId, month, token) {
  return request(
    "GET",
    `/api/expenses/summary?familyId=${familyId}&month=${month}`,
    undefined,
    token
  ).then((d) => d.summary);
}
