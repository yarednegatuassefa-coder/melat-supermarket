# Database

PostgreSQL schema and ordered migrations live here.

Rules:
- Never edit an already-applied migration; add a new migration.
- Use foreign keys, unique constraints, check constraints and appropriate indexes.
- Store timestamps consistently (UTC in database; render in configured local timezone).
- Use numeric/decimal types for money and quantities; never floating-point for financial values.
- Do not run destructive migrations against real data without a verified backup and explicit approval.
- Do not commit production data or database dumps.
