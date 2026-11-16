# Family Expense Tracker

Track family spending together. One shared view shows where the family's money goes, and each member can also track their own spending, budget, and reports.

## What it does

- Register and log in, as a family admin or a member. Admins manage the family and budgets; members track their own spending.
- Create a family and share its invite code, or join one with a code.
- Add expenses — amount, category, date, payment method, note — and edit or delete them. Members can only change their own; the admin can manage the whole family's.
- See the month at a glance: family total, this week's spend, top category, and who spent what.
- Set a monthly budget per category, or one overall budget for the family. Progress bars show what's left and flag it when a category goes over.
- Monthly reports with charts — spending through the month, category breakdown, per-member comparison, budget vs actual — and download the month as a CSV file.

## Stack

- Frontend: React + Vite, charts with Chart.js
- Backend: Node.js + Express
- Database: MongoDB (users, families, expenses, budgets)
- Auth: JWT, admin/member roles checked on the server

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

The server runs on port 5000 by default, the client on 5173. If the API lives somewhere else, point the client at it with `VITE_API_URL` (see below).

## Env vars

Server — set these in `server/.env`, never committed:

| Var | What it does |
| --- | --- |
| `PORT` | Server port, defaults to 5000 |
| `MONGODB_URI` | MongoDB connection string. Without it, data is kept in memory and resets on restart |
| `JWT_SECRET` | Secret used to sign login tokens — set a long random value |
| `JWT_EXPIRES_IN` | How long a login lasts, e.g. `7d` |
| `CLIENT_URL` | Where the frontend runs, e.g. `http://localhost:5173` — the API only accepts requests from here |
| `DEMO_ADMIN_EMAIL` / `DEMO_ADMIN_PASSWORD` | Login for the demo admin account created by `npm run seed` |
| `DEMO_MEMBER_EMAIL` / `DEMO_MEMBER_PASSWORD` | Login for the demo member account created by `npm run seed` |

Client — set in `client/.env`, never committed:

| Var | What it does |
| --- | --- |
| `VITE_API_URL` | Where the API lives, defaults to `http://localhost:5000` |

## Demo accounts

To try it with sample logins, set the four `DEMO_*` vars in `server/.env` — pick any email and a password of 8+ characters — then:

```bash
cd server
npm run seed
```

That creates a demo admin and a demo member. Nothing is hard-coded: the seed reads the logins from your own env vars, and it skips any account that already exists. Seeding needs a `MONGODB_URI` set, since it writes to the database.

## Demo script

Good for showing it to a family for the first time:

1. Log in as the demo admin and create a family — the invite code shows on the dashboard.
2. Log in as the demo member in another browser (or an incognito window) and join with that code.
3. Add what you spent today — groceries, fuel, school fees — from each account.
4. The dashboard shows the whole family's month in one place, and each member's own spending separately.
5. Set a budget for groceries and watch it show what's left before the month ends. Go over it and the warning appears.
6. Open Reports: the charts show where the money went, who spent what, and budget vs actual — then download the month as a CSV.

## Using it

Register, then create a family (or join one with an invite code) — the invite code shows on the dashboard so you can share it. Add expenses from the form, then filter the list by member, category, date range, or search. The dashboard cards show the month total, this week's spend, the top category, and the per-member breakdown, with previous/next month buttons to look back. Members see their own expenses; the admin sees the whole family and can edit or delete any of them. The admin can set a monthly budget per category, or one overall budget for the family — each one shows a progress bar, what's left, and a warning when it's over budget. Members see their own spending against those same budgets. The Reports section shows the month as charts — spending through the month, where the money went, who spent what, and budget vs actual — with the top categories and spenders and a button to download the month as a CSV file.

## API

Auth: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` (JWT, admin/member roles).

Families: `POST /api/families` to create one (you get an invite code to share), `POST /api/families/join` to join with a code, `GET /api/families/mine` to list yours, `GET /api/families/:id/members` for the member list. Only the family admin can remove a member.

Expenses: `POST /api/expenses` and `GET /api/expenses?familyId=...` (filter by category, member, date range, or search the note), plus `GET`, `PUT`, `DELETE /api/expenses/:id`. Members can only change their own expenses; the admin can manage the whole family's. Everything is scoped to the family, so one family never sees another's.

Dashboard: `GET /api/expenses/summary?familyId=...&month=YYYY-MM` returns the month total, this week's spend, the top category, and who spent what. It defaults to the current month, and members only see their own totals.

Budgets: `PUT /api/budgets` sets a monthly budget for one category — or `Overall` for the whole family's month — and `GET /api/budgets/status?familyId=...&month=YYYY-MM` shows what was spent against each one, what's left, and whether it's over budget. Only the family admin can set or remove a budget (`DELETE /api/budgets?familyId=...&month=...&category=...`); members see their own spending against the same limits.

Reports: `GET /api/reports/monthly?familyId=...&month=YYYY-MM` returns the month's totals, a day-by-day spending trend, the category breakdown, per-member totals, top categories and spenders, and how the month did against the budgets. `GET /api/reports/export?familyId=...&month=YYYY-MM` downloads the same month as a CSV file. Both follow the same rule as budgets — the admin sees the whole family, a member sees only their own spending.

## Deploy

Frontend on Vercel (root `client`), backend on Render or Railway (root `server`), database on MongoDB Atlas. Set the server env vars in the hosting dashboard — `MONGODB_URI`, `JWT_SECRET`, `CLIENT_URL` — and `VITE_API_URL` on the frontend so it can reach the API. `GET /health` on the API answers `{ "status": "ok" }` if the server is up.

## Tests

Server: `cd server && npm test` (58 tests — auth, families, expenses, budgets, reports, error handling). Client helpers: `cd client && npm test` (25 tests — filters, budget math, report charts, session expiry).
