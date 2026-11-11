import type { PoolClient } from "pg";

export async function reverseJournal(client:PoolClient,actorId:string,sourceType:string,sourceId:string){
 const original=await client.query("SELECT * FROM journal_entries WHERE source_type=$1 AND source_id=$2 FOR UPDATE",[sourceType,sourceId]);
 if(!original.rowCount)throw new Error("Original posted journal entry was not found.");
 const entry=original.rows[0];if(entry.status!=="posted")throw new Error("Only a posted journal entry can be reversed.");
 const lines=await client.query("SELECT account_id,debit,credit,description FROM journal_lines WHERE journal_entry_id=$1",[entry.id]);
 if(!lines.rowCount)throw new Error("Original journal has no lines.");
 const reversal=await client.query(
  "INSERT INTO journal_entries(entry_number,entry_date,description,source_type,source_id,status,posted_at,posted_by,reversal_of) VALUES($1,CURRENT_DATE,$2,'reversal',$3,'posted',now(),$4,$5) RETURNING id",
  ["REV-"+entry.entry_number,"Reversal of "+entry.entry_number,entry.id,actorId,entry.id]
 );
 for(const line of lines.rows)await client.query(
  "INSERT INTO journal_lines(journal_entry_id,account_id,debit,credit,description) VALUES($1,$2,$3,$4,$5)",
  [reversal.rows[0].id,line.account_id,line.credit,line.debit,"Reversal: "+(line.description??entry.description)]
 );
 await client.query("UPDATE journal_entries SET status='reversed' WHERE id=$1",[entry.id]);
 return reversal.rows[0].id as string;
}

export async function reverseInventoryMovements(client:PoolClient,actorId:string,sourceType:string,sourceId:string,allowedTypes:string[]){
 const movements=await client.query(
  "SELECT * FROM inventory_movements WHERE source_type=$1 AND source_id=$2 AND movement_type=ANY($3::text[]) ORDER BY product_id,batch_id FOR UPDATE",
  [sourceType,sourceId,allowedTypes]
 );
 for(const movement of movements.rows){
  const batch=await client.query("SELECT original_quantity,remaining_quantity FROM inventory_batches WHERE id=$1 FOR UPDATE",[movement.batch_id]);
  if(!batch.rowCount)throw new Error("Original inventory batch was not found.");
  const delta=Number(movement.quantity_delta),reverseDelta=-delta;
  const nextBatch=Number(batch.rows[0].remaining_quantity)+reverseDelta;
  if(nextBatch < -0.00005 || nextBatch > Number(batch.rows[0].original_quantity)+0.00005)throw new Error("Inventory has moved since the original transaction; reversal would create invalid batch stock.");
  const balance=await client.query("SELECT quantity_on_hand,weighted_average_cost,reserved_quantity FROM inventory_balances WHERE product_id=$1 FOR UPDATE",[movement.product_id]);
  if(!balance.rowCount)throw new Error("Inventory balance is missing.");
  const oldQty=Number(balance.rows[0].quantity_on_hand),oldWac=Number(balance.rows[0].weighted_average_cost),newQty=oldQty+reverseDelta;
  if(newQty < Number(balance.rows[0].reserved_quantity)-0.00005)throw new Error("Cannot reverse this transaction because stock is reserved for a pending checkout.");if(newQty < -0.00005)throw new Error("Insufficient current stock to reverse this transaction.");
  const unitCost=Number(movement.unit_cost),oldValue=oldQty*oldWac,newValue=oldValue+(reverseDelta*unitCost);
  const newWac=newQty<=0.00005?0:Math.max(0,newValue/newQty);
  await client.query("UPDATE inventory_batches SET remaining_quantity=$2 WHERE id=$1",[movement.batch_id,Math.max(0,nextBatch).toFixed(4)]);
  await client.query("UPDATE inventory_balances SET quantity_on_hand=$2,weighted_average_cost=$3,updated_at=now() WHERE product_id=$1",[movement.product_id,Math.max(0,newQty).toFixed(4),newWac.toFixed(4)]);
  const inverseType=reverseDelta>0?"adjustment_in":"adjustment_out";
  await client.query(
   "INSERT INTO inventory_movements(product_id,batch_id,movement_type,quantity_delta,unit_cost,source_type,source_id,reason,actor_id,reversal_of) VALUES($1,$2,$3,$4,$5,'reversal',$6,$7,$8,$9)",
   [movement.product_id,movement.batch_id,inverseType,reverseDelta.toFixed(4),movement.unit_cost,movement.id,"Reversal of "+movement.movement_type,actorId,movement.id]
  );
 }
 return movements.rowCount??0;
}
