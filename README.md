# Family Expense Tracker

Track family spending together. One shared view shows where the family's money goes, and each member can also track their own spending, budget, and reports.

## Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Database: MongoDB (users, families, expenses, budgets)
- Charts: Chart.js

## Run it locally

You'll need Node 18+ and MongoDB (local or Atlas). Without a `MONGODB_URI` the server still runs, but data lives in memory and resets on restart.

Backend:

```bash
cd server
cp .env.example .env
npm install
npm run dev
```

Frontend:

```bash
cd client
npm install
npm run dev
```

The server runs on port 5000 by default, the client on 5173. Fill in the values in `server/.env` — never commit real keys.

## API so far

Auth: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` (JWT, admin/member roles).

Families: `POST /api/families` to create one (you get an invite code to share), `POST /api/families/join` to join with a code, `GET /api/families/mine` to list yours, `GET /api/families/:id/members` for the member list. Only the family admin can remove a member.

Expenses: `POST /api/expenses` and `GET /api/expenses?familyId=...` (filter by category, member, date range, or search the note), plus `GET`, `PUT`, `DELETE /api/expenses/:id`. Members can only change their own expenses; the admin can manage the whole family's. Everything is scoped to the family, so one family never sees another's.

Dashboard: `GET /api/expenses/summary?familyId=...&month=YYYY-MM` returns the month total, this week's spend, the top category, and who spent what. It defaults to the current month, and members only see their own totals.

## Using it

Register, then create a family (or join one with an invite code) — the invite code shows on the dashboard so you can share it. Add expenses from the form, then filter the list by member, category, date range, or search. The dashboard cards show the month total, this week's spend, the top category, and the per-member breakdown, with previous/next month buttons to look back. Members see their own expenses; the admin sees the whole family and can edit or delete any of them.

## Tests

Server: `cd server && npm test`. Client helpers: `cd client && npm test`.

