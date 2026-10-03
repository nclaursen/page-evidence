# Product backlog

Code audit: 2026-10-03. Built means implemented, not necessarily loaded by running MCP clients.

## Built — integrated into main

- **Change digest — built.** `get_change_digest` compares page evidence against a saved check-in, with gains, declines, maturity gates and measurement warnings. First use establishes a baseline. Rolling windows are not independent periods and do not establish causality. Implementation: `src/digest.ts`, `src/service.ts`; regression tests: `test/digest-cache.test.ts`.
- **Evidence freshness and refresh controls — built.** Fetch timestamps, age, automatic cache expiry, profile-scoped query caching, `get_cache_status` and `refresh_site_evidence`. Historical snapshots and action records remain intact.
- **Content-change follow-up enhancement — built.** Before/after click and impression deltas, CTR/position changes, other implemented/reviewed same-page changes, and explicit evidence sufficiency. Checks equal-length periods, profile/provider, date boundaries, reporting lag, volume and coverage. Rejects incompatible pinned baselines and never claims causality. Uses stored history only; no automatic backfill or detection of unrecorded/site-wide changes. Implementation: `src/action-review.ts`, `src/service.ts`; tests: `test/history.test.ts`.
- **Seven-day lookback — built.** Optional `windowDays: 7` / `--days=7`, with the configured reporting lag (normally three complete days). Uses the same evidence checks as longer windows, not an automatic downgrade for duration. Existing defaults and the 30/60/90-day lifecycle trend view remain unchanged. Review of a specific edit needs stored complete before/after periods, not just the latest week.

## Rollout — pending client reconnect

- Code from `codex/query-safety-followup` is integrated into `main`. This is not a package publication; running MCP clients still need to reconnect.
- Reconnect the relevant MCP clients to load the new tools; the currently connected clients still expose the older tool list.
- After reconnecting, establish a real digest baseline for the intended profile/window and exercise refresh/review. No live baseline or September 2 impact assessment has been performed in this work.
- Verification: 76 synthetic tests, TypeScript build, and an actual isolated MCP-process smoke test exposing all 19 tools and the weekly review schema passed. Record subsequent live findings before expanding features.

## Ideas — recommended priority after rollout

1. **Query themes — not built.** Group related queries by intent with inspectable examples. Label grouping as interpretation, not measured fact; preserve the untrusted-query boundary. Question-pattern classification and entered/exited query lists are not thematic grouping.
2. **Emerging-query evidence in the digest — not built.** Add bounded query evidence for selected flagged pages, reusing `get_query_entry_exit`. The per-page tool exists; integration into the digest does not. Avoid an automatic site-wide query fetch and distinguish newly observed rows from genuinely new demand.
