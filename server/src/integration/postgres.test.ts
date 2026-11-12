import { test } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { randomUUID } from "node:crypto";
import { postGoodsReceipt } from "../services/inventory-receipts.js";
import { createSale, finalizeSale, releaseSaleReservations } from "../services/sales.js";
import { reverseInventoryMovements, reverseJournal } from "../services/reversals.js";
import { assertCashAvailable, expectedCashDrawerBalance } from "../services/cash-drawer.js";

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
    assert.ok(accounts.rows[0].count>=16);
    const grni=await pool.query("SELECT id FROM chart_of_accounts WHERE account_code='2010'");
    const cashOverShort=await pool.query("SELECT id FROM chart_of_accounts WHERE account_code='5200'");
    assert.equal(cashOverShort.rowCount,1,"cash over and short account is required for drawer variance posting");
    assert.equal(grni.rowCount,1,"goods received not invoiced account is required for receipt accrual");
    const cols=await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='app_users'");
    const names=new Set(cols.rows.map(r=>r.column_name));
    for(const col of ["failed_login_count","locked_until","last_login_at"])assert.ok(names.has(col));
    const workflowColumns=await pool.query("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' AND (table_name,column_name) IN (('goods_receipt_lines','purchase_order_line_id'),('supplier_invoices','tax_rate_id'),('supplier_invoices','tax_recoverable'),('bank_reconciliations','statement_start_date'),('refunds','posted_at'),('refunds','reversed_at'),('supplier_payments','cash_session_id'),('expenses','status'),('expenses','reversed_at'),('inventory_balances','reserved_quantity'))");
    assert.equal(workflowColumns.rows.length,10,"required purchasing, tax, bank and refund workflow columns are missing");

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
    for(const receiptId of [receipt1,receipt2]){const receiptJournal=await pool.query("SELECT round(sum(l.debit-l.credit),4)::text difference FROM journal_entries e JOIN journal_lines l ON l.journal_entry_id=e.id WHERE e.source_type='goods_receipt' AND e.source_id=$1",[receiptId]);assert.equal(Number(receiptJournal.rows[0].difference),0,"goods receipt must accrue balanced inventory and GRNI");}

    const checkout=await createSale(pool,{actorId:user,cashSessionId:session,idempotencyKey:"it-sale-"+suffix,lines:[{productId:product,quantity:"2"}],payments:[{method:"cash",amount:"10"},{method:"cbe",amount:"15",providerReference:"IT-CBE-"+suffix},{method:"telebirr",amount:"15",providerReference:"IT-TB-"+suffix}]});
    assert.equal(checkout.status,"awaiting_payment");
    assert.equal(checkout.pendingPaymentIds?.length,2,"each electronic tender must remain independently verifiable");
    const stillOnHand=await pool.query("SELECT quantity_on_hand::text qty,reserved_quantity::text reserved FROM inventory_balances WHERE product_id=$1",[product]);
    assert.equal(Number(stillOnHand.rows[0].qty),20,"pending electronic tender must not decrement physical stock");
    assert.equal(Number(stillOnHand.rows[0].reserved),2,"pending checkout must reserve its sellable stock");
    const client=await pool.connect();
    try{
      await client.query("BEGIN");
      await client.query("UPDATE sale_payments SET status='confirmed',verified_by=$2,verified_at=now() WHERE sale_id=$1 AND method IN ('cbe','telebirr')",[checkout.saleId,user]);
      await finalizeSale(client,checkout.saleId,user);
      await client.query("COMMIT");
    }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
    const after=await pool.query("SELECT quantity_on_hand::text qty,weighted_average_cost::text wac,reserved_quantity::text reserved FROM inventory_balances WHERE product_id=$1",[product]);
    assert.equal(Number(after.rows[0].qty),18);
    assert.equal(Number(after.rows[0].reserved),0,"finalized sale must consume its stock reservation");
    const saleLines=await pool.query("SELECT unit_wac_snapshot::text wac FROM sale_lines WHERE sale_id=$1",[checkout.saleId]);
    assert.equal(Number(saleLines.rows[0].wac),15);
    const allocation=await pool.query("SELECT b.id batch_id,b.expiry_date,a.quantity::text qty FROM sale_line_batch_allocations a JOIN inventory_batches b ON b.id=a.batch_id JOIN sale_lines l ON l.id=a.sale_line_id WHERE l.sale_id=$1",[checkout.saleId]);
    assert.equal(allocation.rows.length,1);assert.equal(new Date(allocation.rows[0].expiry_date).toISOString().slice(0,10),"2026-12-01");
    const balanced=await pool.query("SELECT round(sum(l.debit-l.credit),4)::text difference FROM journal_lines l JOIN journal_entries e ON e.id=l.journal_entry_id WHERE e.source_type='sale' AND e.source_id=$1",[checkout.saleId]);
    assert.equal(Number(balanced.rows[0].difference),0,"posted sale journal must balance");
    const abandoned=await createSale(pool,{actorId:user,cashSessionId:session,idempotencyKey:"it-abandon-"+suffix,lines:[{productId:product,quantity:"1"}],payments:[{method:"cbe",amount:"20",providerReference:"IT-ABANDON-"+suffix}]});
    assert.equal(abandoned.status,"awaiting_payment");
    const held=await pool.query("SELECT reserved_quantity::text reserved,quantity_on_hand::text qty FROM inventory_balances WHERE product_id=$1",[product]);
    assert.equal(Number(held.rows[0].reserved),1);assert.equal(Number(held.rows[0].qty),18);
    const cancelClient=await pool.connect();
    try{await cancelClient.query("BEGIN");await releaseSaleReservations(cancelClient,abandoned.saleId);await cancelClient.query("UPDATE sale_payments SET status='failed' WHERE sale_id=$1 AND status='pending'",[abandoned.saleId]);await cancelClient.query("UPDATE sales SET status='voided' WHERE id=$1",[abandoned.saleId]);await cancelClient.query("COMMIT");}catch(error){await cancelClient.query("ROLLBACK");throw error;}finally{cancelClient.release();}
    const released=await pool.query("SELECT reserved_quantity::text reserved,quantity_on_hand::text qty FROM inventory_balances WHERE product_id=$1",[product]);
    assert.equal(Number(released.rows[0].reserved),0,"cancelling pending checkout must release reserved stock");assert.equal(Number(released.rows[0].qty),18);

    // Refund posting and reversal must restore the original batch and reverse the exact journal.
    const saleLine=(await pool.query("SELECT * FROM sale_lines WHERE sale_id=$1",[checkout.saleId])).rows[0];
    const batchId=allocation.rows[0].batch_id;
    const refundId=(await pool.query("INSERT INTO refunds(refund_number,sale_id,cash_session_id,amount,reason,status,requested_by,approved_by,payment_method,posted_at) VALUES($1,$2,$3,20,'Integration return','posted',$4,$4,'cash',now()) RETURNING id",["ITRF-"+suffix,checkout.saleId,session,user])).rows[0].id;
    await pool.query("INSERT INTO refund_lines(refund_id,sale_line_id,quantity,amount,restock_condition,inspected_by,inspected_at) VALUES($1,$2,1,20,'restock',$3,now())",[refundId,saleLine.id,user]);
    await pool.query("UPDATE inventory_batches SET remaining_quantity=remaining_quantity+1 WHERE id=$1",[batchId]);
    await pool.query("UPDATE inventory_balances SET quantity_on_hand=quantity_on_hand+1 WHERE product_id=$1",[product]);
    await pool.query("INSERT INTO inventory_movements(product_id,batch_id,movement_type,quantity_delta,unit_cost,source_type,source_id,reason,actor_id) VALUES($1,$2,'customer_return',1,15,'refund',$3,'Integration refund', $4)",[product,batchId,refundId,user]);
    const revenueAccount=(await pool.query("SELECT id FROM chart_of_accounts WHERE account_code='4000'")).rows[0].id;
    const cashAccount=(await pool.query("SELECT id FROM chart_of_accounts WHERE account_code='1000'")).rows[0].id;
    const inventoryAccount=(await pool.query("SELECT id FROM chart_of_accounts WHERE account_code='1100'")).rows[0].id;
    const cogsAccount=(await pool.query("SELECT id FROM chart_of_accounts WHERE account_code='5000'")).rows[0].id;
    const refundJournal=(await pool.query("INSERT INTO journal_entries(entry_number,entry_date,description,source_type,source_id,status,posted_at,posted_by) VALUES($1,CURRENT_DATE,'Integration refund','refund',$2,'posted',now(),$3) RETURNING id",["ITRJ-"+suffix,refundId,user])).rows[0].id;
    await pool.query("INSERT INTO journal_lines(journal_entry_id,account_id,debit,credit) VALUES($1,$2,20,0),($1,$3,0,20),($1,$4,15,0),($1,$5,0,15)",[refundJournal,revenueAccount,cashAccount,inventoryAccount,cogsAccount]);
    const reverseClient=await pool.connect();
    try{await reverseClient.query("BEGIN");await reverseInventoryMovements(reverseClient,user,"refund",refundId,["customer_return"]);await reverseJournal(reverseClient,user,"refund",refundId);await reverseClient.query("COMMIT");}catch(error){await reverseClient.query("ROLLBACK");throw error;}finally{reverseClient.release();}
    const reversedStock=await pool.query("SELECT quantity_on_hand::text qty FROM inventory_balances WHERE product_id=$1",[product]);
    const reversedBatch=await pool.query("SELECT remaining_quantity::text qty FROM inventory_batches WHERE id=$1",[batchId]);
    assert.equal(Number(reversedStock.rows[0].qty),18);assert.equal(Number(reversedBatch.rows[0].qty),8);
    const reversedEntry=await pool.query("SELECT e.status,round(sum(l.debit-l.credit),4)::text difference FROM journal_entries e JOIN journal_lines l ON l.journal_entry_id=e.id WHERE e.id=$1 GROUP BY e.id",[refundJournal]);
    assert.equal(reversedEntry.rows[0].status,"reversed");assert.equal(Number(reversedEntry.rows[0].difference),0);
    const reversalJournal=await pool.query("SELECT round(sum(l.debit-l.credit),4)::text difference FROM journal_entries e JOIN journal_lines l ON l.journal_entry_id=e.id WHERE e.reversal_of=$1 GROUP BY e.id",[refundJournal]);
    assert.equal(Number(reversalJournal.rows[0].difference),0);
    await pool.query("UPDATE refunds SET status='reversed' WHERE id=$1",[refundId]);
    const drawerClient=await pool.connect();
    try{
      const expected=await expectedCashDrawerBalance(drawerClient,session);
      assert.equal(expected,110,"drawer should contain opening float plus confirmed cash tender after refund reversal");
      await assertCashAvailable(drawerClient,session,"110");
      await assert.rejects(()=>assertCashAvailable(drawerClient,session,"111"),/Insufficient cash in drawer/);
    }finally{drawerClient.release();}


  } finally {await pool.end();}
});
