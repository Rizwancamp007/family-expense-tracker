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
