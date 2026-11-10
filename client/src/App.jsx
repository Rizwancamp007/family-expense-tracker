import { useState } from "react";
import { login, register } from "./api.js";

export default function App() {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("member");
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("expense-user") || "null");
    } catch {
      return null;
    }
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data =
        mode === "login"
          ? await login(email, password)
          : await register(name, email, password, role);
      localStorage.setItem("expense-token", data.token);
      localStorage.setItem("expense-user", JSON.stringify(data.user));
      setUser(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("expense-token");
    localStorage.removeItem("expense-user");
    setUser(null);
    setEmail("");
    setPassword("");
  }

  if (user) {
    return (
      <main>
        <h1>Family Expense Tracker</h1>
        <p>
          Signed in as {user.name} ({user.role}).
        </p>
        <button type="button" onClick={handleLogout}>
          Log out
        </button>
        <p>
          Your family dashboard lives here — shared totals, your own spending,
          budgets, and reports.
        </p>
      </main>
    );
  }

  return (
    <main>
      <h1>Family Expense Tracker</h1>
      <p>
        See where the whole family&apos;s money goes — and track your own
        spending, budget, and reports alongside it.
      </p>
      <div>
        <button type="button" onClick={() => setMode("login")}>
          Log in
        </button>{" "}
        <button type="button" onClick={() => setMode("register")}>
          Register
        </button>
      </div>
      <form onSubmit={handleSubmit}>
        {mode === "register" && (
          <div>
            <label>
              Name{" "}
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
          </div>
        )}
        <div>
          <label>
            Email{" "}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
        </div>
        <div>
          <label>
            Password{" "}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
        </div>
        {mode === "register" && (
          <div>
            <label>
              Role{" "}
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </label>
          </div>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button type="submit" disabled={loading}>
          {loading ? "Please wait..." : mode === "login" ? "Log in" : "Register"}
        </button>
      </form>
    </main>
  );
}
