# Site Signal backlog

This is a decision backlog, not a feature roadmap. Site Signal exists to answer: **what page should I investigate next, why, and what can the data not prove?**

An item belongs here only if it makes that decision more reliable, makes a deliberate change easier to review, or prevents an avoidable measurement mistake. Everything remains local-first and read-only: Site Signal never publishes or changes a site, analytics property, or external service.

## Product boundary

The MCP owns authenticated source access, normalized evidence, local snapshots, deterministic coverage flags, and explicit user-recorded state. The chat client owns interpretation: query themes, hypotheses, priorities, briefs, and recommendations.

Do not add an MCP feature unless it returns data or durable local state a client cannot reliably recreate from one chat turn. The server must not contain prose recommendations, rewrite advice, generic scores, or hidden LLM reasoning.

## Completed

- **Analytics provider boundary:** GA4, Matomo, Umbraco Engage, and GSC-only setups expose honest provider scope, metric names, availability, and coverage limitations.
- **Readiness and freshness:** reports expose incomplete coverage, reporting lag, sparse evidence, and maturing pages rather than overstating a conclusion.
- **Flexible comparison windows:** 30-, 60-, and 90-day comparisons are available through CLI and MCP.
- **Page investigation evidence:** raw page context, bounded query evidence, and country/device/search-appearance segments are available for a selected URL.
- **Lifecycle and query movement:** multi-window page evidence and bounded entered, exited, and retained query rows are available without calling them complete keyword coverage.
- **Local annotations:** actions, hypotheses, baselines, review dates, and outcome notes can be stored and read locally; no causal lift is claimed.
- **Measurement readiness:** the MCP can expose configured provider-supported outcomes, organic acquisition context, and identifiable AI-referral rows where the provider supports them.
- **Optional implementation context:** a configured local repository and/or sitemap can provide verified page mapping and internal-link candidates. Empty or unmapped results are valid.
- **Release safety:** the public MCP tool contract is documented and covered by a contract test.
- **Source-backed investigation context:** selected pages and question candidates can return bounded local headings and excerpts when a repository path is configured. The chat client evaluates answer quality and proposes any change.

## Completed recently — site-wide question discovery

### Surface sparse, question-like Search Console queries

**Decision improved:** Which real questions is the site beginning to surface for, and does the current landing page answer them well enough to justify monitoring, improving an existing answer, or investigating a new content opportunity?

Marketing teams do not only investigate pages with material traffic movement. They also look for early demand signals in low-volume, conversational queries that resemble questions a buyer might ask in search or an LLM interface. The current page-level opportunity gate requires at least 100 impressions and query evidence is only available after a URL has been selected, so this discovery route does not exist today.

Add a bounded site-wide query-and-page evidence tool, provisionally named `find_question_opportunities`, that:

- queries GSC with both `query` and `page` dimensions for the declared current and comparison periods;
- permits sparse evidence from one impression upward and does not require clicks;
- supports the 30-, 60-, and 90-day windows, with the 90-day window available for sparse demand discovery;
- uses transparent, deterministic question-pattern rules for Danish and English, including question words and common conversational formulations;
- returns the matched query, landing page, clicks, impressions, CTR, position, period-over-period state, and the rule that matched;
- declares row limits, truncation, and the possibility that GSC withholds low-volume query data;
- keeps raw evidence separate from the chat client's interpretation of topic relevance, answer quality, priority, and recommended action.

Call these rows **question-like query candidates**, not LLM queries. Search Console can show measured Google queries, but it cannot prove that the same question is asked in ChatGPT or another answer engine.

The tool must not automatically recommend a new page. Before a candidate becomes content work, the client must inspect the mapped landing-page source and classify it as already answered, weakly answered, mismatched, or unsupported by enough evidence.

**Status: completed in v0.6.0.** `find_question_opportunities` returns bounded site-wide candidates with deterministic Danish and English match reasons, raw current/previous metrics, comparison state, and row-cap limitations. It permits zero-click and sparse query rows while preserving the limitation that GSC may withhold low-volume data.

### Source-backed page and question context

**Decision improved:** Does the current landing page already answer a selected question, and what evidence should a chat client use before proposing a change?

**Status: completed in v0.7.0.** `get_page_investigation_context` returns a selected URL's 30-, 60-, or 90-day GSC and provider-scoped analytics evidence, bounded query examples, and optional local source context. `get_question_page_context` adds a selected question. Local source context returns only mapping method, headings, and bounded matching excerpts. The chat client, not the MCP, decides whether the answer is already present, buried, weak, or missing and may then propose copy in chat.

## Completed in v0.8.0 — history and review loop

- **Historical snapshot comparison:** `get_page_history` returns up to 12 comparable, locally stored observations for a selected page and 30-, 60-, or 90-day window. It does not fetch missing history or label variation as a trend.
- **Typed operational annotations:** local actions accept `content_update`, `technical_change`, `campaign`, `tracking_change`, `external_event`, or `other`; the additive SQLite migration preserves existing local data.
- **Review-period evidence:** `get_action_review_context` retrieves an action's recorded baseline, a clean post-implementation observation when available, and any observation whose period overlaps the implementation date. It explicitly makes no causal claim.
- **Query-example coverage cue:** page context shows the displayed query-row count and subtotals beside page totals for both periods. The difference is labelled as unexplained by the displayed examples, not privacy-withheld or absent.
- **Optional capability readiness:** `get_site_status` reports repository, sitemap, outcome-event, and analytics readiness separately without making optional setup a core-profile failure.

## Next local setup — decision-gated

### Configure opt-in repository and sitemap context

**Decision improved:** Can a chat client point to real, verifiable source context when an approved change needs implementing?

**Status:** pending local configuration; no code change is needed.

**Validated by the first live MCP run (2026-09-15):** page-level GSC and GA4 evidence worked, but `get_repository_context` correctly returned that `SITE_SIGNAL_REPOSITORY_PATH` was not configured. The client had to map the selected URLs to source files manually.

Set `SITE_SIGNAL_REPOSITORY_PATH` to the site's local repository. Optionally set `SITE_SIGNAL_SITEMAP_URL` once its canonical URL has been confirmed. These values stay in the private environment file, never in Git.

**Done when:** `get_repository_context` maps a known page to its actual source file, and `get_internal_link_context` returns only traceable candidates.

### Configure outcome events only when they are meaningful

**Decision improved:** Can the site distinguish search visibility from a measurable business outcome?

**Status:** pending a user decision about the real GA4 event names.

Set `GA4_OUTCOME_EVENT_NAMES` only for events that represent a meaningful outcome, such as a confirmed lead or sign-up. Counts remain property-level and are never attributed to individual GSC queries.

**Done when:** `get_measurement_readiness` can report configured outcome coverage without inventing attribution.

## Candidate data primitives — build only when a real decision needs them

### v0.9 candidate — query-to-page drift

**Decision improved:** Has Google started associating an important query with a different landing page, or is the same query moving between several pages in a way that warrants investigation?

Return bounded query-and-page evidence across comparable periods for a selected query or a small set of materially changing queries. Show the observed landing pages, raw clicks, impressions, CTR, position, period, and coverage limits. Call this **query-to-page drift**, not keyword cannibalization: changing or overlapping landing pages do not by themselves prove that pages compete or that consolidation is the right action.

Keep discovery deterministic and GSC-scoped. The chat client must inspect the relevant page sources before proposing consolidation, differentiation, internal linking, or no action.

**Target:** consider for v0.9.0 after the v0.8.0 history and review loop has been validated.

**Done when:** a client can identify a measured query whose observed landing-page association changed between comparable periods, inspect every returned page and coverage limitation, and avoid presenting incomplete top-row evidence as a complete query history.

### Bounded URL inventory evidence

Return a small, explicit inventory of pages from a configured sitemap or repository, including mapping confidence and gaps. This would support answering “what is covered?” without expanding into a crawler or a hosted dashboard.

**Done when:** a client can list mapped URLs, unmapped URLs, and missing evidence with a declared inventory source and no guessed matches.

### Canonical and redirect evidence

**Decision improved:** Could a canonical, redirect, or response-status issue explain unexpected search data for this URL?

For a user-selected URL, return the observed HTTP status, redirect chain, canonical reference, and retrieval time as raw technical evidence. Keep it bounded to the selected URL; this is not a site crawler or a technical audit score.

**Done when:** the output lets a client inspect a specific mismatch without inferring a fix or crawling the whole site.

### Controlled segment definitions

**Decision improved:** Does an observed change differ meaningfully in a permitted market, device group, or analytics slice?

Allow a profile to define a small approved set of GSC dimensions and provider-supported analytics filters. Each response must retain its source, metric definition, and scope; it must not combine incompatible segments into a synthetic score.

**Done when:** a configured segment can be requested reproducibly and an unavailable or unsupported segment is reported honestly.

### Configured business-outcome trend snapshots

Persist comparable property-level outcome counts across snapshots for configured events. This would make measurement review more durable while preserving the boundary that GSC queries are not conversion-attributed.

**Done when:** configured event counts can be compared across local snapshots with source scope and coverage shown explicitly.

## Explicitly not building

- Hosted dashboards, scheduled alerts, user accounts, or subscription rank tracking.
- Competitor crawling or SERP scraping.
- Automatic rewrites, metadata changes, internal-link insertion, commits, or publishing.
- Generic SEO, AEO, GEO, or AI-visibility scores.
- Attribution claims from GSC queries to visits, sessions, or conversions.

## Before starting any item

State the real decision it supports, who makes that decision, and what evidence would justify keeping it. If the current MCP response can answer the question with a small workflow or documentation change, prefer that over another feature.
