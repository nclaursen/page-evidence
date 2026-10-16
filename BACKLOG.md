# Page Evidence backlog

This is a decision backlog, not a feature roadmap. Page Evidence exists to answer: **what page should I investigate next, why, and what can the data not prove?**

An item belongs here only if it makes that decision more reliable, makes a deliberate change easier to review, or prevents an avoidable measurement mistake. Everything remains local-first and read-only: Page Evidence never publishes or changes a site, analytics property, or external service.

## Product boundary

The MCP owns authenticated source access, normalized evidence, local snapshots, deterministic coverage flags, and explicit user-recorded state. The chat client owns semantic interpretation: query themes, hypotheses, answer quality, intent fit, and editorial recommendations.

Do not add an MCP feature unless it returns data or durable local state a client cannot reliably recreate from one chat turn. Search opportunities are an explicit exception for deterministic, inspectable action candidates and fixed next-step templates. They must retain provenance, contradictions, missing evidence and review gates. Semantic EXPAND, CREATE and CONSOLIDATE judgments come from explicit client/reviewer assessments with evidence references; they are never presented as observed facts. The server must not call a model, generate editorial copy, produce generic scores, or hide reasoning.

## Completed

- **External search evidence and opportunities:** local Ahrefs Organic Keywords imports normalize provider evidence separately from rule-based opportunity analysis. Bounded first-party discovery and page enrichment support review-gated IMPROVE, EXPAND, CREATE, CONSOLIDATE and IGNORE candidates over CLI/MCP, without a model API, DataForSEO integration or UI.

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

**Validated by the first live MCP run (2026-09-15):** page-level GSC and GA4 evidence worked, but `get_repository_context` correctly returned that `PAGE_EVIDENCE_REPOSITORY_PATH` was not configured. The client had to map the selected URLs to source files manually.

Set `PAGE_EVIDENCE_REPOSITORY_PATH` to the site's local repository. Optionally set `PAGE_EVIDENCE_SITEMAP_URL` once its canonical URL has been confirmed. These values stay in the private environment file, never in Git.

**Done when:** `get_repository_context` maps a known page to its actual source file, and `get_internal_link_context` returns only traceable candidates.

### Configure outcome events only when they are meaningful

**Decision improved:** Can the site distinguish search visibility from a measurable business outcome?

**Status:** pending a user decision about the real GA4 event names.

Set `GA4_OUTCOME_EVENT_NAMES` only for events that represent a meaningful outcome, such as a confirmed lead or sign-up. Counts remain property-level and are never attributed to individual GSC queries.

**Done when:** `get_measurement_readiness` can report configured outcome coverage without inventing attribution.

## Candidate data primitives — build only when a real decision needs them

### Record recommendations, changes and follow-up

**Status:** initial client workflow available 2026-10-16; existing log fields are used. A first real-case retrieval/review/reuse pilot was exercised on 2026-10-16; a comparable before/after outcome review is pending. Added 2026-10-08.

**Decision improved:** Can the person reviewing an edit understand why this change was chosen, what evidence supported it, and what would make us reconsider it?

Keep a durable decision record linked to the page's local action. Capture the reasoning when the edit is proposed or accepted, before its outcome is known:

- the observed problem, with profile, provider, periods, snapshot/evidence references, and relevant source passages;
- the interpretation or hypothesis, clearly separated from measured facts;
- the chosen edit and why it addresses the problem;
- alternatives considered, including monitoring or making no change, and why they were not chosen;
- the expected observable result, uncertainty, and a review date or evidence condition.

Preserve the original rationale when recording what was actually implemented and the later review. Do not reconstruct a confident explanation from the outcome after the fact. An accepted suggestion and an implemented edit are different states.

**First approach:** use the existing `record_local_action` description, hypothesis, baseline, review date, and outcome notes with a small client-side decision-record template. Add structured local fields or retrieval only if a real review shows that the existing annotations cannot preserve or retrieve the required context reliably. Editorial reasoning remains client-authored; the MCP stores and returns it with provenance.

**Done when:** a reviewer can retrieve one edit's original evidence, rationale, alternatives, expected result, implementation details, and subsequent review without relying on the original chat. Missing evidence remains explicit.

### Feedback loop for accumulated case knowledge

**Status:** initial logging/retrieval workflow available 2026-10-16; a first real-case retrieval/review/reuse pilot was exercised on 2026-10-16; comparable outcome evidence remains pending. Added 2026-10-08. Uses traceable local cases and the existing action-review evidence.

**Decision supported:** Can later investigations retrieve what was recommended, what changed, what feedback was given and what happened afterwards on the same site? The requirement is recorded, reusable experience; better advice or performance is not assumed.

Start with a skill using the MCP, rather than adding model training or semantic analysis to the server. The MCP supplies durable local evidence and feedback; the skill retrieves relevant reviewed cases before making a recommendation. More stored feedback alone does not demonstrate better analysis.

**Proposed first loop:**

1. Save the recommendation, evidence references, original rationale, and skill/rule version with the local action.
2. Record explicit reviewer feedback: accepted, adjusted, or dismissed, with the reason and correction. Separate editorial usefulness from measured performance; acceptance is not proof that the recommendation was correct.
3. After implementation, use `get_action_review_context` to inspect comparable before/after evidence and coverage. Record whether the result supports, contradicts, or cannot resolve the original hypothesis, including concurrent changes. Sparse or incompatible evidence stays inconclusive; a before/after movement does not establish causality.
4. Distil reviewed cases into proposed, scoped lessons, such as checking whether an answer already exists before suggesting expansion. Retain links to the originating cases and contradictory examples. A human reviews a lesson before it becomes a reusable skill instruction; the MCP must not silently rewrite skills or its own rules.
5. Retrieve applicable approved lessons for the next investigation and disclose which ones influenced the recommendation. Keep lessons profile-scoped by default; generalising across sites requires an explicit review.

**First approach:** pilot the workflow with existing local actions and outcome notes. Store generated case reviews and proposed lessons under `outputs/`, outside skill and agent configuration. Consider structured feedback fields and a bounded case-retrieval primitive only when the pilot exposes a concrete persistence or retrieval gap.

**Validation:** verify that original proposals survive feedback, acceptance is separate from implementation, inconclusive results stay explicit, and a later investigation can retrieve and cite a prior case. Check capture and retrieval fidelity rather than assuming better recommendations or traffic. Any later promoted skill/rule change needs its own review and validation.

**Done when:** a later investigation retrieves an earlier case and states what it reused or reconsidered, with links to the original recommendation, actual change, feedback and follow-up evidence. Missing or contradictory evidence remains explicit. Lessons can be revised or retired; promotion into persistent rules needs human review. No model API, automatic site edit or claim of autonomous self-training is introduced.

**Available first workflow:** [page-evidence-learning-loop](skills/page-evidence-learning-loop/SKILL.md), version `change-learning-v1`. Its [field mapping](skills/page-evidence-learning-loop/references/change-log.md) documents how to preserve the original case when updating the existing full-upsert API. No schema change or immutable-history guarantee is implied.

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

## Completed 2026-10-16 — evidence identity and CI

- New snapshots, history/review comparisons, query caches and digest checkpoints are scoped to verified site/property/settings identity. Legacy snapshots remain stored but are excluded when provenance cannot be verified; annotations remain intact.
- Shared host-aware page matching separates subdomains and ports across page evidence, reviews, digest, Engage aggregation and external search. The path-only source helper remains separate.
- Added GA4 adapter fixtures, cross-provider identity regressions and package build/test CI for Node 22/24. See [compatibility and validation](docs/evidence-identity.md).
- Action records still rely on separate private instance directories. Live instance upgrades and historical-data adoption were not performed. Query-to-page drift and decision-record workflows remain separate future increments.
