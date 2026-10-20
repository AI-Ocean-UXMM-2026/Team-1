<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Parallel device work

Both device branches start from the same coordination commit. Keep work inside the assigned scope unless the devices coordinate a shared change. Follow `DESIGN.md`, `PRODUCT.md`, and the existing Supabase access model. Add new database migrations instead of editing migrations that have already been applied. Do not commit directly to `main` or force-push a shared branch.

### Device 1 — `codex/device-1-intelligence`

- Intelligent rider and vehicle assignment
- Predictive ETA using traffic and route progress
- Driver-submitted road knowledge

### Device 2 — `codex/device-2-operations-integrations`

- Fuel- and battery-aware routing
- Seller and customer support interfaces
- Vehicle maintenance and delivery-cost analytics
- E-commerce and multi-provider integrations

### Integration ownership

Device 2 owns integration. When Device 1 finishes and pushes its branch, Device 2 fetches it, merges it into `codex/device-2-operations-integrations`, resolves shared schema, type, and workspace conflicts, and opens the final pull request to `main` after the combined work is ready.
