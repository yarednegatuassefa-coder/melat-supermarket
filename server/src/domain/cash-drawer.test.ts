import test from "node:test";
import assert from "node:assert/strict";
import { assertCashAvailable, expectedCashDrawerBalance } from "../services/cash-drawer.js";

type CashAggregate = { opening_cash: string; cash_sales: string; cash_expenses: string; cash_refunds: string; drawer_movements: string };

function fakeClient(row: CashAggregate, capture: { sql?: string } = {}) {
  return {
    async query(sql: string) {
      capture.sql = sql;
      return { rows: [row], rowCount: 1 };
    },
  } as never;
}

const exactBalance = {
  opening_cash: "100.0001",
  cash_sales: "0.2002",
  cash_expenses: "0.1001",
  cash_refunds: "0.0001",
  drawer_movements: "0.0000",
};

test("cash drawer aggregates return an exact four-decimal ETB balance", async () => {
  const capture: { sql: string } = { sql: "" };
  const actual = await expectedCashDrawerBalance(fakeClient(exactBalance, capture), "session-1");

  assert.equal(actual, "100.1001");
  const query = capture.sql ?? "";
  assert.match(query, /p\.method='cash'/);
  assert.match(query, /p\.status IN \('confirmed','settled'\)/);
  assert.match(query, /e\.payment_method='cash' AND e\.status='posted'/);
  assert.match(query, /r\.payment_method='cash' AND r\.status='posted'/);
});

test("cash availability accepts an exact match without floating-point tolerance", async () => {
  await assert.doesNotReject(() =>
    assertCashAvailable(fakeClient(exactBalance), "session-1", "100.1001"),
  );
});

test("cash availability rejects a request one 0.0001 ETB unit above the drawer", async () => {
  await assert.rejects(
    () => assertCashAvailable(fakeClient(exactBalance), "session-1", "100.1002"),
    /Insufficient cash in drawer/,
  );
});

test("cash availability rejects a negative expected drawer balance", async () => {
  await assert.rejects(
    () => assertCashAvailable(fakeClient({
      opening_cash: "1.0000",
      cash_sales: "0.0000",
      cash_expenses: "0.0000",
      cash_refunds: "1.0001",
      drawer_movements: "0.0000",
    }), "session-1", "0.0001"),
    /Expected cash is already negative/,
  );
});

test("cash availability rejects malformed or non-positive amounts", async () => {
  await assert.rejects(
    () => assertCashAvailable(fakeClient(exactBalance), "session-1", "0"),
    /must be positive/,
  );
  await assert.rejects(
    () => assertCashAvailable(fakeClient(exactBalance), "session-1", "1.00001"),
    /Invalid monetary amount/,
  );
});
