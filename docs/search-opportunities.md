# External search evidence and search opportunities

## Use

```sh
page-evidence external-import ./organic-keywords.csv
page-evidence opportunities --external=./organic-keywords.csv --days=30
page-evidence opportunities --external-id=external_DATASET_ID --format=text
page-evidence opportunities --action=IMPROVE --independent-support
page-evidence opportunities --days=30
```

JSON is the default. External input is optional, allowing the same analysis with first-party evidence alone. `external-import` needs no authenticated provider access. Analysis reuses snapshot/query caches and may fetch configured GSC/analytics evidence. `--refresh` refreshes first-party evidence; it does not select a different external dataset. File imports return a dataset ID. Repeated imports of the same bytes, adapter version and site scope reuse stored evidence. Normalized datasets live in the existing private SQLite store, never in the repository; imports do not copy the source CSV.

MCP tools follow the existing JSON-in-text-content convention and shared sanitizer:

- `import_external_search_evidence({path})`: path is on the MCP server machine, not necessarily the client machine; returns dataset metadata and diagnostics.
- `find_search_opportunities({externalDatasetId?, windowDays?, limit?, pageBudget?, refresh?, action?, requireIndependentSupport?, assessments?})`: returns bounded opportunities, IGNORE examples, counts, thresholds, references and coverage limitations. Threshold overrides are also accepted.

## Import contract

Supported report: Ahrefs Site Explorer Organic Keywords. `Keyword`, a current/previous URL column and a position or volume column identify the report; individual values need not all be populated. Current/previous columns are selected explicitly, independent of column order. UTF-8 and BOM-marked UTF-16, comma/tab/semicolon delimiters, quoted fields, unknown columns, empty values, numeric grouping, K/M suffixes and reported ranges are supported. Optional numbers that cannot be interpreted safely remain unavailable with a warning. Missing values are never invented as zero. Width errors or invalid URLs can be skipped; unclosed quotes, unidentified headers, empty accepted results and predominantly malformed records fail safely. Limits are 20 MiB and 100,000 records.

Diagnostics show accepted/skipped/duplicate records, mapped/missing/unsupported fields and up to 30 warnings, with the total warning count retained. Deduplicated observations retain every logical record number. Distinct countries, dates and conflicting metrics are preserved separately; volume is not summed across duplicates. Unknown columns and provider-specific data stay in the local dataset, but do not drive the opportunity engine.

Lost rows retain previous rankings as historical evidence. They do not establish a content gap. Row dates without timezone are provider-local strings; import time is distinct. SERP feature presence does not establish ownership and feature rankings are not assumed to be ordinary organic positions. Bounded supporting observations expose position kind and SERP context without interpreting them as AI visibility measurements. Competitiveness retains provider definition and scale; cross-provider feasibility thresholds are not invented.

## Discovery, enrichment and matching

Defaults: 10 results and enrichment of 10 pages, each configurable up to 20. `--page-budget=N` changes the enrichment budget, not API calls per keyword. At most two page-query fetches per selected page occur before cache reuse. Stable pages with traction are included; discovery is not restricted to movement candidates from the older report. All known pages receive triage counts, but uninspected pages cannot pass the IMPROVE gate.

URLs are checked for configured site/subdomain scope before path normalization; root and www aliases can match, different subdomains retain identity. Tracking parameters/fragments are removed. Meaningful parameters, case and trailing slashes remain distinct, following the existing normalizer. Competitor URLs never become this site's page just because paths match. Exact query matching uses Unicode NFKC, case normalization and collapsed whitespace. Queries attached to one verified page are grouped without claiming identical intent. Shared exact queries expose related pages; overlap alone never triggers CONSOLIDATE.

The engine is a pure function of evidence and options. It has no provider calls, model calls or Ahrefs-specific metric checks. Future providers can enrich locally selected candidates with partial normalized observations before this same engine. There is no plugin framework or DataForSEO implementation in V1.

## Gates and prioritization

- IMPROVE: selected existing page, at least 100 current impressions, position 4–20 or decline of at least 3 clicks, usable query retrieval and ready snapshot coverage. This is an investigation, not a diagnosis of a title/content problem.
- EXPAND: existing-page traction, external demand, cited page content and first-party evidence, and an explicit relevant/intent-fit/coverage-gap assessment. Prefer the existing URL.
- CREATE: no verified URL or exact-query target identified in the bounded run, meaningful recent external demand, cited adjacent first-party traction and page content, and explicit inventory/intent/gap review. Bounded retrieval cannot establish that a page is missing. Inventory-review assertions remain interpretations, not server-verified completeness.
- CONSOLIDATE: shared exact queries with at least 25 fetched impressions on both pages, source citations for both pages, measured decline on a mature target and an explicit redundant-intent assessment. Always review; harmful cannibalization is not established.
- IGNORE: insufficient support, missing current evidence, uninspected candidates or no identified upside. High volume alone does not justify work. Up to five IGNORE examples are returned while all classifications are counted.

Every action requires review. Potential/confidence are low/medium/high; effort is unavailable. Sorting prioritizes actionable candidates, first-party traction, confidence, potential, page impressions and a stable opaque ID. No traffic forecast or opportunity score is produced. Demand uses the largest reported lower bound, not the sum across queries or markets. Exact query correspondence with at least 25 fetched impressions and at least 100 external monthly searches supplies `independentSupport`. This is directional corroboration, not equal-market measurement. GSC is all-country evidence and external rows may describe one country. External estimated traffic is not counted as another independent demand signal. Analytics remains page/provider evidence, never query-attributed.

CLI thresholds: `--minimum-impressions=N`, `--minimum-demand=N`, `--max-external-age-days=N` (default 90). Undated external rows cannot produce high confidence; stale/future/historical rows cannot supply current demand support. First-party evidence can justify IMPROVE without external evidence. Snapshot readiness, maturity, query coverage and missing source context remain visible.

## Explicit semantic assessments

Read the initial result and inspect page/inventory evidence using existing context tools. Then provide an array using `--assessments=./assessments.json` or MCP `assessments`:

```json
[
  {
    "candidateId": "search_ID_FROM_RESULT",
    "action": "EXPAND",
    "source": "model_inference",
    "rationale": "The cited page is relevant but needs an API section for the measured query theme.",
    "evidenceRefs": ["gsc_page_ID", "page_evidence_ID", "external_DATASET_ROW"],
    "relevant": true,
    "intentFit": true,
    "coverageGap": true
  }
]
```

Use `source: derived` for human/rule-based review, or `model_inference` for a client model's interpretation. CREATE also requires `inventoryReviewed: true`. CONSOLIDATE requires `redundantIntent: true`, `relatedUrls` and references for both pages. The references must identify evidence available in that bounded analysis; arbitrary references from another tool do not pass. CREATE may reference adjacent inspected pages exposed by other candidates in the same result. Unknown/fabricated references and unsupported assessments fail the gates and return warnings. These flags do not override observed evidence or readiness requirements.

Assessments are not separately persisted in V1. Save returned JSON if needed and use the existing action log after review. Query omission mode disables assessment-driven actions and query-derived source retrieval. Query text and rationale are sanitized on CLI/MCP output. Other external text carries the existing untrusted-data warning. An explicitly enabled raw-query override retains the existing owner-controlled behavior.

Observed provider evidence, derived rule outputs and model/user interpretations remain separate records with source IDs and input references. Human assessments use `kind: user_inference`, distinct from a derived calculation. A provider estimate is observed provider data, not measured reality. Classification records cite observations and relevant interpretations; accepted and rejected assessments retain their labels. Only the selected ten external observations contribute to a candidate's calculations, and those observations are returned; additional omitted observations are noted. Recommendations are fixed rule templates and never editorial copy.
