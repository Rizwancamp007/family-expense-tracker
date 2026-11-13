import { useCallback, useEffect, useState } from "react";
import {
  fetchMembers,
  fetchMyFamilies,
  login,
  register,
} from "./api.js";
import Dashboard from "./components/Dashboard.jsx";
import Budgets from "./components/Budgets.jsx";
import ExpenseForm from "./components/ExpenseForm.jsx";
import ExpenseList from "./components/ExpenseList.jsx";
import FamilySetup from "./components/FamilySetup.jsx";

function storedUser() {
  try {
    return JSON.parse(localStorage.getItem("expense-user") || "null");
  } catch {
    return null;
  }
}

export default function App() {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("member");
  const [user, setUser] = useState(storedUser);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [families, setFamilies] = useState(null);
  const [family, setFamily] = useState(null);
  const [members, setMembers] = useState([]);
  const [editing, setEditing] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const token =
    typeof localStorage !== "undefined"
      ? localStorage.getItem("expense-token")
      : null;

  const handleSessionExpired = useCallback(() => {
    localStorage.removeItem("expense-token");
    localStorage.removeItem("expense-user");
    setUser(null);
    setFamilies(null);
    setFamily(null);
    setError("Your session expired — please log in again.");
  }, []);

  const loadFamilies = useCallback(
    async (selectId) => {
      try {
        const mine = await fetchMyFamilies(token);
        setFamilies(mine);
        const picked =
          mine.find((f) => f.id === selectId) || mine[0] || null;
        setFamily(picked);
        if (picked) {
          setMembers(await fetchMembers(picked.id, token));
        }
      } catch (err) {
        if (err.status === 401) handleSessionExpired();
        else setError(err.message);
      }
    },
    [token, handleSessionExpired]
  );

  useEffect(() => {
    if (user && token) loadFamilies();
  }, [user, token, loadFamilies]);

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
    setFamilies(null);
    setFamily(null);
    setMembers([]);
    setEmail("");
    setPassword("");
  }

  async function handleFamilyChange(e) {
    const picked = families.find((f) => f.id === e.target.value) || null;
    setFamily(picked);
    setEditing(null);
    if (picked) {
      try {
        setMembers(await fetchMembers(picked.id, token));
      } catch (err) {
        if (err.status === 401) handleSessionExpired();
        else setError(err.message);
      }
    }
  }

  if (user) {
    const myMembership = family?.members?.find(
      (m) => String(m.userId) === String(user.id)
    );
    const isAdmin = myMembership?.role === "admin";
    return (
      <main>
        <h1>Family Expense Tracker</h1>
        <p>
          Signed in as {user.name} ({user.role}).
        </p>
        <button type="button" onClick={handleLogout}>
          Log out
        </button>

        {families === null && <p>Loading your families...</p>}
        {families !== null && !family && (
          <FamilySetup
            token={token}
            onFamilyReady={(created) => loadFamilies(created.id)}
          />
        )}
        {family && (
          <>
            {families.length > 1 && (
              <div>
                <label>
                  Family{" "}
                  <select value={family.id} onChange={handleFamilyChange}>
                    {families.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            <p className="muted">
              {family.name} · invite code{" "}
              <strong>{family.inviteCode}</strong>
              {members.length > 0 &&
                ` · ${members.map((m) => m.name).join(", ")}`}
            </p>
            <Dashboard
              familyId={family.id}
              token={token}
              refreshKey={refreshKey}
            />
            <Budgets
              familyId={family.id}
              token={token}
              isAdmin={isAdmin}
              refreshKey={refreshKey}
            />
            <ExpenseForm
              familyId={family.id}
              token={token}
              initial={editing}
              onSaved={() => {
                setEditing(null);
                setRefreshKey((k) => k + 1);
              }}
              onCancel={() => setEditing(null)}
            />
            <ExpenseList
              familyId={family.id}
              token={token}
              members={members}
              isAdmin={isAdmin}
              userId={user.id}
              onEdit={setEditing}
              refreshKey={refreshKey}
            />
          </>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
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
