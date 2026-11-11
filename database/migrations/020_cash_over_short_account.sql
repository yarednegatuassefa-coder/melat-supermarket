BEGIN;
INSERT INTO chart_of_accounts(account_code,name_en,name_am,account_type)
VALUES('5200','Cash over and short','የገንዘብ እጥረት ወይም ትርፍ','expense')
ON CONFLICT(account_code) DO NOTHING;
INSERT INTO schema_migrations(version,description)
VALUES('020','Add cash over and short account for drawer close variances')
ON CONFLICT(version) DO NOTHING;
COMMIT;
