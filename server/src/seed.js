import dotenv from "dotenv";
import mongoose from "mongoose";
import { User } from "./models/User.js";
import { hashPassword } from "./services/auth.js";
import { createMongooseStore } from "./store/users.js";

dotenv.config();

// Demo accounts are created from environment variables only. Set them in
// your local .env or in deployment config before running this script, for
// example: npm run seed. No demo credentials live in this file.
const DEMO_ACCOUNTS = [
  {
    role: "admin",
    email: process.env.DEMO_ADMIN_EMAIL,
    password: process.env.DEMO_ADMIN_PASSWORD,
  },
  {
    role: "member",
    email: process.env.DEMO_MEMBER_EMAIL,
    password: process.env.DEMO_MEMBER_PASSWORD,
  },
];

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is not set, cannot seed.");
    process.exit(1);
  }
  const ready = DEMO_ACCOUNTS.filter((a) => a.email && a.password);
  const missing = DEMO_ACCOUNTS.filter((a) => !a.email || !a.password).map((a) => a.role);
  if (missing.length) {
    console.log(`Skipping ${missing.join(", ")} demo account(s): set the DEMO_* env vars first.`);
  }
  if (!ready.length) {
    console.error("No complete demo accounts found in env vars, nothing seeded.");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  const store = createMongooseStore(User);
  for (const account of ready) {
    const existing = await store.findByEmail(account.email);
    if (existing) {
      console.log(`Demo ${account.role} already exists, skipped: ${account.email}`);
      continue;
    }
    await store.create({
      name: `Demo ${account.role}`,
      email: account.email,
      passwordHash: await hashPassword(account.password),
      role: account.role,
    });
    console.log(`Demo ${account.role} created: ${account.email}`);
  }
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {
    // Already down.
  }
  process.exit(1);
});
