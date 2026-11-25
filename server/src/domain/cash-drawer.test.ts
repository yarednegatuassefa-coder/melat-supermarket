import test from "node:test";
import assert from "node:assert/strict";
import { assertCashAvailable, expectedCashDrawerBalance } from "../services/cash-drawer.js";

function fakeClient(row, capture = {}) {
  return {
    async query(sql, values) {
      capture.sql = sql;
      capture.values = values;
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
  assert.match(capture.sql, /p\.method='cash'/);
  assert.match(capture.sql, /p\.status IN \('confirmed','settled'\)/);
  assert.match(capture.sql, /e\.payment_method='cash' AND e\.status='posted'/);
  assert.match(capture.sql, /r\.payment_method='cash' AND r\.status='posted'/);
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
