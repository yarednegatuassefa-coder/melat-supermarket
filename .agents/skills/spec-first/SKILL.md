---
name: spec-first
description: Turn an ambiguous Melat request into a bounded, testable engineering task before changing code.
---

# Spec first

Before implementation, produce a compact spec with:
- Outcome and business reason.
- Current behavior and affected modules, established by repository inspection.
- Constraints and explicit exclusions.
- Acceptance criteria stated as observable behavior.
- Verification commands and required test layers.
- Data migration, security, accounting, concurrency and rollback risks.

Ask a clarification only when a missing decision changes correctness or business policy. Do not invent tax rules, permissions, payment settlement semantics or store procedures. If requirements conflict, surface the conflict and pause. Save durable decisions in docs; do not create a new document for trivial changes.
