# demo-repo

A compact full-stack sample project for architecture and risk-audit demos.

This repo is intentionally small enough for a quick inspection, but realistic enough to surface meaningful findings around API design, configuration, data access, and background work.

## What It Is

An order-operations app with:

- an Express API
- a small React dashboard
- a background payment reconciliation job
- a simple Postgres access layer

## Main Entry Points

- `src/server.ts`: API bootstrap and middleware wiring
- `src/routes/orders.ts`: order search and order creation endpoints
- `src/routes/admin.ts`: admin-only operational endpoints
- `src/jobs/reconcile-payments.ts`: background reconciliation path
- `web/src/main.tsx`: dashboard entry point

## Suggested Audit Prompt

Inspect the `demo-repo` directory in the current workspace, identify the main entry points and risky areas, and return a structured audit with priorities and next steps.

## Notes

- This repo is for inspection and demo use.
- It is intentionally imperfect so an audit has real issues to find.
- If you want to run it separately, install dependencies inside `demo-repo` first.
