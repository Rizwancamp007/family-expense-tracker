import { randomUUID } from "node:crypto";

// Never send the password hash to the client.
export function publicUser(user) {
  if (!user) return null;
  return {
    id: String(user.id ?? user._id),
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

// Local runs without a database keep users in memory (resets on restart).
export function createMemoryStore() {
  const byId = new Map();
  const byEmail = new Map();
  return {
    async create({ name, email, passwordHash, role }) {
      const user = { id: randomUUID(), name, email, passwordHash, role };
      byId.set(user.id, user);
      byEmail.set(email, user);
      return user;
    },
    async findByEmail(email) {
      return byEmail.get(email) || null;
    },
    async findById(id) {
      return byId.get(String(id)) || null;
    },
  };
}

export function createMongooseStore(User) {
  return {
    async create(data) {
      const user = await User.create(data);
      return user.toObject();
    },
    async findByEmail(email) {
      const user = await User.findOne({ email }).lean();
      return user || null;
    },
    async findById(id) {
      const user = await User.findById(id).lean();
      return user || null;
    },
  };
}
