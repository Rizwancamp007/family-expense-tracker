import express from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { checkPassword, hashPassword, signToken } from "../services/auth.js";
import { publicUser } from "../store/users.js";

const ROLES = ["admin", "member"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function createAuthRouter(store) {
  const router = express.Router();

  router.post(
    "/register",
    asyncHandler(async (req, res) => {
      const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
      const email =
        typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
      const password = typeof req.body?.password === "string" ? req.body.password : "";
      const role = typeof req.body?.role === "string" ? req.body.role : "member";
      if (!name) return res.status(400).json({ message: "Name is required" });
      if (!EMAIL_RE.test(email)) {
        return res.status(400).json({ message: "Enter a valid email" });
      }
      if (password.length < 8) {
        return res.status(400).json({ message: "Password needs at least 8 characters" });
      }
      if (!ROLES.includes(role)) {
        return res.status(400).json({ message: "Role must be admin or member" });
      }
      const existing = await store.findByEmail(email);
      if (existing) {
        return res.status(409).json({ message: "That email is already registered" });
      }
      const user = await store.create({
        name,
        email,
        passwordHash: await hashPassword(password),
        role,
      });
      let token;
      try {
        token = signToken(user);
      } catch {
        return res.status(500).json({ message: "Server auth is not configured" });
      }
      return res.status(201).json({ user: publicUser(user), token });
    })
  );

  router.post(
    "/login",
    asyncHandler(async (req, res) => {
      const email =
        typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
      const password = typeof req.body?.password === "string" ? req.body.password : "";
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      const user = await store.findByEmail(email);
      if (!user || !(await checkPassword(password, user.passwordHash))) {
        return res.status(401).json({ message: "Wrong email or password" });
      }
      let token;
      try {
        token = signToken(user);
      } catch {
        return res.status(500).json({ message: "Server auth is not configured" });
      }
      return res.json({ user: publicUser(user), token });
    })
  );

  router.get(
    "/me",
    requireAuth,
    asyncHandler(async (req, res) => {
      const user = await store.findById(req.user.id);
      if (!user) return res.status(404).json({ message: "Account not found" });
      return res.json({ user: publicUser(user) });
    })
  );

  return router;
}
