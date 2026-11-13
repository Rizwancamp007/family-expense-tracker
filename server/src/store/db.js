import {
  createMemoryBudgetStore,
  createMongooseBudgetStore,
} from "./budgets.js";
import {
  createMemoryExpenseStore,
  createMongooseExpenseStore,
} from "./expenses.js";
import {
  createMemoryFamilyStore,
  createMongooseFamilyStore,
} from "./families.js";
import {
  createMemoryStore as createMemoryUserStore,
  createMongooseStore as createMongooseUserStore,
} from "./users.js";

// One object holding every store, so routes only ever take `db` and the
// app can swap the whole thing between memory (tests, local runs without
// a database) and MongoDB.
export function createMemoryDb() {
  return {
    users: createMemoryUserStore(),
    families: createMemoryFamilyStore(),
    expenses: createMemoryExpenseStore(),
    budgets: createMemoryBudgetStore(),
  };
}

export function createMongooseDb({ User, Family, Expense, Budget }) {
  return {
    users: createMongooseUserStore(User),
    families: createMongooseFamilyStore(Family),
    expenses: createMongooseExpenseStore(Expense),
    budgets: createMongooseBudgetStore(Budget),
  };
}
