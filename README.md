# Site Signal

**A local-first Google Search Console + GA4 or Matomo content-opportunity CLI and stdio MCP server.**

Site Signal helps answer a deliberately narrow question: *which pages are worth investigating next, what changed, and what can the data not prove?* It saves reports and snapshots locally, uses no model API, and never changes a website or analytics property.

## What it does

- Fetches finalized GSC page performance for two equivalent 30-day periods.
- Shows bounded, side-by-side GSC query examples for a selected page and highlights observed movement.
- Fetches provider-specific page and acquisition evidence separately: GA4 or Matomo.
- Normalizes URLs before comparing sources; retains the underlying source scope.
- Labels every report and recommended investigation as `ready`, `incomplete_coverage`, `too_fresh`, or `insufficient_evidence`, with the reason shown alongside it.
- Supports 30-, 60-, and 90-day comparisons, labels pages without a meaningful baseline as `maturing`, and offers bounded country, device, and search-appearance diagnostics.
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
git clone https://github.com/nclaursen/site-signal.git
cd site-signal
npm install
cp .env.example .env
npm run build
npm link
```

After the first npm release, `npm install -g site-signal` will also be supported.

## Configure Google access

1. In a Google Cloud project, enable **Google Search Console API**. Also enable **Google Analytics Data API** when using GA4.
2. Configure the OAuth consent screen; if it is External and in testing, add yourself as a test user.
3. Create an OAuth client of type **Desktop app**.
4. Put its values and one analytics-provider configuration in a local `.env`:

```env
SITE_SIGNAL_PROFILE=example
SITE_DOMAIN=example.com
GSC_PROPERTY=sc-domain:example.com
ANALYTICS_PROVIDER=ga4
GA4_PROPERTY_ID=123456789
GOOGLE_OAUTH_CLIENT_ID=1234567890-example.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=replace-me
SITE_SIGNAL_DATA_DIR=/absolute/path/to/private/site-signal-data/example
```

`GA4_PROPERTY_ID` is the numeric reporting property ID, **not** a `G-...` Measurement ID. For Matomo, use `ANALYTICS_PROVIDER=matomo` plus `MATOMO_URL`, `MATOMO_SITE_ID`, and a read-only `MATOMO_TOKEN_AUTH`; see [.env.example](.env.example). Tokens, cache, SQLite database, and reports default to `~/.site-signal`, outside your repository.

```sh
site-signal auth
site-signal doctor
site-signal sync
site-signal report
site-signal brief https://example.com/page/ --90
site-signal history https://example.com/page/ --days=30 --limit=6
site-signal questions --days=90 --limit=30
site-signal investigate https://example.com/page/ --days=60
site-signal question-context https://example.com/page/ --question="How do I solve this?" --days=90
site-signal segments https://example.com/page/ device
site-signal actions list
site-signal actions review ACTION_ID
```

For optional local repository and outcome evidence, add these only to your private env file:

```env
SITE_SIGNAL_REPOSITORY_PATH=/absolute/path/to/site-repository
SITE_SIGNAL_SITEMAP_URL=https://example.com/sitemap.xml
GA4_OUTCOME_EVENT_NAMES=generate_lead,form_submit
```

Repository and sitemap context remain opt-in. GA4 outcome events are returned as selected-period, property-level event counts; they are never attributed to individual Search Console queries.

The OAuth flow requests `webmasters.readonly` and, only for GA4, `analytics.readonly`. GSC dates use Pacific time; GA4 uses the property timezone; verify the timezone behaviour of each Matomo instance with `site-signal doctor`.

## Profiles and MCP

One running Site Signal MCP server represents one site profile and one analytics provider. To use GA4 for one site and Matomo for another, run the same built executable as two named MCP entries, each with its own private env file and `SITE_SIGNAL_DATA_DIR`. Do not share a data directory between profiles.

Every snapshot, report, page-context result, and MCP response identifies its profile and analytics provider. This prevents Matomo visits from being presented as GA4 sessions and prevents snapshots from different sites being mixed.

## Keep your local installation up to date

The public repository is the canonical codebase. Keep your credentials in a private env file outside the clone, then run the public clone against that file:

```sh
cd site-signal
git pull --ff-only
npm install
npm run build
node --env-file=/secure/path/secret.env dist/cli.js doctor
```

For a local MCP configuration, run the same built executable with the same private env file:

```sh
node --env-file=/secure/path/secret.env /absolute/path/to/site-signal/dist/cli.js mcp
```

This keeps one codebase for you and everyone else. Do not copy your env file, OAuth token, snapshots, or reports into the repository. If you previously used `PRIVATE_SITE_DATA_DIR`, Site Signal accepts it as a legacy alias so an existing private data directory and OAuth token can be reused; use `SITE_SIGNAL_DATA_DIR` for new setups.

## Demo and MCP

Run `site-signal demo` for a synthetic output example—no credentials required. See [fixtures/demo-report.md](fixtures/demo-report.md).

For a local MCP host, run:

```sh
site-signal mcp
```

The MCP tools are `get_site_status`, `find_content_opportunities`, `find_question_opportunities`, `get_page_context`, `get_page_investigation_context`, `get_question_page_context`, `get_page_segments`, `get_page_lifecycle`, `get_page_history`, `get_query_entry_exit`, `get_measurement_readiness`, `get_repository_context`, `get_internal_link_context`, `review_local_actions`, `get_action_review_context`, and `record_local_action`.

`find_question_opportunities` is a site-wide, bounded GSC query-and-page view for sparse question-like queries. It uses transparent Danish and English text patterns and can include one-impression, zero-click rows. It returns measured Google queries only: it cannot identify questions asked in ChatGPT or another answer engine, and it does not recommend a content action.

`get_page_investigation_context` is the general chat entry point for “inspect this URL over 30, 60, or 90 days.” It combines the selected URL's GSC and provider-scoped analytics evidence with bounded query examples and optional local source headings/excerpts. `get_question_page_context` does the same for a selected question and landing page. Neither tool judges answer quality or writes copy: a chat client does that from the returned evidence.

`get_page_history` reads up to 12 matching observations already stored locally for one page, profile, analytics provider, and comparison window. It does not backfill missing history. Local actions can be typed as content, technical, campaign, tracking, external, or other changes. `get_action_review_context` retrieves a recorded baseline, a clean post-implementation observation when one exists, and any period that overlaps the implementation date. These are review aids, not causal attribution.

Page context includes displayed query subtotals beside the page totals. A difference means only that it is not explained by the bounded rows returned; Site Signal does not label the difference as privacy-withheld or absent. `get_site_status` reports optional repository, sitemap, outcome-event, and analytics readiness separately from required profile setup.

## Interpretation rules

The report returns fewer opportunities when data is sparse. Current gates require at least 100 impressions in either comparison period. A `ready` state requires GSC page rows to remain within the configured cap and at least a three-day reporting lag. If either comparison source is incomplete, or the lag is shorter, Site Signal shows that state instead of presenting the candidate as decision-ready. Use `site-signal page https://example.com/page/` to inspect the selected page's current and prior query examples. Query evidence is illustrative, not a complete total: the GSC API returns top rows and may withhold low-volume data. Analytics evidence uses the selected provider's own metric names and scope; it is not query-attributed. High impressions plus low CTR is not automatically a title problem. Before changing a page, inspect the query mix, position, reader intent, and implementation context.

## Product direction

The actively maintained, decision-gated backlog lives in [BACKLOG.md](BACKLOG.md). It is intentionally not a feature roadmap: an item is built only when it improves a specific content decision while preserving Site Signal's local-first, read-only posture.

## Privacy and security

Read [SECURITY.md](SECURITY.md). Never commit `.env`, `~/.site-signal`, report files, or OAuth tokens.

## Licence

[MIT](LICENSE).
