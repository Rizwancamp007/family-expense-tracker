import { randomUUID } from "node:crypto";

export function publicBudget(budget) {
  if (!budget) return null;
  return {
    id: String(budget.id ?? budget._id),
    familyId: String(budget.familyId),
    month: budget.month,
    category: budget.category,
    amount: budget.amount,
    createdAt: budget.createdAt,
    updatedAt: budget.updatedAt,
  };
}

function key(familyId, month, category) {
  return `${familyId}|${month}|${category}`;
}

export function createMemoryBudgetStore() {
  const byKey = new Map();
  return {
    async upsert({ familyId, month, category, amount }) {
      const k = key(familyId, month, category);
      const existing = byKey.get(k);
      if (existing) {
        existing.amount = amount;
        existing.updatedAt = new Date().toISOString();
        return existing;
      }
      const budget = {
        id: randomUUID(),
        familyId: String(familyId),
        month,
        category,
        amount,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      byKey.set(k, budget);
      return budget;
    },
    async list({ familyId, month }) {
      return [...byKey.values()]
        .filter(
          (b) =>
            String(b.familyId) === String(familyId) &&
            (!month || b.month === month)
        )
        .sort((a, b) => a.category.localeCompare(b.category));
    },
    async remove({ familyId, month, category }) {
      return byKey.delete(key(familyId, month, category));
    },
  };
}

export function createMongooseBudgetStore(Budget) {
  return {
    async upsert({ familyId, month, category, amount }) {
      const budget = await Budget.findOneAndUpdate(
        { familyId: String(familyId), month, category },
        { $set: { amount } },
        { new: true, upsert: true }
      ).lean();
      return budget;
    },
    async list({ familyId, month }) {
      const query = { familyId: String(familyId) };
      if (month) query.month = month;
      return Budget.find(query).sort({ category: 1 }).lean();
    },
    async remove({ familyId, month, category }) {
      const result = await Budget.deleteOne({
        familyId: String(familyId),
        month,
        category,
      });
      return result.deletedCount > 0;
    },
  };
}
