import "dotenv/config";
import { Pool } from "pg";
import { hashPassword } from "../src/security/passwords.js";

const { DATABASE_URL, OWNER_USERNAME, OWNER_FULL_NAME, OWNER_INITIAL_PASSWORD } = process.env;
if (!DATABASE_URL || !OWNER_USERNAME || !OWNER_FULL_NAME || !OWNER_INITIAL_PASSWORD) {
  throw new Error("Set DATABASE_URL, OWNER_USERNAME, OWNER_FULL_NAME and OWNER_INITIAL_PASSWORD.");
}
const pool = new Pool({ connectionString: DATABASE_URL });
try {
  const existing = await pool.query("SELECT id FROM app_users WHERE role = 'owner' LIMIT 1");
  if (existing.rowCount) throw new Error("An owner account already exists. Bootstrap is disabled.");
  const username = OWNER_USERNAME.trim().toLowerCase();
  if (!/^[a-zA-Z0-9._-]{3,80}$/.test(username)) throw new Error("OWNER_USERNAME must be 3-80 letters, numbers, dots, underscores or hyphens.");
  const passwordHash = await hashPassword(OWNER_INITIAL_PASSWORD);
  await pool.query(
    "INSERT INTO app_users(username, full_name, password_hash, role, must_change_password) VALUES ($1, $2, $3, 'owner', true)",
    [username, OWNER_FULL_NAME.trim(), passwordHash]
  );
  console.log("Initial owner account created. Remove bootstrap credentials from the environment and sign in to change the password.");
} finally {
  await pool.end();
}
