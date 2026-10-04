# Page Evidence

Previously called Site Signal.

**A local-first Google Search Console + GA4, Matomo, or Umbraco Engage content-opportunity CLI and stdio MCP server.**

Page Evidence helps answer a deliberately narrow question: *which pages are worth investigating next, what changed, and what can the data not prove?* It saves reports and snapshots locally, uses no model API, and never changes a website or analytics property.

## What it does

- Fetches finalized GSC page performance for two equivalent 30-day periods.
- Shows bounded, side-by-side GSC query examples for a selected page and highlights observed movement.
- Fetches provider-specific page evidence separately from GA4, Matomo, or Umbraco Engage. Acquisition evidence is available where the provider exposes it.
- Normalizes URLs before comparing sources; retains the underlying source scope.
- Labels every report and recommended investigation as `ready`, `incomplete_coverage`, `too_fresh`, or `insufficient_evidence`, with the reason shown alongside it.
- Supports 7-, 30-, 60-, and 90-day comparisons, labels pages without a meaningful baseline as `maturing`, and offers bounded country, device, and search-appearance diagnostics.
- Returns optional, bounded local source context for a selected page or question when a repository path is configured; a chat client can then assess answer coverage and propose changes.
- Returns a chat-first page brief and keeps a local, explicit action/review log.
- Returns comparable locally stored page history and before/after review evidence for recorded changes without claiming causality.
- Shows how much of each page total is represented by the bounded query examples.
- Exposes raw context, segments, lifecycle evidence, query entry/exit, measurement readiness, and opt-in repository/link context over MCP.
- Creates a deterministic local Markdown + JSON report of review-gated changes.
- Exposes local status, opportunity discovery, and report generation over stdio MCP.

## What it does **not** do

- Publish content, change tags/events, or send data to a third party.
- Claim GSC clicks equal analytics visits/sessions, or attribute a query to a visit, session, or conversion.
- Reconstruct complete GSC query coverage from top rows.
- Call an LLM, crawl competitors, or sell an “AI visibility score.”

## Install

Requires Node.js 20+.

Clone the repository and run it locally:

```sh
git clone https://github.com/nclaursen/page-evidence.git
cd page-evidence
npm install
cp .env.example .env
npm run build
npm link
```

After the first npm release, `npm install -g page-evidence` will also be supported.

## Configure Google access

1. In a Google Cloud project, enable **Google Search Console API**. Also enable **Google Analytics Data API** when using GA4.
2. Configure the OAuth consent screen; if it is External and in testing, add yourself as a test user.
3. Create an OAuth client of type **Desktop app**.
4. Put its values and one analytics-provider configuration in a local `.env`:

```env
PAGE_EVIDENCE_PROFILE=example
SITE_DOMAIN=example.com
GSC_PROPERTY=sc-domain:example.com
ANALYTICS_PROVIDER=ga4
GA4_PROPERTY_ID=123456789
GOOGLE_OAUTH_CLIENT_ID=1234567890-example.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=replace-me
PAGE_EVIDENCE_DATA_DIR=/absolute/path/to/private/page-evidence-data/example
```

`GA4_PROPERTY_ID` is the numeric reporting property ID, **not** a `G-...` Measurement ID. For Matomo, use `ANALYTICS_PROVIDER=matomo` plus `MATOMO_URL`, `MATOMO_SITE_ID`, and a read-only `MATOMO_TOKEN_AUTH`; see [.env.example](.env.example). For Umbraco Engage 17 or 18, use `ANALYTICS_PROVIDER=engage` plus `UMBRACO_BASE_URL`, `UMBRACO_CLIENT_ID`, and `UMBRACO_CLIENT_SECRET` for a dedicated API user. Tokens, cache, SQLite database, and reports default to `~/.site-signal`, outside your repository.

The Engage connector calls the Umbraco Management API directly. It authenticates through `/umbraco/management/api/v1/security/back-office/token`, checks `/umbraco/engage/management/api/v1/package`, and reads `/umbraco/engage/management/api/v1/analytics/query`. The API user needs Engage section access and the minimum analytics read permission. `page-evidence doctor` checks authentication, permissions, the enabled Engage package, and the supported major version before sync.

Engage evidence includes page views, page sessions, page visitors, bounce rate, average time on page, average engaged time on page, and configured goal completions when those columns are returned. A missing column is reported as unavailable, not zero. This integration intentionally excludes acquisition-source evidence, visitor profiles, heatmaps and scroll maps, write operations, and reporting regeneration.

```sh
page-evidence auth
page-evidence doctor
page-evidence sync
page-evidence report
page-evidence brief https://example.com/page/ --90
page-evidence history https://example.com/page/ --days=30 --limit=6
page-evidence questions --days=90 --limit=30
page-evidence investigate https://example.com/page/ --days=60
page-evidence question-context https://example.com/page/ --question="How do I solve this?" --days=90
page-evidence segments https://example.com/page/ device
page-evidence actions list
page-evidence actions review ACTION_ID
```

For optional local repository and outcome evidence, add these only to your private env file:

```env
PAGE_EVIDENCE_REPOSITORY_PATH=/absolute/path/to/site-repository
PAGE_EVIDENCE_SITEMAP_URL=https://example.com/sitemap.xml
GA4_OUTCOME_EVENT_NAMES=generate_lead,form_submit
```

Repository and sitemap context remain opt-in. GA4 outcome events are returned as selected-period, property-level event counts; they are never attributed to individual Search Console queries.

The OAuth flow requests `webmasters.readonly` and, only for GA4, `analytics.readonly`. GSC dates use Pacific time; GA4 uses the property timezone. Engage requests use explicit UTC date boundaries, while the reporting timezone and processing delay remain properties of the configured Engage installation. Verify provider behaviour with `page-evidence doctor` and a fixed-range sync before relying on comparisons.

## Profiles and MCP

One running Page Evidence MCP server represents one site profile and one analytics provider. To use GA4, Matomo, or Engage for different sites, run the same built executable as separate named MCP entries, each with its own private env file and `PAGE_EVIDENCE_DATA_DIR`. Do not share a data directory between profiles.

Every snapshot, report, page-context result, and MCP response identifies its profile and analytics provider. This prevents Matomo visits from being presented as GA4 sessions and prevents snapshots from different sites being mixed.

## Keep your local installation up to date

The public repository is the canonical codebase. Keep your credentials in a private env file outside the clone, then run the public clone against that file:

```sh
cd page-evidence
git pull --ff-only
npm install
npm run build
node --env-file=/secure/path/secret.env dist/cli.js doctor
```

For a local MCP configuration, run the same built executable with the same private env file:

```sh
node --env-file=/secure/path/secret.env /absolute/path/to/page-evidence/dist/cli.js mcp
```

This keeps one codebase for you and everyone else. Do not copy your env file, OAuth token, snapshots, or reports into the repository. If you previously used `PRIVATE_SITE_DATA_DIR`, Page Evidence accepts it as a legacy alias so an existing private data directory and OAuth token can be reused; use `PAGE_EVIDENCE_DATA_DIR` for new setups.

## Demo and MCP

Run `page-evidence demo` for a synthetic output example—no credentials required. See [fixtures/demo-report.md](fixtures/demo-report.md).

For a local MCP host, run:

```sh
page-evidence mcp
```

The MCP tools are `get_site_status`, `get_change_digest`, `get_cache_status`, `refresh_site_evidence`, `find_content_opportunities`, `find_question_opportunities`, `get_page_context`, `get_page_investigation_context`, `get_question_page_context`, `get_page_segments`, `get_page_lifecycle`, `get_page_history`, `get_query_entry_exit`, `get_measurement_readiness`, `get_repository_context`, `get_internal_link_context`, `review_local_actions`, `get_action_review_context`, and `record_local_action`.

### Change digest and cache controls

`get_change_digest` answers “what changed since my last check?” using page-level GSC evidence. The first call saves a local baseline and returns `status: baseline_needed`; subsequent calls compare against that check and advance it. Checkpoints are separate from snapshots, scoped by profile, property, provider, window and relevant settings, and survive server restarts. Use `advanceCheckpoint: false` to preview without advancing the baseline, and `refresh: true` to fetch fresh evidence first. `windowDays` accepts 7, 30, 60 or 90; `limit` defaults to 5 per group (maximum 20).

The digest returns gains, declines, low-baseline/maturing pages, missing pages, current and previous measurement issues, counts, timestamps and the compared periods. A signal needs at least 100 impressions in either check, a mature baseline, and either a click change of at least 3 and 20%, or an impression change of at least 25 and 20%. Click movement takes priority when both qualify; conflicting directions are labelled. These are transparent triage thresholds, not statistical significance. A missing GSC row is not treated as zero traffic. Rolling windows may overlap; movements are not causal claims. This first version does not fetch or summarize emerging queries.

`get_cache_status` shows snapshot fetch time, age, expiry and whether it is stale, plus this process’s profile-scoped query-cache counts. It does not call external providers. Snapshots are reused for up to 24 hours; query rows for up to one hour, bounded to 50 cache entries across profiles. Expired entries are refetched on demand. Query evidence includes its own freshness metadata separately from the page snapshot. An explicit historical snapshot remains historical rather than being automatically replaced.

`refresh_site_evidence` refetches the selected window and invalidates the current profile’s in-process query cache; query rows reload when next requested. Existing `find_content_opportunities(refresh: true)` and CLI `sync --refresh` also invalidate that query cache. Historical snapshots, actions and digest checkpoints are retained. This does not invalidate another running MCP process’s query cache. Provider failures are reported, not silently replaced with stale evidence.

CLI equivalents (using your usual private environment):

```sh
page-evidence digest --days=30 --limit=5
page-evidence digest --days=30 --refresh --preview
page-evidence cache-status --days=30
page-evidence refresh --days=30
```

Product ideas and follow-ups live in [the backlog](docs/backlog.md).

### Seven-day windows and content-change reviews

Use `windowDays: 7` in MCP or `--days=7` in CLI for a full seven-day lookback. With `REPORTING_LAG_DAYS=3`, the three most recent complete days are excluded; for example, on October 3 the current week is September 23–29 and the prior week September 16–22. Existing defaults remain unchanged. Seven days is not automatically low-confidence: volume, coverage and comparability determine descriptive readiness. The lifecycle tool continues its established 30/60/90-day trend view.

`get_action_review_context(actionId, windowDays?)` and `page-evidence actions review ACTION_ID --days=7` return click and impression deltas (absolute and relative), CTR percentage-point change, position change, other implemented/reviewed same-page actions within the comparison span, and an `evidenceAssessment`. Zero baselines have no relative percentage. Adequate observations permit descriptive review, not causal attribution or statistical significance.

The baseline must be wholly before the implementation date and the after-period wholly after it, with equal lengths and matching profile/provider. Pinned baselines are validated rather than silently substituted; a pinned 30-day baseline cannot be used for a 7-day comparison. A new seven-day review needs stored seven-day observations. Missing history is not automatically backfilled. Assessment checks volume in both periods against `MINIMUM_BASELINE_IMPRESSIONS`, coverage/readiness and reporting lag. Other recorded changes are caveats, not proof of a confounding effect. Unrecorded or site-wide changes are not detected.

For a September 2 edit, a stored August 26–September 1 baseline and September 3–9 after-period can support an initial weekly comparison once the reporting delay has passed. A latest-week lookback alone does not isolate the effect of that edit.

### Untrusted Search Console query text

Search queries are untrusted third-party text. By default, MCP responses and query-printing CLI commands preserve ordinary query text, bound other prompt-shaped queries to 200 characters, and completely hide recognized instruction-like text. The same filtering applies to echoed questions and query/question-derived retrieval terms. Opaque IDs and metadata distinguish hidden queries while preserving their metrics. This keyword heuristic reduces exposure; it is not a security boundary and can miss instructions or hide harmless queries.

All MCP responses carry an `untrustedText` warning covering externally sourced text, including URLs, analytics labels, repository content, and annotations. A warning does not make that text safe; consumers must treat it as data and enforce their own action permissions.

Optional strict mode, `PAGE_EVIDENCE_QUERY_TEXT_MODE=omit`, hides all query and question text and disables query-derived retrieval terms. It retains IDs and metrics but prevents query-text analysis, text-based topic classification, and query-driven source/link suggestions. Downstream clients must use `queryId`, not placeholders, to distinguish queries. Leave this variable unset (or set it to `heuristic`) for the useful filtered default. The explicit raw-text override below takes precedence over either mode.

Raw snapshots and generated reports remain local and unchanged, so they can contain complete untrusted query text and must not be passed to an AI. An owner can explicitly opt into raw query text in MCP and CLI output with `PAGE_EVIDENCE_INCLUDE_RAW_QUERY_TEXT=1`; the warning metadata remains present. Set a private `PAGE_EVIDENCE_QUERY_ID_KEY` to keep opaque HMAC-based query IDs stable across server restarts. Without it, IDs are stable only for the lifetime of one process. Never commit either setting or its value.

### How page query rows are fetched

Search Console sorts query rows by clicks and orders ties arbitrarily; it has no sort parameter and does not guarantee all rows. A small `rowLimit` therefore returns an arbitrary sample of zero-click queries. For each page and period, Page Evidence makes one request for up to 5000 query rows, ranks them locally by impressions, and returns only the top rows. `get_query_entry_exit` computes entered, exited, and retained on the fetched rows, returns counts and the highest-impression rows of each group (20 by default, `limit` up to 50, preserving full metric rows and baseline labels), and includes fetched-row coverage against the page total. If the 5000-row cap is reached, the response says so. Entered and exited mean absent from the fetched rows; they do not show that a query started or stopped receiving impressions. Fetches are reused for up to one hour within one running process and profile, so repeat questions about the same page and period do not call the API again until expiry or manual refresh.

`find_question_opportunities` is a site-wide, bounded GSC query-and-page view for sparse question-like queries. It uses transparent Danish and English text patterns and can include one-impression, zero-click rows. It returns measured Google queries only: it cannot identify questions asked in ChatGPT or another answer engine, and it does not recommend a content action.

`get_page_investigation_context` is the general chat entry point for “inspect this URL over 7, 30, 60, or 90 days.” It combines the selected URL's GSC and provider-scoped analytics evidence with bounded query examples and optional local source headings/excerpts. `get_question_page_context` does the same for a selected question and landing page. Neither tool judges answer quality or writes copy: a chat client does that from the returned evidence.

`get_page_history` reads up to 12 matching observations already stored locally for one page, profile, analytics provider, and comparison window. It does not backfill missing history. Local actions can be typed as content, technical, campaign, tracking, external, or other changes. `get_action_review_context` retrieves a recorded baseline, a clean post-implementation observation when one exists, and any period that overlaps the implementation date. These are review aids, not causal attribution.

Page context includes displayed query subtotals beside the page totals. A difference means only that it is not explained by the bounded rows returned; Page Evidence does not label the difference as privacy-withheld or absent. `get_site_status` reports optional repository, sitemap, outcome-event, and analytics readiness separately from required profile setup.

## Interpretation rules

The report returns fewer opportunities when data is sparse. Current gates require at least 100 impressions in either comparison period. A `ready` state requires GSC page rows to remain within the configured cap and at least a three-day reporting lag. If either comparison source is incomplete, or the lag is shorter, Page Evidence shows that state instead of presenting the candidate as decision-ready. Use `page-evidence page https://example.com/page/` to inspect the selected page's current and prior query examples. Query evidence is illustrative, not a complete total: the GSC API returns top rows and may withhold low-volume data. Analytics evidence uses the selected provider's own metric names and scope; it is not query-attributed. High impressions plus low CTR is not automatically a title problem. Before changing a page, inspect the query mix, position, reader intent, and implementation context.

## Product direction

The actively maintained, decision-gated backlog lives in [BACKLOG.md](BACKLOG.md). It is intentionally not a feature roadmap: an item is built only when it improves a specific content decision while preserving Page Evidence's local-first, read-only posture.

## Privacy and security

Read [SECURITY.md](SECURITY.md). Never commit `.env`, `~/.site-signal`, report files, or OAuth tokens.

## Licence

[MIT](LICENSE).

## Compatibility after the rename

The executable is now `page-evidence`. The old `site-signal` command remains an alias. Use `PAGE_EVIDENCE_*` variables for new configurations; existing `SITE_SIGNAL_*` variables remain supported, with the new names taking precedence. The default storage directory remains `~/.site-signal` and the database filename remains `site-signal.sqlite`, so existing credentials, snapshots, and action logs are reused without migration. Existing local checkout paths and MCP entry names can stay as they are.
