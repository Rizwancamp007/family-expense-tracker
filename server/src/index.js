import dotenv from "dotenv";
import mongoose from "mongoose";
import { createApp } from "./app.js";
import { Budget } from "./models/Budget.js";
import { Expense } from "./models/Expense.js";
import { Family } from "./models/Family.js";
import { User } from "./models/User.js";
import { createMemoryDb, createMongooseDb } from "./store/db.js";

dotenv.config();

const PORT = process.env.PORT || 5000;

async function main() {
  let db = createMemoryDb();
  if (process.env.MONGODB_URI) {
    await mongoose.connect(process.env.MONGODB_URI);
    db = createMongooseDb({ User, Family, Expense, Budget });
    console.log("Connected to MongoDB");
  } else {
    console.log("No MONGODB_URI set, using in-memory data (resets on restart)");
  }
  const app = createApp({ db });
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
