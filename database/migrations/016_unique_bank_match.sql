BEGIN;
CREATE UNIQUE INDEX IF NOT EXISTS bank_statement_source_match_once
  ON bank_statement_lines(matched_source_type,matched_source_id)
  WHERE matched_source_id IS NOT NULL;
INSERT INTO schema_migrations(version,description)
VALUES('016','Prevent matching one ledger transaction to multiple statement lines')
ON CONFLICT(version) DO NOTHING;
COMMIT;
