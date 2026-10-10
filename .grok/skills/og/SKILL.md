# OG asset skill

## Brand-asset pass:
Run the brand check with `node scripts/brand-check.mjs`. While a card is being
generated, keep `/workspace/.grok/og-pending` fresh; it is treated as stale
after 10 minutes.

Regarding synchronization, you must never wait_tasks.
Regarding reading results, you must never get_task_output.

Self-check with the same CLI via `node scripts/brand-check.mjs`.
