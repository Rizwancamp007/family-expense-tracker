import { useState } from "react";
import { createFamily, joinFamily } from "../api.js";

export default function FamilySetup({ token, onFamilyReady }) {
  const [familyName, setFamilyName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [createdCode, setCreatedCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    setCreatedCode("");
    setBusy(true);
    try {
      const data = await createFamily(familyName.trim(), token);
      setCreatedCode(data.family.inviteCode);
      onFamilyReady(data.family);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const data = await joinFamily(inviteCode.trim(), token);
      onFamilyReady(data.family);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h2>Your family</h2>
      <p>
        Create a family to track spending together, or join one with the
        invite code someone shared with you.
      </p>
      <form onSubmit={handleCreate}>
        <div>
          <label>
            Family name{" "}
            <input
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              placeholder="e.g. Khan Family"
              required
            />
          </label>
        </div>
        <button type="submit" disabled={busy}>
          {busy ? "Please wait..." : "Create family"}
        </button>
      </form>
      {createdCode && (
        <p role="status" className="success">
          Family created. Share this invite code with your family:{" "}
          <strong>{createdCode}</strong>
        </p>
      )}
      <form onSubmit={handleJoin}>
        <div>
          <label>
            Invite code{" "}
            <input
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="e.g. A1B2C3"
              required
            />
          </label>
        </div>
        <button type="submit" disabled={busy}>
          {busy ? "Please wait..." : "Join family"}
        </button>
      </form>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </section>
  );
}
