# Query-to-page drift

Status: implemented and locally verified. User-authorised on 16 October 2026 after the missing-ID log cleanup.

## Authorised cleanup

The seven remaining missing IDs in the connected personal instance were repaired before feature work. A private SQLite backup and repair manifest were saved first. One transaction assigned IDs only, verified all other fields unchanged, and preserved the existing record count. MCP readback confirmed 11 records with 11 unique IDs and none missing. No records were merged, no snapshot identity was adopted, and no other instance was modified. Private log content/backups remain outside Git.

## Scope and placement

- New additive MCP tool `find_query_page_drift` and CLI command `query-page-drift`, with optional exact `query`, comparison window (7/30/60/90), bounded result/page limits and explicit refresh.
- GSC adapter: extend existing `queryPageRows` with an optional exact-query filter while preserving its current two-argument behaviour and row-cap pagination. No new integration, model call, analytics query or website mutation.
- Shared pure analysis groups exact queries by the existing host-aware page key. It compares observed page sets and unique highest-impression landing pages. A tie never becomes an arbitrary leader switch. Missing-period observations stay unavailable rather than invented zeroes.
- Discovery returns only observed changes supported by rows in both periods, sorted deterministically by observed impression volume. A selected query can also return unchanged or insufficient-comparison evidence. No semantic query grouping or cannibalization diagnosis.
- New service orchestration fetches the two GSC query/page datasets without fetching analytics. A bounded in-process cache uses the established configuration fingerprint and periods; explicit refresh and profile refresh invalidate that scope. No database schema change or historical query backfill.
- Responses include instance/site/provider context, GSC source semantics, periods/fetch times, per-period cap flags, excluded out-of-scope row counts, totals and page-output truncation. All new MCP/CLI query text uses the shared sanitizer.
- The client can record an interpretation in the existing change log when authorised; the new read tool does not automatically create actions, infer effects or recommend edits.

## Acceptance

1. A query observed on different leading pages in two periods produces inspectable raw metrics and a descriptive change flag; stable observations, tied leaders and one-period-only rows are handled honestly.
2. Exact-query semantics, root/www aliases, distinct subdomains, meaningful query values, duplicate metric aggregation and output caps are tested.
3. Selected-query requests filter at GSC before the cap. Failure in either period remains visible; cached evidence retains its fetch time; refresh and configuration changes cannot reuse a wrong dataset.
4. Representative GA4, Matomo, Engage and none configurations use the same GSC-only calculation without analytics calls. Existing CLI/MCP tools and schemas remain compatible.
5. Adapter, pure analysis, service/cache, CLI and sanitizer contract tests pass, followed by build and the full suite. Update the backlog and user documentation; report live verification separately.

No new dependencies or automatic deployment/profile changes. Initial validation uses synthetic evidence; a running client must reconnect to expose the added tool.

## Verification completed

- Cleanup: private SQLite backup passed `quick_check`, contained the expected 11 pre-cleanup records with seven missing IDs, and has mode 0600. Original fields were transactionally compared unchanged; MCP readback confirms 11 unique IDs and no missing IDs.
- Targeted adapter/analysis/service/CLI/MCP/cache suite: 58 tests passed after fixing a test-list syntax typo.
- `npm run build` and complete `npm test`: 196 tests across 18 files passed on Node 24.13.1.
- An isolated built stdio MCP process completed initialization, listed all 22 tools including the new tool, exposed its bounded schema and rejected invalid input without provider calls. It used a synthetic profile, not a private live profile.
- Existing public tool inputs remain unchanged. The new tool, CLI command and `queryPageCache` metadata are additive. Existing untracked architecture files were updated locally and remain outside the implementation commit.
- No live GSC query/page-drift result has been verified in this implementation; running MCP clients need reconnecting to expose the added tool. Hosted CI is checked after push separately.
- No new dependencies, schema changes, automatic site changes or analytics calls. The only private database modification was the explicitly authorised seven-ID repair.
