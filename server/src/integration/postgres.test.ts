import { test } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { randomUUID } from "node:crypto";
import { postGoodsReceipt } from "../services/inventory-receipts.js";
import { createSale, finalizeSale } from "../services/sales.js";

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

    // End-to-end PostgreSQL exercise: weighted-average receipts, pending split tender,
    // FEFO allocation, inventory decrement and balanced double-entry posting.
    const suffix=randomUUID().replaceAll("-","").slice(0,12);
    const user=(await pool.query("INSERT INTO app_users(username,full_name,password_hash,role,must_change_password) VALUES($1,$2,'test-hash','cashier',false) RETURNING id",["it-"+suffix,"Integration Test Cashier"])).rows[0].id;
    const supplier=(await pool.query("INSERT INTO suppliers(supplier_code,name) VALUES($1,'Integration Test Supplier') RETURNING id",["ITS-"+suffix])).rows[0].id;
    const product=(await pool.query("INSERT INTO products(sku,name_en,base_unit,tracks_expiry) VALUES($1,'Integration Test Rice','kg',true) RETURNING id",["ITP-"+suffix])).rows[0].id;
    await pool.query("INSERT INTO product_prices(product_id,selling_price,created_by) VALUES($1,20,$2)",[product,user]);
    const session=(await pool.query("INSERT INTO cash_sessions(session_number,cashier_id,opening_cash) VALUES($1,$2,100) RETURNING id",["ITCS-"+suffix,user])).rows[0].id;
    const receipt1=(await pool.query("INSERT INTO goods_receipts(receipt_number,supplier_id,status,received_by) VALUES($1,$2,'draft',$3) RETURNING id",["ITGR1-"+suffix,supplier,user])).rows[0].id;
    const receipt2=(await pool.query("INSERT INTO goods_receipts(receipt_number,supplier_id,status,received_by) VALUES($1,$2,'draft',$3) RETURNING id",["ITGR2-"+suffix,supplier,user])).rows[0].id;
    await pool.query("INSERT INTO goods_receipt_lines(goods_receipt_id,product_id,quantity_received,unit_cost,expiry_date) VALUES($1,$2,10,10,'2026-12-01'),($3,$2,10,20,'2026-12-31')",[receipt1,product,receipt2]);
    await postGoodsReceipt(pool,{receiptId:receipt1,actorId:user,idempotencyKey:"it-receipt-1-"+suffix});
    await postGoodsReceipt(pool,{receiptId:receipt2,actorId:user,idempotencyKey:"it-receipt-2-"+suffix});
    const before=await pool.query("SELECT quantity_on_hand::text qty,weighted_average_cost::text wac FROM inventory_balances WHERE product_id=$1",[product]);
    assert.equal(Number(before.rows[0].qty),20);assert.equal(Number(before.rows[0].wac),15);
    const checkout=await createSale(pool,{actorId:user,cashSessionId:session,idempotencyKey:"it-sale-"+suffix,lines:[{productId:product,quantity:"2"}],payments:[{method:"cash",amount:"10"},{method:"cbe",amount:"30",providerReference:"IT-CBE-"+suffix}]});
    assert.equal(checkout.status,"awaiting_payment");
    const stillOnHand=await pool.query("SELECT quantity_on_hand::text qty FROM inventory_balances WHERE product_id=$1",[product]);
    assert.equal(Number(stillOnHand.rows[0].qty),20,"pending electronic tender must not decrement stock");
    const client=await pool.connect();
    try{
      await client.query("BEGIN");
      await client.query("UPDATE sale_payments SET status='confirmed',verified_by=$2,verified_at=now() WHERE sale_id=$1 AND method='cbe'",[checkout.saleId,user]);
      await finalizeSale(client,checkout.saleId,user);
      await client.query("COMMIT");
    }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
    const after=await pool.query("SELECT quantity_on_hand::text qty,weighted_average_cost::text wac FROM inventory_balances WHERE product_id=$1",[product]);
    assert.equal(Number(after.rows[0].qty),18);
    const saleLines=await pool.query("SELECT unit_wac_snapshot::text wac FROM sale_lines WHERE sale_id=$1",[checkout.saleId]);
    assert.equal(Number(saleLines.rows[0].wac),15);
    const allocation=await pool.query("SELECT b.expiry_date,a.quantity::text qty FROM sale_line_batch_allocations a JOIN inventory_batches b ON b.id=a.batch_id JOIN sale_lines l ON l.id=a.sale_line_id WHERE l.sale_id=$1",[checkout.saleId]);
    assert.equal(allocation.rows.length,1);assert.equal(String(allocation.rows[0].expiry_date).slice(0,10),"2026-12-01");
    const balanced=await pool.query("SELECT round(sum(l.debit-l.credit),4)::text difference FROM journal_lines l JOIN journal_entries e ON e.id=l.journal_entry_id WHERE e.source_type='sale' AND e.source_id=$1",[checkout.saleId]);
    assert.equal(Number(balanced.rows[0].difference),0,"posted sale journal must balance");

  } finally {await pool.end();}
});
