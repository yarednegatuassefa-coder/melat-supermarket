# Database migrations

Migrations are ordered, append-only SQL files. The initial migration targets a new empty PostgreSQL database.

## Applying migrations

1. Take and verify a backup before any production migration.
2. Connect to the intended database using the dedicated application role.
3. Review the migration SQL.
4. Apply one migration in a transaction using psql or a controlled migration runner.
5. Verify the `schema_migrations` version and inspect the resulting schema.
6. Never edit an applied migration; add a new numbered migration for changes.

The initial migration creates core entities and constraints. Cross-row invariants (balanced journals, tender totals, stock ledger/projection consistency, WAC recalculation, FEFO allocation, supplier payment allocation totals) must be enforced in transactional domain services and supplemented by deferred constraint triggers where appropriate. A plain row-level CHECK cannot safely enforce aggregate totals across multiple rows.

Do not apply this migration to the existing `command` database. It is intended for the dedicated `melat` database only.
