# Observed query-to-page drift

Use `find_query_page_drift` to investigate whether the landing pages observed for the **same exact Google query** changed between two comparable periods. This is shared GSC evidence for every Page Evidence instance; it does not use GA4, Matomo or Engage metrics.

## Usage

MCP discovery:

```json
{"windowDays":30,"limit":5,"pageLimit":5}
```

Inspect one query, including unchanged or insufficient observations:

```json
{"query":"enterprise cms","windowDays":30,"pageLimit":10}
```

CLI equivalents:

```sh
page-evidence query-page-drift --days=30 --limit=5
page-evidence query-page-drift --query="enterprise cms" --days=30 --page-limit=10
page-evidence query-page-drift --days=7 --refresh
```

Windows are 7, 30, 60 or 90 days, with the configured reporting lag. `limit` is 1–20 (default 5); `pageLimit` is 2–20 (default 5). `query` is 1–200 characters after trimming outer whitespace. Selected queries use an exact GSC query filter before applying the row cap. Case and other query text are not merged into an inferred theme.

## What the result means

| State | Observation |
| --- | --- |
| `leading_page_changed` | Both periods contain positive observed impressions for the query, and their unique highest-impression pages differ. |
| `observed_page_set_changed` | Both periods have query evidence and a different observed page set; a unique leader change has not been established. |
| `unchanged` | No page-set or unique leader change is observed. This does not establish that nothing changed outside the fetched rows. |
| `insufficient_comparison` | One period lacks positive query impressions. Missing observations stay unavailable, not zero. |

Discovery returns the first two states only, ordered by the larger observed impression total and then query text. A selected query can return the other states too. If no selected-query row was fetched, `selection.observed` is false and no empty zero-filled candidate is created.

Leading pages are defined by **impressions**, not clicks or average position. If either period has tied leaders, `flags.leadingPageChanged` is null; tie information is returned explicitly. A page-set difference can still be observed. Sparse rows can qualify for descriptive discovery; neither a flag nor a large observed change establishes statistical significance.

Each candidate includes period totals, the observed leaders, bounded page evidence, original URL examples, and raw clicks/impressions with CTR and position. Rows sharing the core page key are pooled: clicks/impressions sum, CTR is recalculated from those totals, and position is weighted by impressions. A page absent in one period has null metrics and null deltas for that side; absence is never converted to measured zero. Ratios and position are null for a zero-impression aggregate.

Page keys retain meaningful query parameters, path case, trailing slashes, subdomains and non-default ports. Configured root/www and HTTP/HTTPS aliases follow the existing [identity policy](evidence-identity.md). The returned URL is a representative of that pooled page identity, not proof of a canonical or redirect. Up to three source URL variants per page are shown, with counts/truncation flags.

Output page limits do not limit the calculation. Unique leaders from both periods are prioritised in the page list; remaining pages are ranked by observed volume. Candidate counts, observed page counts and truncation flags explain omitted output. Per-period leading-page lists have their own truncation flags when many pages tie.

## Scope, freshness and limitations

Responses identify profile, configured site/GSC property, selected analytics provider, configuration fingerprint, periods and GSC source metadata. `source.analyticsUsed` is false. GSC dates use Pacific time and finalized web-search query/page rows; analytics timezones and session/visit definitions do not enter the calculation.

GSC row caps apply independently to each period. Coverage reports fetched rows and cap hits, excluded unusable/out-of-site rows, eligible query count and returned limits. Even below the configured cap, GSC returns bounded top rows and can omit low-volume queries. A selected-query filter narrows retrieval but cannot recover withheld rows.

Query/page datasets are cached in process for up to one hour, bounded to ten period/query entries. Keys include configuration identity, period and the selected query. Cache hits retain original fetch timestamps. `refresh: true` invalidates the current scope before fetching both periods; `refresh_site_evidence` also invalidates that scope for the next query request. `get_cache_status` exposes additive `queryPageCache` counts. Failed fetches propagate; a rejected promise is removed rather than reused as evidence.

These datasets are not stored as historical snapshots and do not produce a `baselineSnapshot` ID. When authorised, a client can record a scoped finding, source periods/fetch times and its interpretation in the [change log](../skills/page-evidence-learning-loop/SKILL.md). The read tool itself creates no action. A later refresh can revise the evidence, so preserve the relevant finding when recording a decision.

Inspect the returned page sources before recommending differentiation, links, consolidation or no action. A page change is an investigation signal, not proof of cannibalization, a technical fault, lost visits or a content-change effect. Existing missing history is not backfilled.
