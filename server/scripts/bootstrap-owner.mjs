import "dotenv/config";
import { Pool } from "pg";
import { hashPassword } from "../dist/security/passwords.js";

const { DATABASE_URL, OWNER_USERNAME } = process.env;
const ownerFullName = process.env.OWNER_FULL_NAME_BASE64
  ? Buffer.from(process.env.OWNER_FULL_NAME_BASE64, "base64").toString("utf8")
  : process.env.OWNER_FULL_NAME;
const ownerPassword = process.env.OWNER_INITIAL_PASSWORD_BASE64
  ? Buffer.from(process.env.OWNER_INITIAL_PASSWORD_BASE64, "base64").toString("utf8")
  : process.env.OWNER_INITIAL_PASSWORD;

if (!DATABASE_URL || !OWNER_USERNAME || !ownerFullName || !ownerPassword) {
  throw new Error("Set DATABASE_URL, OWNER_USERNAME, owner full name and initial password bootstrap values.");
}
if (ownerPassword.length < 16) {
  throw new Error("Initial owner password must contain at least 16 characters.");
}

const pool = new Pool({ connectionString: DATABASE_URL });
try {
  const existing = await pool.query("SELECT id FROM app_users WHERE role = 'owner' LIMIT 1");
  if (existing.rowCount) throw new Error("An owner account already exists. Bootstrap is disabled.");
  const username = OWNER_USERNAME.trim().toLowerCase();
  if (!/^[a-zA-Z0-9._-]{3,80}$/.test(username)) throw new Error("OWNER_USERNAME must be 3-80 letters, numbers, dots, underscores or hyphens.");
  const passwordHash = await hashPassword(ownerPassword);
  await pool.query(
    "INSERT INTO app_users(username, full_name, password_hash, role, must_change_password) VALUES ($1, $2, $3, 'owner', true)",
    [username, ownerFullName.trim(), passwordHash]
  );
  console.log("Initial owner account created. Remove bootstrap credentials from the environment and sign in to change the password.");
} finally {
  await pool.end();
}
