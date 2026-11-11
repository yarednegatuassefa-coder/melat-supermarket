import { test } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const url=process.env.TEST_DATABASE_URL;
test("PostgreSQL schema migrations and integrity controls", {skip:!url}, async()=>{
  const parsed=new URL(url!);
  const dbName=parsed.pathname.replace(/^\//,"");
  assert.match(dbName,/test/i,"TEST_DATABASE_URL must point to a database with 'test' in its name");
  const pool=new pg.Pool({connectionString:url,max:2});
  try{
    const root=join(dirname(fileURLToPath(import.meta.url)),"..","..","..","database","migrations");
    const files=(await readdir(root)).filter(f=>/^\d{3}_.+\.sql$/.test(f)).sort();
    for(const file of files) await pool.query(await readFile(join(root,file),"utf8"));
    const versions=await pool.query("SELECT version FROM schema_migrations ORDER BY version");
    assert.deepEqual(versions.rows.map(r=>r.version),files.map(f=>f.slice(0,3)));
    const required=await pool.query("SELECT to_regclass('public.app_sessions') sessions,to_regclass('public.refund_lines') refund_lines,to_regclass('public.bank_reconciliations') bank_reconciliations");
    assert.ok(required.rows[0].sessions);assert.ok(required.rows[0].refund_lines);assert.ok(required.rows[0].bank_reconciliations);
    const accounts=await pool.query("SELECT count(*)::int count FROM chart_of_accounts");
    assert.ok(accounts.rows[0].count>=14);
    const cols=await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='app_users'");
    const names=new Set(cols.rows.map(r=>r.column_name));
    for(const col of ["failed_login_count","locked_until","last_login_at"])assert.ok(names.has(col));
  } finally {await pool.end();}
});
