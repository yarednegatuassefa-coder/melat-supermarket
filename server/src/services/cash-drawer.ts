import type { PoolClient } from "pg";

export async function expectedCashDrawerBalance(client:PoolClient,sessionId:string):Promise<number>{
 const r=await client.query(`
  SELECT cs.opening_cash::text opening_cash,
   COALESCE((SELECT sum(p.amount) FROM sale_payments p JOIN sales s ON s.id=p.sale_id WHERE s.cash_session_id=cs.id AND p.method='cash' AND p.status IN ('confirmed','settled')),0)::text cash_sales,
   COALESCE((SELECT sum(e.amount) FROM expenses e WHERE e.cash_session_id=cs.id AND e.payment_method='cash' AND e.status='posted'),0)::text cash_expenses,
   COALESCE((SELECT sum(r.amount) FROM refunds r WHERE r.cash_session_id=cs.id AND r.payment_method='cash' AND r.status='posted'),0)::text cash_refunds,
   COALESCE((SELECT sum(CASE WHEN movement_type='cash_addition' THEN amount WHEN movement_type IN ('withdrawal','bank_deposit','cash_drop') THEN -amount ELSE 0 END) FROM cash_drawer_movements WHERE cash_session_id=cs.id),0)::text drawer_movements
  FROM cash_sessions cs WHERE cs.id=$1
 `,[sessionId]);
 if(!r.rowCount)throw new Error("Cash drawer session not found.");
 const x=r.rows[0];
 return Number(x.opening_cash)+Number(x.cash_sales)-Number(x.cash_expenses)-Number(x.cash_refunds)+Number(x.drawer_movements);
}

export async function assertCashAvailable(client:PoolClient,sessionId:string,amount:string|number):Promise<void>{
 const expected=await expectedCashDrawerBalance(client,sessionId);
 const requested=Number(amount);
 if(!Number.isFinite(requested)||requested<=0)throw new Error("Cash movement amount must be positive.");
 if(expected< -0.00005)throw new Error("Expected cash is already negative; reconcile the drawer before continuing.");
 if(requested>expected+0.00005)throw new Error(`Insufficient cash in drawer. Expected available cash is ${expected.toFixed(4)} ETB.`);
}
