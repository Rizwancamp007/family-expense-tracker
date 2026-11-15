import cors from "cors";
import express from "express";
import { createAuthRouter } from "./routes/auth.js";
import { createBudgetsRouter } from "./routes/budgets.js";
import { createExpensesRouter } from "./routes/expenses.js";
import { createFamiliesRouter } from "./routes/families.js";
import { createReportsRouter } from "./routes/reports.js";
import { createMemoryDb } from "./store/db.js";
import { createMemoryStore } from "./store/users.js";

export function createApp({ store, db } = {}) {
  const data = db || {
    ...createMemoryDb(),
    users: store || createMemoryStore(),
  };
  const app = express();
  app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }));
  app.use(express.json());

  app.get("/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/", (req, res) => {
    res.json({ message: "Family Expense Tracker API" });
  });

  app.use("/api/auth", createAuthRouter(data.users));
  app.use("/api/families", createFamiliesRouter(data));
  app.use("/api/expenses", createExpensesRouter(data));
  app.use("/api/budgets", createBudgetsRouter(data));
  app.use("/api/reports", createReportsRouter(data));

  // Unknown paths still answer JSON, so the client never gets an HTML
  // error page it can't show.
  app.use((req, res) => {
    res.status(404).json({ message: "Not found" });
  });

  app.use((err, req, res, next) => {
    // A body that isn't valid JSON comes from express.json() as a
    // SyntaxError — that's a bad request, not a server crash, so say so.
    if (err.type === "entity.parse.failed") {
      return res.status(400).json({
        message: "That request wasn't valid — please try again",
      });
    }
    if (err.type === "entity.too.large") {
      return res.status(413).json({ message: "That request was too large" });
    }
    console.error(err);
    res.status(500).json({ message: "Something went wrong — please try again" });
  });

  return app;
}
