import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is required. No database was changed.");
  process.exit(1);
}

const pool = new Pool({ connectionString, max: 1 });
const here = dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = join(here, "..", "..", "database", "migrations");

try {
  const files = (await readdir(migrationsDirectory))
    .filter((file) => /^\d{3}_.+\.sql$/.test(file))
    .sort();

  if (files.length === 0) {
    throw new Error("No numbered SQL migration files were found.");
  }

  const tableCheck = await pool.query("SELECT to_regclass('public.schema_migrations') AS table_name");
  const hasMigrationTable = Boolean(tableCheck.rows[0]?.table_name);
  const applied = new Set();

  if (hasMigrationTable) {
    const result = await pool.query("SELECT version FROM schema_migrations");
    for (const row of result.rows) applied.add(row.version);
  }

  for (const file of files) {
    const version = file.slice(0, 3);
    if (applied.has(version)) {
      console.log(`SKIP ${file} (already applied)`);
      continue;
    }

    console.log(`APPLY ${file}`);
    const sql = await readFile(join(migrationsDirectory, file), "utf8");
    await pool.query(sql);

    const verify = await pool.query(
      "SELECT 1 FROM schema_migrations WHERE version = $1",
      [version]
    );
    if (verify.rowCount !== 1) {
      throw new Error(`Migration ${file} completed without recording version ${version}.`);
    }
    console.log(`DONE ${file}`);
  }

  console.log("Database migrations are up to date.");
} catch (error) {
  console.error("Migration failed. Review the PostgreSQL error before retrying.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
