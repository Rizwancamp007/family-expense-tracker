import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

export async function checkPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

// The secret is read from the environment at call time, never stored, and
// a missing secret fails loudly instead of signing tokens anyone could forge.
export function signToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }
  return jwt.sign(
    { id: String(user.id ?? user._id), role: user.role },
    secret,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

export function verifyToken(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }
  return jwt.verify(token, secret);
}
