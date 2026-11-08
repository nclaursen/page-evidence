# Branded and non-branded search evidence

Status: complete in this checkout, 2026-11-08. Authorised by the user's request to implement the next backlog item; not published or deployed.

## Scope and placement

Help reviewers determine whether observed query movement extends beyond configured brand/product phrases. Implement deterministic shared matching/aggregation in brand-search.ts; add a query-only, by-property GSC report in google.ts and bounded cached orchestration in service.ts. Add get_brand_search_performance / brand-search interfaces. Existing query/page reports cannot supply site query totals without repeated page observations; no analytics attribution or existing snapshot migration.

Brand variants are explicit per-call brandTerms (at most 50 phrases, 100 characters each) or an optional PAGE_EVIDENCE_BRAND_TERMS JSON array. No default inferred from site/profile names. Normalise Unicode NFKC, lowercase, and punctuation/whitespace into separated letter/number tokens; match whole contiguous token phrases, never substrings, regex or fuzzy spelling. Return effective phrases, matched phrases per example and a rule version. Missing configuration returns needs_configuration before provider calls. Empty/unusable query text remains unclassified. Non-branded means no configured phrase matched, not proof that brand intent is absent.

Fetch final web query-only rows using byProperty, adjacent 7/30/60/90-day periods, the existing configured GSC cap and one-hour identity/data-directory-scoped in-memory cache. Bound cache to ten entries; include refresh invalidation. Keep provider rows private in process, return aggregate clicks/impressions/derived CTR and impression-weighted position plus up to five examples per group. Show current/prior fetched coverage, cap flags and isolated failures. An empty/missing group or failed period has unavailable deltas; observed zero remains zero. Do not label difference from site totals as withheld, or treat the fetched rows as a complete partition of site search traffic.

Same core behavior for GA4/Matomo/Engage/none; no analytics calls, dependencies, persistence, private profile changes or external writes. User implementation authorisation covers this scope; publication/push and instance configuration changes remain separate.

## Acceptance and verification

Test phrase boundaries, punctuation, Unicode, overlapping variants, explicit configuration/overrides, unclassified rows, weighted arithmetic, zero/missing/failure states, bounded examples, cap/pagination behavior, cache isolation/expiry/refresh, all providers and CLI/MCP validation/safety. Run focused tests, build and full suite; validate docs. Record live verification separately when using connected profiles with explicit temporary matching phrases. No desktop MCP restart is implied by fresh-process tests.


## Results

- `npm run build` passed. Focused tests passed (37 tests in six files), followed by the full suite: 330 tests in 27 files.
- Coverage includes phrase normalization/boundaries and overlap, explicit config/override rules, unavailable versus numeric zero, weighted arithmetic, bounded examples and query safety, query-only pagination/caps and malformed metrics, all four analytics selections, source cache reuse/reclassification/isolation/expiry/refresh/bounds, partial failures/retry, and CLI/MCP contracts.
- Fresh stdio MCP processes using the existing connected personal and Umbraco configurations exposed the new tool and passed live tools/call checks. Explicit temporary phrases were supplied per request; no private configuration was changed. Checks verified property/query aggregation metadata, sums of group observations against fetched totals, two-example bounds, cache reuse, shared warnings and invalid-phrase rejection. Periods were 6 October–4 November against 6 September–5 October 2026.
- Personal query reports stayed below the cap and had no matching branded rows under the tested rules; those groups remained unavailable rather than measured zero. Umbraco reached the configured cap in both periods and returned branded, non-branded and unclassified observations with partial coverage. Neither result proves a complete site partition. Raw evidence, private paths and account exports are not stored here.
- No dependency, storage/configuration migration or architectural deviation. New configuration is optional. No provider writes, persistent rule changes, desktop MCP restart, package publication or push occurred. Existing desktop clients still need reconnection to expose the new tool.
