---
name: security-audit
description: Perform a staged, evidence-based source security audit of Melat without unsafe execution.
---

# Security audit

## Scope and safety
Establish repository scope and trust boundaries first. Never run repository-controlled scripts, install untrusted dependencies or execute target code unless an OS-enforced sandbox with restricted filesystem, network and credentials is available. Without that sandbox, conduct source-only review and clearly state the limitation.

## Audit stages
1. Map entry points, routes, roles, data stores, secrets, external integrations and deployment surfaces.
2. Trace untrusted inputs to SQL, filesystem, process, template, network and authorization sinks.
3. Review authentication, session lifecycle, password storage, privileged actions, role enforcement and rate limiting.
4. Review data exposure, logs, backups, environment variables, CORS, headers and dependency posture.
5. Independently re-check each candidate finding against the exact source and call path.
6. Produce a prioritized report with evidence, exploit preconditions, impact, confidence and remediation.

## Melat-specific focus
- Cashier, inventory clerk, manager and owner privilege boundaries.
- Protection of sales, stock, supplier, finance and audit records.
- Session theft/fixation, login abuse, password reset and MFA enrollment.
- SQL injection, IDOR/BOLA, mass assignment and insecure direct API calls.
- Secrets in git history, logs, CI artifacts and deployment configuration.
- Backup encryption, restore isolation and LAN exposure.
- Race conditions that could alter stock or post money twice.

Do not claim penetration testing or runtime validation from static source inspection. Do not make production changes during an audit.
