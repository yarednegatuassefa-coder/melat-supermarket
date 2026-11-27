# WebMCP adoption — Melat Supermarket

## Scope
The authenticated product-creation form is annotated for assisted drafting of a product record. It is not an inventory query or stock-adjustment tool. `toolautosubmit` is deliberately omitted; an authorized staff member must review and submit.

## Controls
Keep the existing owner/role authorization, API validation, audit trail, and product uniqueness rules. Never expose staff login, password change, staff creation, stock movement, purchasing, cash, or finance forms as agent-autosubmit tools.

## Test
Verify role access, product validation, duplicate SKU/barcode handling, and that agent population does not submit or bypass server-side checks.
