import test from "node:test";
import assert from "node:assert/strict";
import { assertBalancedJournal, fromMinorUnits, sumAmounts, toMinorUnits } from "./money.js";
import { calculateExpectedDrawer } from "./cash.js";

test("money conversion preserves four decimal places exactly", () => {
  assert.equal(toMinorUnits("12.3456"), 123456n);
  assert.equal(fromMinorUnits(123456n), "12.3456");
  assert.equal(sumAmounts(["0.10", "0.20", "1.005"]), "1.3050");
});

test("money parser rejects invalid precision and malformed values", () => {
  assert.throws(() => toMinorUnits("1.00001"), /Invalid monetary amount/);
  assert.throws(() => toMinorUnits("NaN"), /Invalid monetary amount/);
});

test("journal validation accepts balanced entries", () => {
  assert.doesNotThrow(() => assertBalancedJournal([
    { debit: "125.50", credit: "0" },
    { debit: "0", credit: "125.5000" }
  ]));
});

test("journal validation rejects unbalanced entries and invalid lines", () => {
  assert.throws(() => assertBalancedJournal([
    { debit: "10", credit: "0" },
    { debit: "0", credit: "9.99" }
  ]), /Unbalanced journal/);
  assert.throws(() => assertBalancedJournal([
    { debit: "10", credit: "10" },
    { debit: "0", credit: "20" }
  ]), /Each journal line/);
});

test("cash drawer uses cash movements only and applies deductions", () => {
  assert.equal(calculateExpectedDrawer({
    openingCash: "500",
    cashReceived: "1200.50",
    cashRefunds: "50",
    cashExpenses: "25.50",
    withdrawals: "100",
    bankDeposits: "300"
  }), "1225.0000");
});

test("cash drawer rejects a negative expected balance", () => {
  assert.throws(() => calculateExpectedDrawer({
    openingCash: "0",
    cashReceived: "10",
    cashRefunds: "0",
    cashExpenses: "0",
    withdrawals: "0",
    bankDeposits: "20"
  }), /cannot be negative/);
});
