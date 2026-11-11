import { fromMinorUnits, toMinorUnits } from "./money.js";

export interface CashDrawerInputs {
  openingCash: string;
  cashReceived: string;
  cashRefunds: string;
  cashExpenses: string;
  withdrawals: string;
  bankDeposits: string;
}

/** Expected physical drawer cash; non-cash tenders must not be passed as cashReceived. */
export function calculateExpectedDrawer(input: CashDrawerInputs): string {
  const expected =
    toMinorUnits(input.openingCash) +
    toMinorUnits(input.cashReceived) -
    toMinorUnits(input.cashRefunds) -
    toMinorUnits(input.cashExpenses) -
    toMinorUnits(input.withdrawals) -
    toMinorUnits(input.bankDeposits);

  if (expected < 0n) throw new Error("Expected drawer cash cannot be negative.");
  return fromMinorUnits(expected);
}
