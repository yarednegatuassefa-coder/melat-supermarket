import { createHash, randomBytes } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { Pool } from "pg";

export interface AuthenticatedUser {
  id: string;
  username: string;
  fullName: string;
  role: "owner" | "manager" | "cashier" | "inventory_clerk";
  mustChangePassword: boolean;
}

declare global {
  namespace Express {
    interface Request { user?: AuthenticatedUser; sessionId?: string; }
  }
}

const COOKIE = "melat_session";
const SESSION_DAYS = 12;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

export async function createSession(pool: Pool, userId: string, req: Request, res: Response) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);
  const inserted = await pool.query(
    `INSERT INTO app_sessions(user_id, token_hash, expires_at, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [userId, hash(token), expiresAt, req.ip, req.get("user-agent") ?? null]
  );
  res.cookie(COOKIE, token, {
    httpOnly: true, secure: process.env.COOKIE_SECURE === "true" || (process.env.COOKIE_SECURE !== "false" && process.env.NODE_ENV === "production"),
    sameSite: "lax", path: "/", expires: expiresAt
  });
  return inserted.rows[0].id as string;
}

export async function destroySession(pool: Pool, req: Request, res: Response) {
  const token = req.cookies?.[COOKIE];
  if (token) await pool.query(
    "UPDATE app_sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL",
    [hash(token)]
  );
  res.clearCookie(COOKIE, { httpOnly: true, secure: process.env.COOKIE_SECURE === "true", sameSite: "lax", path: "/" });
}

export function requireAuth(pool: Pool) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.cookies?.[COOKIE];
      if (!token) return res.status(401).json({ error: "Authentication required." });
      const result = await pool.query(
        `SELECT s.id AS session_id, u.id, u.username, u.full_name, u.role, u.must_change_password
           FROM app_sessions s JOIN app_users u ON u.id = s.user_id
          WHERE s.token_hash = $1 AND s.revoked_at IS NULL
            AND s.expires_at > now() AND u.is_active = true`,
        [hash(token)]
      );
      if (!result.rowCount) return res.status(401).json({ error: "Session expired. Sign in again." });
      const row = result.rows[0];
      req.user = { id: row.id, username: row.username, fullName: row.full_name, role: row.role, mustChangePassword: row.must_change_password };
      req.sessionId = row.session_id;
      void pool.query("UPDATE app_sessions SET last_seen_at = now() WHERE id = $1", [row.session_id]);
      return next();
    } catch (error) { return next(error); }
  };
}

export function allowRoles(...roles: AuthenticatedUser["role"][]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: "You do not have permission to perform this action." });
    return next();
  };
}
