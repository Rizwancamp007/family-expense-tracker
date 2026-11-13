import cors from "cors";
import express from "express";
import { createAuthRouter } from "./routes/auth.js";
import { createBudgetsRouter } from "./routes/budgets.js";
import { createExpensesRouter } from "./routes/expenses.js";
import { createFamiliesRouter } from "./routes/families.js";
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

  // Unknown paths still answer JSON, so the client never gets an HTML
  // error page it can't show.
  app.use((req, res) => {
    res.status(404).json({ message: "Not found" });
  });

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ message: "Something went wrong — please try again" });
  });

  return app;
}
