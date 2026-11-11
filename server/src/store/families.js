import { randomBytes, randomUUID } from "node:crypto";

// Invite codes are short and easy to share in a message — 6 characters,
// uppercase so casing never matters when someone types one in.
export function makeInviteCode() {
  return randomBytes(3).toString("hex").toUpperCase();
}

export function publicFamily(family) {
  if (!family) return null;
  return {
    id: String(family.id ?? family._id),
    name: family.name,
    inviteCode: family.inviteCode,
    members: (family.members || []).map((m) => ({
      userId: String(m.userId),
      role: m.role,
    })),
    createdAt: family.createdAt,
  };
}

export function createMemoryFamilyStore() {
  const byId = new Map();
  const byInviteCode = new Map();
  return {
    async create({ name, inviteCode, createdBy }) {
      const family = {
        id: randomUUID(),
        name,
        inviteCode,
        members: [{ userId: String(createdBy), role: "admin" }],
        createdBy: String(createdBy),
        createdAt: new Date().toISOString(),
      };
      byId.set(family.id, family);
      byInviteCode.set(inviteCode, family);
      return family;
    },
    async findById(id) {
      return byId.get(String(id)) || null;
    },
    async findByInviteCode(code) {
      return byInviteCode.get(String(code).toUpperCase()) || null;
    },
    async findByUserId(userId) {
      const id = String(userId);
      return [...byId.values()].filter((f) =>
        f.members.some((m) => String(m.userId) === id)
      );
    },
    async addMember(family, userId, role = "member") {
      const member = { userId: String(userId), role };
      family.members.push(member);
      return family;
    },
    async removeMember(family, userId) {
      const id = String(userId);
      family.members = family.members.filter((m) => String(m.userId) !== id);
      return family;
    },
  };
}

export function createMongooseFamilyStore(Family) {
  return {
    async create({ name, inviteCode, createdBy }) {
      const family = await Family.create({
        name,
        inviteCode,
        members: [{ userId: String(createdBy), role: "admin" }],
        createdBy: String(createdBy),
      });
      return family.toObject();
    },
    async findById(id) {
      const family = await Family.findById(id).lean();
      return family || null;
    },
    async findByInviteCode(code) {
      const family = await Family.findOne({
        inviteCode: String(code).toUpperCase(),
      }).lean();
      return family || null;
    },
    async findByUserId(userId) {
      return Family.find({ "members.userId": String(userId) }).lean();
    },
    async addMember(family, userId, role = "member") {
      const updated = await Family.findByIdAndUpdate(
        family._id,
        { $push: { members: { userId: String(userId), role } } },
        { new: true }
      ).lean();
      return updated;
    },
    async removeMember(family, userId) {
      const updated = await Family.findByIdAndUpdate(
        family._id,
        { $pull: { members: { userId: String(userId) } } },
        { new: true }
      ).lean();
      return updated;
    },
  };
}
