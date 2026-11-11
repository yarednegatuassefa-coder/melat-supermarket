const SCALE = 10_000n;
const DECIMAL_AMOUNT = /^-?\d+(?:\.\d{1,4})?$/;

/** Parse a decimal amount into exact 1/10,000 ETB units. Never uses binary floating point. */
export function toMinorUnits(value: string): bigint {
  const normalized = value.trim();
  if (!DECIMAL_AMOUNT.test(normalized)) {
    throw new Error(`Invalid monetary amount: ${value}`);
  }
  const negative = normalized.startsWith("-");
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [whole, fraction = ""] = unsigned.split(".");
  const units = BigInt(whole) * SCALE + BigInt(fraction.padEnd(4, "0"));
  return negative ? -units : units;
}

export function fromMinorUnits(value: bigint): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const whole = absolute / SCALE;
  const fraction = (absolute % SCALE).toString().padStart(4, "0");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

export function sumAmounts(values: string[]): string {
  return fromMinorUnits(values.reduce((total, value) => total + toMinorUnits(value), 0n));
}

export function assertBalancedJournal(lines: Array<{ debit: string; credit: string }>): void {
  if (lines.length < 2) throw new Error("A journal entry requires at least two lines.");
  let debits = 0n;
  let credits = 0n;
  for (const line of lines) {
    const debit = toMinorUnits(line.debit);
    const credit = toMinorUnits(line.credit);
    if (debit < 0n || credit < 0n || (debit > 0n) === (credit > 0n)) {
      throw new Error("Each journal line must contain either a positive debit or a positive credit, not both.");
    }
    debits += debit;
    credits += credit;
  }
  if (debits !== credits) {
    throw new Error(`Unbalanced journal: debits ${fromMinorUnits(debits)} do not equal credits ${fromMinorUnits(credits)}.`);
  }
}
