# Page Evidence backlog

Updated: 2026-10-16, after query-to-page drift and local action-ID cleanup.

This is the single product decision backlog. It answers: **what page should I investigate next, why, and what can the data not prove?** An item belongs here only if it improves that decision, makes a deliberate change reviewable, or prevents a measurement mistake. Page Evidence stays local-first and makes no changes to websites or external services.

Implemented means available in source on `main`; it does not mean published as a package, loaded by every MCP client, or verified against live providers. Priorities below are recommendations, not approval to implement. Detailed architecture proposals remain in `docs/architecture-backlog.md` where present; they are not completed product features.

## Product boundary

The MCP owns authenticated source access, normalized evidence, local snapshots, deterministic coverage flags, and explicit user-recorded state. The chat client owns semantic interpretation: query themes, hypotheses, answer quality, intent fit, and editorial recommendations.

Do not add an MCP feature unless it returns data or durable local state a client cannot reliably recreate from one chat turn. Search opportunities are an explicit exception for deterministic, inspectable action candidates and fixed next-step templates. They must retain provenance, contradictions, missing evidence and review gates. Semantic EXPAND, CREATE and CONSOLIDATE judgments come from explicit client/reviewer assessments with evidence references; they are never presented as observed facts. The server must not call a model, generate editorial copy, produce generic scores, or hide reasoning.

## Implemented — no longer open feature work

| Capability | Current scope and limitations |
| --- | --- |
| External search evidence and opportunities | Local Ahrefs Organic Keywords imports and review-gated candidates; no model API or automatic editorial decision. See [search opportunities](docs/search-opportunities.md). |
| Analytics adapters | GA4, Matomo, Engage and GSC-only mode. Provider availability/readiness inconsistencies remain an open item below. |
| Freshness, refresh and change digest | Fetch times, cache expiry, explicit refresh and local digest checkpoints; missing history is not backfilled. |
| Comparison windows and page evidence | 7/30/60/90-day evidence where supported, query movement and page segments; lifecycle retains its 30/60/90-day view. |
| Question discovery and source context | `find_question_opportunities`, page/question investigation, optional repository mapping and internal-link context. Question-like Google queries are not evidence of LLM demand. |
| History and action review | Local observations, typed annotations, baselines, review dates and descriptive before/after evidence; no causal attribution. |
| Evidence identity and page matching | Site/property/settings isolation, host-aware page keys and exclusion of unverifiable legacy snapshots. See [evidence identity](docs/evidence-identity.md). |
| Query-to-page drift | `find_query_page_drift` and `query-page-drift`, including exact-query inspection, ties, missing periods and bounded discovery. See [usage](docs/query-page-drift.md). Live verification remains open. |
| Change-learning workflow | Recommendation, implementation, feedback and case retrieval use existing local action fields. First real-case retrieval/review/reuse pilot completed; comparable outcome review remains open. See [workflow](skills/page-evidence-learning-loop/SKILL.md). |
| Action-ID repair | Missing-ID generation fixed in shared storage. Seven remaining personal-instance records repaired with private backup; all 11 records have unique IDs. Other instances were not migrated. |
| Validation | MCP contracts, adapter fixtures and package build/test CI on Node 22/24. Latest implementation: 196 tests passed and both hosted CI jobs passed. These are not live-provider verification. |

## Operational follow-up — use and verify existing features

1. **Load and exercise query-to-page drift.** Reconnect the relevant MCP clients, confirm the new tool is exposed, and inspect a bounded real query/page comparison. Record source, periods, coverage and interpretation in the local action log when appropriate. The isolated built MCP smoke test exposed 22 tools; no live drift result has yet been verified.
2. **Continue the learning-loop case.** Verify actual publication and implementation date, obtain comparable observations under the new evidence identity, and record the review. The first pilot had no usable comparable baseline; retain its legacy observations without treating them as proof of an effect.
3. **Verify digest rollout per instance.** Confirm a suitable checkpoint exists for the intended profile/window and exercise refresh/review. Do not infer current client versions or baseline state from an old rollout note; no live digest baseline was established in the recent implementation work.
4. **Verify optional source setup per instance.** Repository/sitemap context is implemented. The September setup note reported missing repository configuration; the October pilot inspected local source. Recheck actual MCP mapping rather than treating all instances as configured or unconfigured. Done when a known URL maps to a real source file and link candidates are traceable. Keep configuration private.
5. **Choose meaningful outcome events.** Pending a decision about real GA4 event names. Configure `GA4_OUTCOME_EVENT_NAMES` only for actual business outcomes. Counts remain property-level and are never attributed to GSC queries. Other providers retain their own supported scope.

## Recommended development order — not yet implemented

| Order | Candidate | Decision and completion evidence |
| --- | --- | --- |
| 1 | Canonical, redirect and HTTP-status evidence | Explain a selected URL's unexpected search behavior using a bounded observed chain, canonical and retrieval time. Detailed scope below. |
| 2 | Provider availability and measurement readiness | Distinguish unsupported, missing, observed zero and failed evidence across GA4/Matomo/Engage/none. Remove GA4-specific acquisition assumptions from shared readiness; adapters supply source semantics. Validate the same readiness cases across providers. |
| 3 | Bounded URL inventory | Show known URLs, source mappings and gaps from an explicit repository/sitemap source. Detailed scope below. |
| 4 | Emerging-query evidence in the digest | Enrich only selected flagged pages with bounded `get_query_entry_exit` evidence. Declare limits and distinguish newly observed rows from new demand; avoid automatic site-wide query retrieval. |

## Change-learning workflow — available; outcome follow-up pending

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

## Further candidates — decision-gated

### Query themes in the chat client

Group related queries by intent with inspectable examples only when it helps a real investigation. This remains client interpretation, not measured fact or a server-side model feature. Existing question-pattern matching and entered/exited query lists do not implement thematic grouping. Start with a client workflow; add a data primitive only for a demonstrated retrieval gap.

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
