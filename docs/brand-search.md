# Branded and non-branded search evidence

## Use

```sh
page-evidence brand-search '--brand-terms=["Example","Example Cloud"]' --days=30 --limit=5
page-evidence brand-search --refresh
```

MCP: `get_brand_search_performance({brandTerms: ["Example", "Example Cloud"], windowDays: 30, limit: 5, refresh: false})`.

`windowDays` accepts 7, 30, 60 or 90 (default 30). `limit` bounds examples per group to 1–5 (default 5), not fetched rows. Requests use the configured GSC row cap. Refresh invalidates this configuration's in-process query caches; it does not change stored snapshots or checkpoints.

Set optional `PAGE_EVIDENCE_BRAND_TERMS` to a JSON array in a private env file for repeated use. An explicit request array overrides configuration; an empty array disables classification and returns `needs_configuration` without a GSC call. No brand variants are inferred from a site, company or profile name. Empty configuration behaves the same way. Invalid JSON, more than 50 phrases, phrases longer than 100 characters or phrases with no letters/numbers fail before retrieval. No existing env variable or storage format changes.

## Transparent matching

Rule version `token-phrase-v1` uses Unicode NFKC and lowercase, treating punctuation and whitespace as separators between letter/number tokens. It matches whole contiguous phrases: `Example Cloud` matches `EXAMPLE-cloud pricing`; `Example` does not match `Examplecloud`. Case variants, domains, abbreviations, translations and typos must be explicitly configured when wanted. Diacritics are preserved; no regex, fuzzy matching, language segmentation or semantic intent inference is performed.

Responses show effective normalized phrases, their source (`request`/`configuration`) and matched phrases for examples. A row matching several phrases belongs to the branded group once. Query text with no usable letter/number tokens is unclassified. No configured phrase match means `nonBranded`; it does not prove the query lacks brand intent. Generic product phrases can overclassify queries; reviewers own the phrase list.

## Source and arithmetic

The GSC adapter requests final web evidence with dimensions `query` and aggregation `byProperty`. Query-only aggregation avoids repeating a query for each page shown. Periods use GSC's Pacific timezone and the configured reporting lag. The response identifies profile, site/property, analytics provider and evidence identity, but does not call analytics providers or attribute sessions/outcomes to queries.

Each period contains fetched-row totals and `branded`, `nonBranded`, `unclassified` groups, with clicks, impressions, derived CTR and impression-weighted average position. All accepted rows contribute to these aggregates before examples are bounded by impressions. Group sums describe only the fetched rows; they are not a complete partition of site search totals. GSC can omit queries even below the cap. No subtraction from page totals or attribution of missing rows to privacy is attempted.

A group with no returned rows has unavailable metrics/deltas (`null`), not measured zero. A returned numeric zero remains zero. Empty periods and failed periods are distinguished; one failed period does not discard the other. Both periods need observed group rows for click/impression deltas; CTR and position additionally require usable impressions. `ctrChange` is a ratio difference, not a relative percentage. Negative `positionChange` means a lower numeric average position. Descriptive changes do not establish causes, awareness or demand.

Cap-bound retrieval or one failed period sets the overall state to `partial`. Both failed periods yield `failed`; both empty periods yield `empty`. Every successful period retains fetched-row counts, cap flags and fetch freshness; `completeSiteQueryCoverage` is always false. Successful observed state does not imply complete coverage.

## Cache and delivery

Query reports are cached in memory for one hour, with ten entries bounded across data directories and configuration identities. Cache keys include source period, data-directory scope and the existing evidence fingerprint. Matching rules are applied after retrieval, so changing phrases can reuse source rows without reusing a previous classification. Failed requests are evicted for retry. `get_cache_status` includes additive `siteQueryCache` metadata; normal profile refresh invalidates it along with existing query caches.

No reports, rules, snapshots or provider rows are persisted by this feature. All CLI/MCP query examples use the existing sanitization and untrusted-text warnings. Omission mode retains aggregates while hiding query text. Rebuild/reconnect clients to expose the additional MCP tool; fresh-process checks do not restart desktop-owned connections.

See [implementation and verification](2026-11-08-brand-search-plan.md).
