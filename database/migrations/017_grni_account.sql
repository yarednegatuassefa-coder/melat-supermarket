BEGIN;
INSERT INTO chart_of_accounts(account_code,name_en,name_am,account_type)
VALUES('2010','Goods received not invoiced','የተቀበሉ ግን ያልተከፈሉ ዕቃዎች','liability')
ON CONFLICT(account_code) DO NOTHING;
INSERT INTO schema_migrations(version,description)
VALUES('017','Add goods received not invoiced liability account')
ON CONFLICT(version) DO NOTHING;
COMMIT;
