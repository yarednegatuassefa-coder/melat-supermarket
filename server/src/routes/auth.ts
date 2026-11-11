import { Router } from "express";
import { z } from "zod";
import type { Pool } from "pg";
import { hashPassword, verifyPassword } from "../security/passwords.js";
import { createSession, destroySession, requireAuth, allowRoles } from "../security/sessions.js";

const loginSchema = z.object({ username: z.string().trim().min(1).max(80), password: z.string().min(1).max(200) });
const createUserSchema = z.object({
  username: z.string().trim().min(3).max(80).regex(/^[a-zA-Z0-9._-]+$/),
  fullName: z.string().trim().min(2).max(160),
  password: z.string().min(12).max(200),
  role: z.enum(["manager", "cashier", "inventory_clerk"])
});

export function authRoutes(pool: Pool) {
  const router = Router();

  router.post("/login", async (req, res, next) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Enter a valid username and password." });
      const username = parsed.data.username.toLowerCase();
      const result = await pool.query(
        "SELECT id, username, full_name, password_hash, role, is_active, must_change_password, locked_until FROM app_users WHERE lower(username) = $1",
        [username]
      );
      if (!result.rowCount) {
        await hashPassword("invalid-login-probe-password");
        return res.status(401).json({ error: "Invalid username or password." });
      }
      const user = result.rows[0];
      if (!user.is_active || (user.locked_until && new Date(user.locked_until) > new Date())) {
        return res.status(401).json({ error: "Account unavailable. Contact the store owner." });
      }
      const valid = await verifyPassword(parsed.data.password, user.password_hash);
      if (!valid) {
        await pool.query(
          `UPDATE app_users SET failed_login_count = failed_login_count + 1,
             locked_until = CASE WHEN failed_login_count + 1 >= 8 THEN now() + interval '15 minutes' ELSE locked_until END
           WHERE id = $1`, [user.id]
        );
        return res.status(401).json({ error: "Invalid username or password." });
      }
      await pool.query("UPDATE app_users SET failed_login_count = 0, locked_until = NULL, last_login_at = now() WHERE id = $1", [user.id]);
      await createSession(pool, user.id, req, res);
      return res.json({ user: { id: user.id, username: user.username, fullName: user.full_name, role: user.role, mustChangePassword: user.must_change_password } });
    } catch (error) { return next(error); }
  });

  router.post("/logout", requireAuth(pool), async (req, res, next) => {
    try { await destroySession(pool, req, res); return res.status(204).end(); }
    catch (error) { return next(error); }
  });

  router.get("/me", requireAuth(pool), (req, res) => res.json({ user: req.user }));

  router.post("/users", requireAuth(pool), allowRoles("owner"), async (req, res, next) => {
    try {
      const parsed = createUserSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid staff details. Passwords must contain at least 12 characters." });
      const passwordHash = await hashPassword(parsed.data.password);
      const result = await pool.query(
        `INSERT INTO app_users(username, full_name, password_hash, role, must_change_password)
         VALUES ($1, $2, $3, $4, true)
         RETURNING id, username, full_name, role, must_change_password`,
        [parsed.data.username.toLowerCase(), parsed.data.fullName, passwordHash, parsed.data.role]
      );
      return res.status(201).json({ user: result.rows[0] });
    } catch (error) {
      if ((error as { code?: string }).code === "23505") return res.status(409).json({ error: "That username is already in use." });
      return next(error);
    }
  });

  router.post("/change-password", requireAuth(pool), async (req, res, next) => {
    try {
      const schema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(12).max(200) });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "New password must contain at least 12 characters." });
      const current = await pool.query("SELECT password_hash FROM app_users WHERE id = $1", [req.user!.id]);
      if (!await verifyPassword(parsed.data.currentPassword, current.rows[0].password_hash)) return res.status(400).json({ error: "Current password is incorrect." });
      const passwordHash = await hashPassword(parsed.data.newPassword);
      await pool.query("UPDATE app_users SET password_hash = $2, must_change_password = false, updated_at = now() WHERE id = $1", [req.user!.id, passwordHash]);
      await pool.query("UPDATE app_sessions SET revoked_at = now() WHERE user_id = $1 AND id <> $2 AND revoked_at IS NULL", [req.user!.id, req.sessionId]);
      return res.json({ ok: true });
    } catch (error) { return next(error); }
  });

  return router;
}
