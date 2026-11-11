import type { Pool, PoolClient } from "pg";

type CheckoutLine = { productId: string; quantity: string; discountAmount?: string; taxRateId?: string | null };
type Tender = { method: "cash" | "cbe" | "telebirr" | "card"; amount: string; providerReference?: string };

const money = (v: string | number) => Number(v);
const amount = (v: number) => v.toFixed(4);
async function account(client: PoolClient, code: string) {
  const r = await client.query("SELECT id FROM chart_of_accounts WHERE account_code=$1 AND is_active=true", [code]);
  if (!r.rowCount) throw new Error(`Required ledger account ${code} is missing.`);
  return r.rows[0].id as string;
}
async function journal(client: PoolClient, args: { number:string; date:string; description:string; sourceType:string; sourceId:string; lines:{code:string;debit:number;credit:number;description?:string}[]; actorId:string }) {
  const debit=args.lines.reduce((s,l)=>s+l.debit,0), credit=args.lines.reduce((s,l)=>s+l.credit,0);
  if (Math.abs(debit-credit)>0.00005) throw new Error("Unbalanced journal entry.");
  const entry=await client.query(
    `INSERT INTO journal_entries(entry_number,entry_date,description,source_type,source_id,status,posted_at,posted_by)
     VALUES($1,$2,$3,$4,$5,'posted',now(),$6) RETURNING id`,
    [args.number,args.date,args.description,args.sourceType,args.sourceId,args.actorId]
  );
  for(const line of args.lines) await client.query(
    `INSERT INTO journal_lines(journal_entry_id,account_id,debit,credit,description)
     VALUES($1,$2,$3,$4,$5)`,
    [entry.rows[0].id,await account(client,line.code),amount(line.debit),amount(line.credit),line.description??null]
  );
  return entry.rows[0].id as string;
}

export async function finalizeSale(client: PoolClient, saleId: string, actorId: string) {
  const saleResult=await client.query("SELECT * FROM sales WHERE id=$1 FOR UPDATE",[saleId]);
  if(!saleResult.rowCount) throw new Error("Sale not found.");
  const sale=saleResult.rows[0];
  if(sale.status==="posted") return {saleId,status:"posted"};
  if(sale.status!=="draft") throw new Error("Only draft sales can be finalized.");
  const payments=await client.query("SELECT method,amount,status FROM sale_payments WHERE sale_id=$1 FOR UPDATE",[saleId]);
  if(!payments.rowCount || payments.rows.some(p=>!["confirmed","settled"].includes(p.status))) throw new Error("All payment methods must be verified before stock is deducted.");
  const totalPaid=payments.rows.reduce((s,p)=>s+money(p.amount),0);
  if(Math.abs(totalPaid-money(sale.total_amount))>0.00005) throw new Error("Verified payments do not equal the sale total.");

  const lines=await client.query("SELECT * FROM sale_lines WHERE sale_id=$1 ORDER BY product_id,id FOR UPDATE",[saleId]);
  let cogs=0;
  for(const line of lines.rows){
    const product=await client.query("SELECT tracks_expiry FROM products WHERE id=$1 AND is_active=true",[line.product_id]);
    if(!product.rowCount) throw new Error("A product in this sale is no longer active.");
    const batches=await client.query(
      `SELECT id,remaining_quantity::text,expiry_date,received_at,acquisition_unit_cost::text
         FROM inventory_batches WHERE product_id=$1 AND remaining_quantity>0
          AND (expiry_date IS NULL OR expiry_date >= CURRENT_DATE)
        ORDER BY (expiry_date IS NULL),expiry_date,received_at,id FOR UPDATE`,
      [line.product_id]
    );
    let remaining=money(line.quantity);
    const allocated:{id:string;qty:number;cost:number}[]=[];
    for(const batch of batches.rows){
      if(remaining<=0.0000001) break;
      const take=Math.min(remaining,money(batch.remaining_quantity));
      allocated.push({id:batch.id,qty:take,cost:money(batch.acquisition_unit_cost)});
      remaining-=take;
    }
    if(remaining>0.0000001) throw new Error(`Insufficient non-expired stock for product ${line.product_id}.`);
    for(const a of allocated){
      await client.query("UPDATE inventory_batches SET remaining_quantity=remaining_quantity-$2 WHERE id=$1",[a.id,amount(a.qty)]);
      await client.query(
        `INSERT INTO sale_line_batch_allocations(sale_line_id,batch_id,quantity) VALUES($1,$2,$3)`,
        [line.id,a.id,amount(a.qty)]
      );
      await client.query(
        `INSERT INTO inventory_movements(product_id,batch_id,movement_type,quantity_delta,unit_cost,source_type,source_id,actor_id)
         VALUES($1,$2,'sale',$3,$4,'sale',$5,$6)`,
        [line.product_id,a.id,amount(-a.qty),amount(a.cost),saleId,actorId]
      );
    }
    const balance=await client.query(
      `UPDATE inventory_balances
           SET quantity_on_hand=quantity_on_hand-$2,
               weighted_average_cost=CASE WHEN quantity_on_hand-$2 <= 0.00005 THEN 0 ELSE weighted_average_cost END,
               updated_at=now()
         WHERE product_id=$1 AND quantity_on_hand >= $2 RETURNING weighted_average_cost::text`,
      [line.product_id,line.quantity]
    );
    if(!balance.rowCount) throw new Error("Inventory balance is insufficient or inconsistent.");
    cogs+=money(line.quantity)*money(line.unit_wac_snapshot);
  }

  const paymentLines:{code:string;debit:number;credit:number}[]=[];
  for(const p of payments.rows){
    const code=p.method==="cash"?"1000":p.method==="cbe"?"1010":p.method==="telebirr"?"1020":"1030";
    paymentLines.push({code,debit:money(p.amount),credit:0});
  }
  const journalLines=[
    ...paymentLines,
    {code:"4000",debit:0,credit:money(sale.subtotal)-money(sale.discount_amount)},
    ...(money(sale.tax_amount)>0?[{code:"2100",debit:0,credit:money(sale.tax_amount)}]:[]),
    {code:"5000",debit:cogs,credit:0},
    {code:"1100",debit:0,credit:cogs}
  ];
  await journal(client,{number:`SAL-${sale.sale_number}`,date:new Date(sale.sold_at).toISOString().slice(0,10),description:`Sale ${sale.sale_number}`,sourceType:"sale",sourceId:saleId,lines:journalLines,actorId});
  await client.query("UPDATE sales SET status='posted' WHERE id=$1",[saleId]);
  return {saleId,status:"posted"};
}

export async function createSale(pool:Pool, input:{actorId:string;cashSessionId:string;lines:CheckoutLine[];payments:Tender[];discountAmount?:string;idempotencyKey:string}) {
  const client=await pool.connect();
  try{
    await client.query("BEGIN"); await client.query("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE");
    const prior=await client.query("SELECT id,status FROM sales WHERE idempotency_key=$1",[input.idempotencyKey]);
    if(prior.rowCount){await client.query("COMMIT");return {saleId:prior.rows[0].id,status:prior.rows[0].status,replayed:true};}
    const session=await client.query("SELECT id FROM cash_sessions WHERE id=$1 AND cashier_id=$2 AND status='open' FOR UPDATE",[input.cashSessionId,input.actorId]);
    if(!session.rowCount) throw new Error("Open cash drawer not found for this cashier.");
    if(!input.lines.length||!input.payments.length) throw new Error("At least one item and one payment are required.");
    if(input.payments.some(p=>money(p.amount)<=0)) throw new Error("Every split payment must be greater than zero.");
    const paymentTotal=input.payments.reduce((s,p)=>s+money(p.amount),0);
    let subtotal=0,discount=0,tax=0;
    const normalized=[];
    for(const item of input.lines){
      const p=await client.query(
        `SELECT p.id,pp.selling_price::text,b.weighted_average_cost::text
           FROM products p JOIN inventory_balances b ON b.product_id=p.id
           JOIN LATERAL(SELECT selling_price FROM product_prices WHERE product_id=p.id AND effective_from<=now() AND (effective_to IS NULL OR effective_to>now()) ORDER BY effective_from DESC LIMIT 1) pp ON true
          WHERE p.id=$1 AND p.is_active=true FOR UPDATE OF p,b`,[item.productId]);
      if(!p.rowCount) throw new Error("Product unavailable or has no active selling price.");
      const qty=money(item.quantity),price=money(p.rows[0].selling_price),lineDiscount=money(item.discountAmount??"0");
      if(qty<=0||lineDiscount<0||lineDiscount>qty*price) throw new Error("Invalid item quantity or discount.");
      const net=qty*price-lineDiscount;
      let lineTax=0;
      if(item.taxRateId){
        const rate=await client.query("SELECT rate::text FROM tax_rates WHERE id=$1 AND effective_from<=CURRENT_DATE AND (effective_to IS NULL OR effective_to>CURRENT_DATE)",[item.taxRateId]);
        if(!rate.rowCount) throw new Error("Selected tax rate is not active.");
        lineTax=Number((net*money(rate.rows[0].rate)).toFixed(4));
      }
      subtotal+=qty*price; discount+=lineDiscount; tax+=lineTax;
      normalized.push({productId:item.productId,quantity:amount(qty),unitPrice:amount(price),discount:amount(lineDiscount),tax:amount(lineTax),net:amount(net+lineTax),wac:amount(money(p.rows[0].weighted_average_cost))});
    }
    const total=subtotal-discount+tax;
    if(Math.abs(paymentTotal-total)>0.00005) throw new Error("Split payments must equal the exact sale total.");
    const saleNumber=`M-${Date.now()}-${Math.floor(Math.random()*900+100)}`;
    const sale=await client.query(
      `INSERT INTO sales(sale_number,cash_session_id,cashier_id,subtotal,discount_amount,tax_amount,total_amount,status,idempotency_key)
       VALUES($1,$2,$3,$4,$5,$6,$7,'draft',$8) RETURNING id,sold_at`,
      [saleNumber,input.cashSessionId,input.actorId,amount(subtotal),amount(discount),amount(tax),amount(total),input.idempotencyKey]);
    for(const line of normalized) await client.query(
      `INSERT INTO sale_lines(sale_id,product_id,quantity,unit_price,discount_amount,tax_amount,line_total,unit_wac_snapshot)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [sale.rows[0].id,line.productId,line.quantity,line.unitPrice,line.discount,line.tax,line.net,line.wac]);
    const paymentIds:string[]=[];
    for(const payment of input.payments){
      const status=payment.method==="cash"?"confirmed":"pending";
      const paymentRow=await client.query(
        `INSERT INTO sale_payments(sale_id,method,amount,status,provider_reference,verified_by,verified_at)
         VALUES($1,$2,$3,$4,$5,$6,CASE WHEN $4='confirmed' THEN now() ELSE NULL END) RETURNING id`,
        [sale.rows[0].id,payment.method,amount(money(payment.amount)),status,payment.providerReference??null,status==="confirmed"?input.actorId:null]);
      paymentIds.push(paymentRow.rows[0].id);
    }
    const pending=input.payments.some(p=>p.method!=="cash");
    if(!pending) await finalizeSale(client,sale.rows[0].id,input.actorId);
    await client.query("INSERT INTO audit_log(actor_id,action,entity_type,entity_id,after_data) VALUES($1,'create','sale',$2,$3::jsonb)",[input.actorId,sale.rows[0].id,JSON.stringify({saleNumber,total:amount(total),paymentCount:input.payments.length})]);
    await client.query("COMMIT");
    return {saleId:sale.rows[0].id,saleNumber,total:amount(total),status:pending?"awaiting_payment":"posted",pendingPaymentIds:pending?paymentIds.filter((_,i)=>input.payments[i].method!=="cash"):[],receiptUrl:`/api/sales/${sale.rows[0].id}/receipt`};
  }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
}
