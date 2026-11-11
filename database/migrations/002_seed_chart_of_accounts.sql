-- Baseline chart of accounts. Tax rates are intentionally not seeded.
-- Account codes are internal defaults and must be reviewed with Melat accountant.

BEGIN;

INSERT INTO chart_of_accounts(account_code, name_en, name_am, account_type) VALUES
('1000','Cash on hand','በእጅ ያለ ገንዘብ','asset'),
('1010','Commercial bank / CBE','ባንክ / ሲቢኢ','asset'),
('1020','Telebirr clearing','ቴሌብር ማጣሪያ','asset'),
('1030','Card settlement clearing','የካርድ ክፍያ ማጣሪያ','asset'),
('1100','Inventory','እቃ ክምችት','asset'),
('1200','Recoverable input tax','የሚመለስ የግብር መጠን','asset'),
('2000','Accounts payable','የአቅራቢ ዕዳ','liability'),
('2010','Goods received not invoiced','የተቀበሉ ግን ያልተከፈሉ ዕቃዎች','liability'),
('2100','Output tax payable','የሚከፈል የግብር መጠን','liability'),
('3000','Owner capital','የባለቤት ካፒታል','equity'),
('4000','Sales revenue','የሽያጭ ገቢ','revenue'),
('4010','Sales discounts','የሽያጭ ቅናሽ','expense'),
('5000','Cost of goods sold','የተሸጡ ዕቃዎች ወጪ','expense'),
('5100','Inventory adjustments and write-offs','የእቃ ማስተካከያ እና ብክነት','expense'),
('6000','Operating expenses','የሥራ ማስኬጃ ወጪዎች','expense')
ON CONFLICT (account_code) DO NOTHING;

INSERT INTO schema_migrations(version, description)
VALUES ('002', 'Seed baseline chart of accounts')
ON CONFLICT (version) DO NOTHING;

COMMIT;
