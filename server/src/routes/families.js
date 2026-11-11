import express from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { makeInviteCode, publicFamily } from "../store/families.js";

// Who this user is inside this family, or nothing if they don't belong.
export function familyMembership(family, userId) {
  if (!family) return null;
  return (
    (family.members || []).find((m) => String(m.userId) === String(userId)) ||
    null
  );
}

export function isFamilyAdmin(family, userId) {
  return familyMembership(family, userId)?.role === "admin";
}

export function createFamiliesRouter(db) {
  const router = express.Router();
  const { families, users } = db;

  async function loadFamily(req, res, next) {
    const family = await families.findById(req.params.id);
    if (!family) return res.status(404).json({ message: "Family not found" });
    if (!familyMembership(family, req.user.id)) {
      return res.status(403).json({ message: "You are not part of this family" });
    }
    req.family = family;
    return next();
  }

  router.post(
    "/",
    requireAuth,
    asyncHandler(async (req, res) => {
      const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
      if (!name) return res.status(400).json({ message: "Family name is required" });
      // Codes are random, but check anyway so two families never share one.
      let inviteCode = makeInviteCode();
      while (await families.findByInviteCode(inviteCode)) {
        inviteCode = makeInviteCode();
      }
      const family = await families.create({
        name,
        inviteCode,
        createdBy: req.user.id,
      });
      return res.status(201).json({ family: publicFamily(family) });
    })
  );

  router.post(
    "/join",
    requireAuth,
    asyncHandler(async (req, res) => {
      const code =
        typeof req.body?.inviteCode === "string"
          ? req.body.inviteCode.trim().toUpperCase()
          : "";
      if (!code) return res.status(400).json({ message: "Invite code is required" });
      const family = await families.findByInviteCode(code);
      if (!family) {
        return res.status(404).json({ message: "No family found with that invite code" });
      }
      if (familyMembership(family, req.user.id)) {
        return res.status(409).json({ message: "You are already part of this family" });
      }
      const updated = await families.addMember(family, req.user.id, "member");
      return res.json({ family: publicFamily(updated) });
    })
  );

  router.get(
    "/mine",
    requireAuth,
    asyncHandler(async (req, res) => {
      const mine = await families.findByUserId(req.user.id);
      return res.json({ families: mine.map(publicFamily) });
    })
  );

  router.get(
    "/:id",
    requireAuth,
    loadFamily,
    asyncHandler(async (req, res) => {
      return res.json({ family: publicFamily(req.family) });
    })
  );

  router.get(
    "/:id/members",
    requireAuth,
    loadFamily,
    asyncHandler(async (req, res) => {
      const members = [];
      for (const m of req.family.members) {
        const user = await users.findById(m.userId);
        members.push({
          userId: String(m.userId),
          role: m.role,
          name: user?.name || "Unknown",
          email: user?.email || "",
        });
      }
      return res.json({ members });
    })
  );

  router.delete(
    "/:id/members/:userId",
    requireAuth,
    loadFamily,
    asyncHandler(async (req, res) => {
      if (!isFamilyAdmin(req.family, req.user.id)) {
        return res
          .status(403)
          .json({ message: "Only the family admin can remove members" });
      }
      if (String(req.params.userId) === String(req.user.id)) {
        return res
          .status(400)
          .json({ message: "You can't remove yourself from the family" });
      }
      if (!familyMembership(req.family, req.params.userId)) {
        return res.status(404).json({ message: "That person is not in this family" });
      }
      const updated = await families.removeMember(req.family, req.params.userId);
      return res.json({ family: publicFamily(updated) });
    })
  );

  return router;
}
