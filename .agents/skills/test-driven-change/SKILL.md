---
name: test-driven-change
description: Implement Melat changes using executable acceptance criteria and regression tests.
---

# Test-driven change

1. Inspect existing tests and reproduce the behavior or defect.
2. Add a focused failing test for the required behavior before changing implementation where practical.
3. Implement the smallest change that makes the test pass.
4. Add edge and failure-path tests, including idempotency and concurrency when relevant.
5. For money, inventory, purchasing, payments, refunds or accounting, prefer PostgreSQL integration tests that exercise transactions and constraints.
6. Run the focused test, then the full relevant suite and build.
7. Report exact commands and results. Never describe an unrun test as passing.

A green test suite proves only the assertions it contains. State meaningful coverage gaps.
