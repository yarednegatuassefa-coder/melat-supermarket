# Store-floor POS usability and hardware acceptance

## Purpose

Validate the Melat POS on the actual cashier workstation before staff use it for live sales. Browser screenshots and a green CI run cannot establish that the till is fast, legible, reliable, or compatible with the store's scanner and receipt printer.

This is an acceptance runbook, not authorization to use production money or inventory.

## Preconditions

- Use a disposable PostgreSQL test database created from the current migrations.
- Use test products, test batches, test staff accounts and synthetic payment references only.
- Confirm the workstation's browser, screen resolution, scaling, keyboard layout, barcode scanner model and receipt-printer model.
- Connect the cashier workstation to the local store LAN and confirm the API health check.
- Verify the test database is isolated from any live store database before beginning.
- Have the store owner and the cashier who will use the till present for the physical workflow review.

**Stop immediately** if the database target is uncertain, a test action appears to affect live stock or money, or a device behaves differently from the expected test setup.

## Hardware and environment record

Record before testing:

| Item | Record |
|---|---|
| Workstation make/model | |
| Operating system and version | |
| Browser and version | |
| Display resolution and scaling | |
| Primary input method | Keyboard / mouse / touch |
| Barcode scanner make/model | |
| Scanner connection mode | USB HID / serial / other |
| Receipt printer make/model | |
| Printer connection | USB / LAN / other |
| Paper width | |
| Local API host and health result | |
| Test database identifier | |

Do not record passwords, payment credentials, or customer information in this sheet.

## Critical cashier workflows

### 1. Sign-in and session

- [ ] Cashier can sign in using a test cashier account.
- [ ] Initial-password change is enforced where applicable.
- [ ] Cashier cannot access owner-only staff management or manager-only finance actions.
- [ ] Session expiry or sign-out returns to the login screen without exposing protected data.
- [ ] Refreshing the browser does not silently create a second session or duplicate a transaction.

### 2. Product lookup and cart

- [ ] Search by full product name, partial name and SKU.
- [ ] Scan a known test barcode and confirm the correct product is selected.
- [ ] Unknown barcode produces a clear, recoverable message.
- [ ] Search remains usable with the scanner in keyboard-wedge mode.
- [ ] Add multiple products, change quantities, remove a line and recover from an accidental selection.
- [ ] Unavailable or zero-available stock cannot be sold.
- [ ] Product names, quantities, ETB prices and totals are legible at the actual screen resolution.
- [ ] Cashier can complete the normal sale without needing to use a mouse if keyboard-only operation is part of the store setup.

### 3. Payment and sale posting

- [ ] Cash-only payment completes when tender equals the total due.
- [ ] Split tenders must add up exactly to the sale total.
- [ ] CBE, Telebirr and card payments remain pending until independently verified.
- [ ] A pending electronic tender is not displayed or reported as settled cash.
- [ ] Double-clicking or retrying checkout does not post the same sale twice.
- [ ] Insufficient tender, excess tender, malformed amount and unavailable payment method are rejected with a clear message.
- [ ] A completed sale has one sale record, balanced journal entries and the expected inventory movement in the test database.

### 4. Receipt printing

- [ ] Receipt opens from the completed sale.
- [ ] Printer selection and paper width are correct.
- [ ] Product names, quantities, ETB amounts, tax treatment and totals are readable.
- [ ] Receipt is not clipped at the top, bottom or right edge.
- [ ] Printer unavailable/out of paper produces a recoverable message; it does not repeat the sale posting.
- [ ] Reprinting a receipt does not create a second sale or inventory movement.

### 5. Cash drawer and close

- [ ] Opening cash amount is entered and recorded.
- [ ] Cash sales, cash refunds, expenses, withdrawals and bank deposits affect expected drawer balance according to the documented formula.
- [ ] Non-cash tenders reconcile separately from physical cash.
- [ ] Cashier can enter counted cash and see the resulting variance.
- [ ] Closing a session is blocked or safely handled when required inputs are missing.
- [ ] A closed session cannot be silently edited; corrections remain auditable.

## Physical usability checks

- [ ] Main POS actions are visible without excessive scrolling at the till's normal resolution.
- [ ] Product search and cart remain usable with the actual browser zoom and OS display scaling.
- [ ] Buttons and fields have adequate target size for the actual input method.
- [ ] Focus order follows the cashier's workflow; focus indicators are visible.
- [ ] Validation errors identify the field or action that needs correction.
- [ ] Loading, empty, success and failure states are distinguishable.
- [ ] Long product names, Amharic product names and large quantities do not break the layout.
- [ ] Tables and cart lines remain readable at the workstation's effective viewport width.

## Local-network resilience

Run these checks only against the isolated test environment.

- [ ] POS works when the external internet connection is disconnected but the local server and LAN remain available.
- [ ] If the local API becomes unavailable, the UI clearly reports that checkout cannot proceed.
- [ ] A request interrupted during checkout can be reconciled by checking the test sale record before any retry.
- [ ] Reconnection does not replay queued transactions or create duplicate postings.
- [ ] A workstation cannot reach the local API from an untrusted network segment.

The system must not claim that an offline sale has been saved unless durable local queuing is explicitly implemented and tested. Do not improvise offline transaction handling.

## Financial and inventory reconciliation

For each test sale, compare independent records in the test database:

- [ ] Sale header and line totals equal the receipt.
- [ ] Confirmed tender allocations equal the sale amount due.
- [ ] Pending electronic tenders remain pending and excluded from settled cash.
- [ ] Posted journal debits equal credits.
- [ ] Stock movement equals the sold quantity exactly once.
- [ ] COGS uses the applicable WAC snapshot.
- [ ] FEFO batch selection is correct for expiry-tracked products.
- [ ] Cash drawer expected balance reconciles to the cash movement ledger.

Never use UI totals alone as evidence of accounting correctness.

## Defect severity and sign-off

- **Blocker:** duplicate sale, incorrect money, incorrect stock, unauthorized access, exposed credentials, or inability to establish whether a transaction posted. Do not proceed to live use.
- **High:** scanner/printer failure, unreadable checkout, payment status ambiguity, or a workflow that regularly causes cashier mistakes. Fix and retest before live use.
- **Medium:** friction or layout defects with a reliable workaround. Record owner and target date.
- **Low:** cosmetic issue with no effect on legibility, accuracy or task completion.

Record each defect with: test case, workstation/device, steps, expected result, actual result, screenshot or redacted evidence, severity, owner and retest result.

### Acceptance decision

- [ ] All blocker and high defects resolved and retested.
- [ ] Financial and stock reconciliations passed in the isolated test database.
- [ ] Owner/manager reviewed role permissions and payment handling.
- [ ] Cashier completed the critical workflows without coaching.
- [ ] Store owner approved the physical workstation and peripheral setup.
- [ ] Production release separately authorized by the human owner.

**Release rule:** CI green is necessary but not sufficient. This runbook must be completed on the real store workstation before the POS is treated as operationally accepted.
