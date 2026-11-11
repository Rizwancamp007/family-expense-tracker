import { randomUUID } from "node:crypto";

export function publicExpense(expense) {
  if (!expense) return null;
  const date = expense.date instanceof Date ? expense.date.toISOString() : expense.date;
  return {
    id: String(expense.id ?? expense._id),
    familyId: String(expense.familyId),
    userId: String(expense.userId),
    amount: expense.amount,
    category: expense.category,
    date,
    paymentMethod: expense.paymentMethod,
    note: expense.note || "",
    createdAt: expense.createdAt,
    updatedAt: expense.updatedAt,
  };
}

function matches(expense, { userId, category, from, to, search }) {
  if (userId && String(expense.userId) !== String(userId)) return false;
  if (category && expense.category !== category) return false;
  const when = new Date(expense.date).getTime();
  if (from && when < new Date(from).getTime()) return false;
  if (to && when > new Date(to).getTime()) return false;
  if (
    search &&
    !(expense.note || "").toLowerCase().includes(search.toLowerCase())
  ) {
    return false;
  }
  return true;
}

export function createMemoryExpenseStore() {
  const byId = new Map();
  return {
    async create(data) {
      const expense = {
        id: randomUUID(),
        ...data,
        date: new Date(data.date).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      byId.set(expense.id, expense);
      return expense;
    },
    async findById(id) {
      return byId.get(String(id)) || null;
    },
    async list({ familyId, page = 1, limit = 20, ...filters }) {
      const items = [...byId.values()]
        .filter((e) => String(e.familyId) === String(familyId))
        .filter((e) => matches(e, filters))
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      const total = items.length;
      const start = (page - 1) * limit;
      return {
        items: items.slice(start, start + limit),
        total,
        page,
        limit,
      };
    },
    async update(id, patch) {
      const expense = byId.get(String(id));
      if (!expense) return null;
      Object.assign(expense, patch, { updatedAt: new Date().toISOString() });
      if (patch.date) expense.date = new Date(patch.date).toISOString();
      return expense;
    },
    async remove(id) {
      return byId.delete(String(id));
    },
  };
}

export function createMongooseExpenseStore(Expense) {
  return {
    async create(data) {
      const expense = await Expense.create(data);
      return expense.toObject();
    },
    async findById(id) {
      const expense = await Expense.findById(id).lean();
      return expense || null;
    },
    async list({ familyId, userId, category, from, to, search, page = 1, limit = 20 }) {
      const query = { familyId: String(familyId) };
      if (userId) query.userId = String(userId);
      if (category) query.category = category;
      if (from || to) {
        query.date = {};
        if (from) query.date.$gte = new Date(from);
        if (to) query.date.$lte = new Date(to);
      }
      if (search) query.note = { $regex: search, $options: "i" };
      const total = await Expense.countDocuments(query);
      const items = await Expense.find(query)
        .sort({ date: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();
      return { items, total, page, limit };
    },
    async update(id, patch) {
      const expense = await Expense.findByIdAndUpdate(id, patch, {
        new: true,
      }).lean();
      return expense || null;
    },
    async remove(id) {
      const result = await Expense.deleteOne({ _id: id });
      return result.deletedCount > 0;
    },
  };
}
