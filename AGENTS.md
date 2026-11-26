# Melat agent operating instructions

## Mission
Build a dependable, auditable, single-store retail system for Melat Supermarket in Addis Ababa. Optimize for correct money, stock and operational records—not code volume or visual polish.

## Source of truth
Before changing code, read the relevant parts of:
- `docs/v1-requirements.md`
- `docs/business-rules.md`
- `docs/architecture.md`
- `docs/acceptance-plan.md`
- `docs/engineering-standards.md`

Existing code and migrations are authoritative for current implementation; documented requirements are authoritative for intended behavior. If they conflict, stop and report the conflict rather than silently choosing.

## Non-negotiable business invariants
- Currency is ETB. Store money in exact decimal/minor-unit representations; never use binary floating-point for monetary calculations.
- Every posted journal entry balances (total debits = total credits).
- Purchase orders do not change stock. Goods receipts change stock once. Supplier invoices establish liabilities; they must not receive stock a second time.
- Perpetual weighted-average cost (WAC) is the financial valuation method. FEFO is the physical batch-picking rule where expiry applies. Preserve batch acquisition costs and snapshot cost at sale.
- A sale is not complete until the full amount is confirmed as paid. Pending CBE, Telebirr or card tenders are not settled cash and must not be represented as received funds.
- Split tender allocations must equal the sale total. Posting must be idempotent.
- Refunds reference the original sale, cannot exceed the refundable amount and reverse the appropriate tax, revenue and cost. Inspect returned goods before restocking.
- Cash drawer expected balance = opening cash + cash received − cash refunds − cash expenses − withdrawals − bank deposits.
- Inventory movements and their authoritative stock projection must be updated atomically and remain traceable.
- Tax treatment is configurable and must be confirmed by the accountant; never hardcode a universal VAT rate.
- Customer credit, receivables, loyalty, multi-branch, AI financial decisions and unapproved enterprise scope are excluded from V1.

## Harness lifecycle
Before substantial work, read `harness/README.md`, `harness/feature-list.json` and the latest `harness/progress.md` entry. Run `npm run harness:check` before project tests. Keep store acceptance evidence separate from CI results.

## Required task protocol
1. Inspect the repository and relevant tests before proposing a change.
2. Write a short task spec: objective, business reason, constraints, out-of-scope items, acceptance criteria and verification command(s).
3. Identify data migration, security, accounting, concurrency and rollback risks before implementation.
4. Make the smallest coherent change. Do not refactor unrelated code or expand scope without an explicit reason.
5. Add or update tests before/with implementation. Financial, inventory, auth and permission changes require PostgreSQL integration coverage where practical—not only mocks.
6. Run the relevant tests, then `npm test` and `npm run build` for meaningful application changes. Run the Windows package validation workflow when changing installer/package files.
7. Request an independent review in a fresh context. The reviewer should focus on correctness, security, data integrity and regressions, not style. Resolve or explicitly document every material finding.
8. Report changed files, commit/PR, commands run, pass/fail evidence, known gaps and anything not verified.

## Hard boundaries
- Never run migrations against a production database or any database not explicitly identified as disposable/test without human approval.
- Never deploy to production, change production secrets, delete data, force-push, rewrite history or run destructive database commands autonomously.
- Never add real credentials, personal/customer data, database dumps or payment credentials to the repository.
- Do not claim a feature, security control, backup, restore, deployment or acceptance test works unless it was actually exercised and evidence is available.
- If no OS-enforced sandbox is available, do source-only security review; do not execute untrusted repository-controlled code as part of the audit.
- Keep production readiness separate from CI green status. Human acceptance and store-machine verification remain required.

## Verification commands
From repository root:
- `npm test` — domain and PostgreSQL integration tests (requires test DB configuration used by CI).
- `npm run build` — API and client production builds.
- GitHub Actions `Melat CI` — authoritative hosted PostgreSQL test/build and Windows bundle validation.

If a command cannot run in the current environment, state that plainly. Never substitute an assumed pass.

## Shared skills and portfolio standards
Home is the portfolio coordination repository, not a source-code monorepo. Its shared skills and standards are available at:
- [Home repository guide](https://github.com/yarednegatuassefa-coder/home/blob/main/README.md)
- [Home agent instructions](https://github.com/yarednegatuassefa-coder/home/blob/main/AGENTS.md)
- [Shared skill catalog and routing](https://github.com/yarednegatuassefa-coder/home/blob/main/skills/README.md)
- [Portfolio map and instruction precedence](https://github.com/yarednegatuassefa-coder/home/blob/main/architecture/portfolio-map.md)

For a task that matches a specialized workflow, consult the Home catalog and read the relevant skill and integration guidance. Examples: substantial UI/UX work or demos → portfolio design research and the matching design/demo skill; schema, data-model, or migration work → portfolio database architecture; an explicitly requested security audit → portfolio security-audit guidance and its upstream audit workflow; SEO/GEO → portfolio SEO; mapping → portfolio geospatial; documentation/code review/project planning/social content → the matching Home skill; research-led media or video → Research-to-Video, Animated Shorts, or Motion Studio only when that deliverable is requested. The Home catalog is the source of truth for the full, current collection.

Use only the skill or skills relevant to the requested deliverable; do not chain or execute every skill just because it is available. Melat's business invariants, task protocol, and repository-specific rules take precedence. Preserve the existing `.agents/skills/` files; Home skills supplement them and must not replace or duplicate them.

Skill availability does not authorize tool/dependency installation, paid API or model use, external account connections, production-data access, migrations, deployment, or publication. Obtain separate explicit authorization before any such cost-incurring or externally consequential action. Never expose real customer, employee, supplier, inventory, payment, accounting, or transaction data to external tools or agents.


## Workflow quality and evaluation
Follow the portfolio [Workflow Quality and Evaluation Standard](https://github.com/yarednegatuassefa-coder/home/blob/main/standards/workflow-quality.md) and this repository's [workflow governance plan](docs/workflow-governance.md) for repeated or agent-assisted workflows. Preserve exact ETB arithmetic, balanced journals, atomic stock movements, payment settlement state, auditability and store acceptance gates. AI must not post financial or inventory changes or make financial decisions. Keep telemetry and external data exposure disabled unless separately approved.

## Code-mode agent architecture
For any AI/tool orchestration task, consult the portfolio [Code-Mode Agent Engineering Standard](https://github.com/yarednegatuassefa-coder/home/blob/main/standards/code-mode-agent-engineering.md), [Portfolio Code-Mode skill](https://github.com/yarednegatuassefa-coder/home/blob/main/skills/portfolio-code-mode/SKILL.md), and this repository's `docs/agent-code-mode.md`. This guidance does not grant production access, external model use, patient/customer data transfer, writes, deployment or other approvals. Project-specific safeguards above remain authoritative.


## Emil Kowalski design-engineering skills

For interface and interaction work, use the upstream [Emil Kowalski skills](https://github.com/emilkowalski/skills) through the shared Home skill installation. The Home catalog is the portfolio routing reference: https://github.com/yarednegatuassefa-coder/home/blob/main/skills/README.md.

Apply only the skill that matches the task; do not invoke the entire collection by default. This is an operational POS and inventory/accounting interface. Prioritize speed, scanability, dense-data legibility, keyboard/touch efficiency, and reliable error prevention. Keep cashier workflows immediate; avoid decorative animation in POS, payment, stock, reconciliation, and accounting flows. Never compromise financial or inventory invariants for visual effects.

- **Design baseline:** consult `emil-design-eng` for relevant UI/animation decisions; preserve the product's existing design tokens and component conventions.
- **Build motion:** use `animate` for requested motion, `choreograph` for coordinated sequences, and `gestures` / `animate-expo` only when the product actually has gesture or Expo-native interactions.
- **Audit and repair:** use `review-animations` for changed motion, `improve-animations` for a codebase-wide motion audit and plans, `animation-performance` for dropped frames, and `remove-animations` when motion is unnecessary.
- **Responsive/mobile QA:** use `mobile-native` for mobile-web behavior and `break-ui` for worst-case content and layout stress tests.
- **Architecture and exploration:** use `pick-ui-library` before adding a UI dependency; use `prototype` when comparing interaction concepts; use `apple-design` only when its platform principles fit the product.
- **Learning and routing:** use `ask-emil` when the right design skill or sequence is unclear; use `learn-taste` at the end of a design session to capture approved corrections as durable project rules. Use `ask-sonner` only if this project uses Sonner.

**Quality gates:** motion must have a user-facing purpose, respect frequency and performance budgets, support `prefers-reduced-motion`, and avoid animating high-frequency or information-dense workflows. Prefer no animation over decorative motion. Keep keyboard and primary operational flows immediate. Reuse existing tokens and dependencies; do not add a library or alter the visual system without task scope and approval. Validate desktop/mobile, keyboard/focus, reduced-motion, loading/empty/error states, and long/unusual content as applicable.

These skills do not override this repository's domain, security, privacy, accessibility, financial, clinical, or release safeguards. Skill availability is not authorization to install dependencies, call paid services, access production data, publish, or deploy.
