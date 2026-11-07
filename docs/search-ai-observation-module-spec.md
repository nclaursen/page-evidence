# Page Evidence: Search and AI Answer Observation Module

**Status:** Unapproved proposal; not an implementation plan\
**Version:** 0.2 (architecture assumptions clarified 2026-11-07)\
**Intended home:** Page Evidence GitHub repository\
**Module type:** Extension to the existing Page Evidence product\
**Relationship to AUMTP:** Conceptually related, but this specification does not depend on, revive, or require migration from AUMTP or the retired local implementation.

## Current architecture and approval boundary

This document preserves a future product concept, not an approved extension scope. [Current architecture](architecture.md) is a local-first Node/TypeScript CLI and stdio MCP server: one configured profile per process, private SQLite snapshots/actions, provider adapters and local reports. It has no hosted workspace/user/role system, HTTP application API, queue, scheduler, blob service, review UI or model-calling runtime.

- Reuse existing GSC evidence, configuration identity, provider contracts and action-review capabilities where suitable. The domain models and TypeScript examples below are illustrative, not existing schemas or APIs.
- Workspace roles, encrypted managed secrets, hosted storage, scheduled jobs, notifications and automated answer-provider calls below are proposed dependencies. They require separate architectural and product approval; do not implement them as implied platform services.
- Any next implementation proposal must choose a small local-first slice, define its evidence/retention and provider boundaries, and reconcile the remaining requirements with the current product. Committing this specification does not approve its phases, pilot panel, integrations or external execution.

## 1. Executive summary

Build a Search and AI Answer Observation module on top of Page Evidence.

The module gives a team a reproducible way to observe whether its brand and content are becoming more discoverable across conventional search and selected AI-answer products. It combines:

- Google Search Console query and page evidence;
- a versioned panel of real buyer questions;
- repeated observations from selected AI-answer surfaces;
- citations, brand mentions, prominence, factual accuracy, and stability labels;
- live-page readiness evidence;
- content-change records and before/after snapshots; and
- inspectable reports that link every metric back to raw evidence.

The product must not claim to measure universal “AI visibility,” market share, search volume, or causal impact. It measures a defined sample using a documented method. The primary product concept is an **observation**, not a visibility score.

## 2. Problem statement

Commercial AI-visibility tools produce attractive summary scores, but their prompt panels, sampling methods, location settings, model versions, extraction logic, and denominators are often unclear. Results can therefore be difficult to trust or act on.

Search Console is more dependable because it records observed Google search activity, but it does not show how AI-answer products describe, recommend, or cite a brand. It is also difficult to interpret low-volume, long-tail queries using traffic totals alone.

Page Evidence needs a module that:

1. uses Search Console as the dependable measurement spine;
2. adds a controlled and transparent AI-answer observation panel;
3. preserves raw evidence for every reported result;
4. tracks changes consistently over time;
5. distinguishes observations from interpretation;
6. connects measurement to specific content interventions; and
7. remains useful before clicks or conversion volumes become statistically meaningful.

## 3. Product objective

After the module is implemented, a Page Evidence user must be able to answer:

1. Are we appearing for more of the buyer questions we care about?
2. Which new, relevant long-tail searches are beginning to appear?
3. Do selected AI-answer products mention or cite us for the same buyer questions?
4. When they mention us, are we prominent and accurately described?
5. Are observations stable across repeated runs, or are they mostly noise?
6. Which pages are being selected, and are they the pages we intended?
7. Did search and answer-engine observations change after a recorded content intervention?

## 4. Product principles

### 4.1 Evidence before scoring

Every aggregate result must be traceable to a stored raw observation or source snapshot.

### 4.2 Explicit denominators

The interface must say “14 of 24 eligible observations mentioned the brand,” not only “58% visibility.”

### 4.3 Search and AI answers are separate layers

Do not combine search performance, page readiness, AI-answer mentions, citations, or site behavior into one composite score.

### 4.4 Repeatability over false precision

The system must version prompts, settings, providers, extraction logic, and schedules. It must report when a comparison is methodologically incompatible.

### 4.5 Raw output is immutable

The original returned answer, citations, and run metadata must not be overwritten when an extraction or human label changes.

### 4.6 Human correction is part of the product

Automated classifications can be wrong. A reviewer must be able to correct mention, citation relevance, prominence, and factual-accuracy labels without altering the raw result.

### 4.7 Provider claims remain narrow

An API result measures that API configuration. It must not be presented as equivalent to a consumer product unless the observation was captured from that product surface.

## 5. Scope

### 5.1 Required for the first usable release

- A separately approved profile/project scope; hosted workspaces are not provided by current Page Evidence.
- Topic clusters and versioned question panels.
- Canonical questions plus controlled paraphrases.
- Provider/surface configuration.
- Scheduled and manually triggered observation runs.
- At least one supported API-based answer adapter.
- Assisted manual import for product-interface observations.
- Immutable raw-answer and citation storage.
- Automated brand/entity mention detection.
- Citation extraction and URL normalization.
- Prominence classification.
- Human review and corrections.
- Approved-message accuracy review workflow.
- Repetition and stability calculation.
- Google Search Console query/page ingestion.
- Long-tail query discovery and review queue.
- Target-page mapping.
- Content-change/action records with baselines and review dates.
- Weekly and monthly reports.
- CSV and JSON export.
- Complete run and configuration audit trail.

### 5.2 Desirable after the first release

- Additional answer-provider adapters.
- Supported automated product-interface capture where permitted and stable.
- Live-page content/readiness inspection.
- Analytics integration for verified landing-page, event, and conversion evidence.
- Notifications for material changes and factual errors.
- Competitor entity configuration.
- Saved report views by market, audience, intent, and topic.
- API/webhook access for completed runs and reviewed findings.

### 5.3 Explicitly out of scope

- A universal AI-visibility or market-share claim.
- Estimated search-volume generation.
- Automated content publishing or website modification.
- Automated SEO recommendations presented as facts.
- Lead or revenue attribution without a separately verified analytics model.
- Undocumented scraping of consumer products.
- Circumvention of provider access controls, rate limits, or terms.
- Recreating or migrating the retired AUMTP project as a prerequisite.
- Using an LLM's self-assessment as the sole factual-accuracy check.

## 6. Users and permissions

### 6.1 Roles

| Role | Permissions |
| --- | --- |
| Workspace administrator | Configure sources, credentials, providers, retention, users, and budgets |
| Measurement owner | Create panels, start runs, approve method changes, publish reports |
| Reviewer | Review and correct extracted labels; flag factual issues |
| Contributor | Add proposed questions, target pages, approved message points, and content changes |
| Viewer | View published reports and raw evidence permitted by workspace policy |

These are proposed workflow roles, not current product permissions. Current Page Evidence has no workspace authorization system; any hosted identity/role model requires separate approval. A local-first slice should retain private profile/state isolation.

## 7. Integration contract with Page Evidence

A future approved implementation must reconcile these proposed responsibilities with the existing CLI/MCP architecture; the platform services below do not currently exist unless explicitly noted.

### 7.1 Proposed platform requirements — not current capabilities

- Workspace, project, user, and role identity.
- Authentication and authorization.
- Secret and credential storage.
- Job scheduling and background execution.
- Queueing, retries, and rate-limit handling.
- Relational or document storage.
- Object/blob storage for raw response artifacts.
- Audit logging.
- Connector registration and health status.
- Report rendering and navigation shell.
- Notification infrastructure, if available.

### 7.2 This module provides

- Topic, panel, question, prompt-version, and target-page models.
- Answer-provider adapter contract.
- Observation orchestration rules.
- Raw-answer and citation artifact conventions.
- Entity, citation, prominence, accuracy, and stability classification.
- Search Console query/page normalization for this use case.
- Long-tail discovery and qualification workflow.
- Content-intervention linkage.
- Search and AI-answer reports.
- Module-specific exports and review queues.

### 7.3 Fallback rule

Missing platform services are scope decisions, not permission to build abstractions. First propose the smallest reusable local-first slice and obtain approval for new storage, scheduling, authorization, hosting or provider boundaries. Keep provider mechanics separate from common evidence rules; do not build a platform framework preemptively.

## 8. Conceptual architecture

```text
Page Evidence workspace and permissions
                |
                +-------------------------------+
                |                               |
        Search connectors                Question panels
        (GSC initially)                         |
                |                        Run orchestrator
                |                               |
                |                    +----------+----------+
                |                    |                     |
                |              API adapters       Assisted capture/import
                |                    |                     |
                |                    +----------+----------+
                |                               |
                +------> Normalization and evidence store <------+
                                        |
                             Extraction and review
                                        |
                       Metrics, comparisons, and reports
                                        |
                       Content-change/action correlation
```

## 9. Domain model

Names may be adapted to Page Evidence conventions, but the logical separation must remain.

### 9.1 Topic cluster

Groups related buyer questions, search queries, target pages, markets, and content interventions.

Required fields:

- `id`
- `workspace_id`
- `name`
- `description`
- `status`: `draft | active | archived`
- `default_market`
- `default_language`
- `created_at`, `created_by`
- `updated_at`, `updated_by`

### 9.2 Question panel

A frozen collection used for comparable runs.

Required fields:

- `id`
- `topic_cluster_id`
- `name`
- `version`
- `status`: `draft | active | superseded | archived`
- `valid_from`, `valid_to`
- `change_reason`
- `methodology_version`
- `created_at`, `created_by`

Changing question wording, composition, market, language, or execution method creates a new panel version. Historical panels remain available.

### 9.3 Question

Required fields:

- `id`
- `panel_id`
- `stable_question_key`
- `prompt_text`
- `variant_type`: `canonical | paraphrase | exploratory`
- `paraphrase_group_id`
- `intent`: `learn | compare | validate | implement | buy`
- `audience`
- `market`
- `language`
- `priority`: `core | supporting | exploratory`
- `expected_entity_ids[]`
- `target_page_ids[]`
- `approved_message_set_id`, nullable
- `active`
- `added_reason`

### 9.4 Provider surface

Separates an underlying provider/model from the surface actually observed.

Required fields:

- `id`
- `provider_name`
- `surface_name`
- `surface_type`: `api | consumer_product | manual_import`
- `adapter_key`, nullable
- `configuration_version`
- `retrieval_enabled`: `true | false | unknown`
- `market_behavior`: documented configuration or `unknown`
- `enabled`
- `terms_reviewed_at`, nullable

### 9.5 Observation run

Represents one scheduled, manual, or imported measurement window.

Required fields:

- `id`
- `workspace_id`
- `panel_id`
- `run_type`: `baseline | weekly_pulse | monthly_panel | post_change | ad_hoc`
- `status`: `queued | running | partial | completed | failed | cancelled`
- `scheduled_for`
- `started_at`, `completed_at`
- `methodology_version`
- `provider_surface_ids[]`
- `repetitions_requested`
- `budget_limit`
- `initiated_by`
- `failure_summary`, nullable

### 9.6 Observation

One question, provider surface, and repetition.

Required fields:

- `id`
- `run_id`
- `question_id`
- `provider_surface_id`
- `repetition_number`
- `status`: `pending | succeeded | failed | excluded`
- `requested_at`, `received_at`
- `visible_model_name`, nullable
- `provider_model_identifier`, nullable
- `provider_request_id`, nullable
- `market`
- `language`
- `session_state`: `fresh | authenticated | anonymous | unknown`
- `retrieval_state`: `enabled | disabled | unknown`
- `request_configuration_json`
- `raw_response_artifact_id`
- `raw_citation_artifact_id`, nullable
- `latency_ms`, nullable
- `estimated_cost`, nullable
- `error_code`, `error_detail`, nullable
- `method_compatible`: boolean
- `incompatibility_reason`, nullable

### 9.7 Citation

Required fields:

- `id`
- `observation_id`
- `raw_url`
- `canonical_url`
- `domain`
- `position`, nullable
- `anchor_or_label`, nullable
- `owned_domain`: boolean
- `target_page_match`: boolean
- `relevance_label`: `relevant | partly_relevant | irrelevant | unreviewed`
- `extraction_version`
- `review_status`

### 9.8 Observation classification

Keep machine output and human decisions separate.

Required fields:

- `observation_id`
- `classification_version`
- `entity_mentioned`: boolean
- `entity_matches[]`
- `prominence`: `primary | shortlist | passing | absent | unclear`
- `message_accuracy`: `correct | partly_correct | materially_wrong | not_applicable | unreviewed`
- `accuracy_notes`, nullable
- `competitor_entities[]`
- `machine_confidence`, nullable
- `human_review_status`: `unreviewed | confirmed | corrected`
- `reviewed_by`, `reviewed_at`, nullable
- `human_override_json`, nullable

### 9.9 Search snapshot

Required fields:

- `id`
- `workspace_id`
- `topic_cluster_id`
- `source`: `google_search_console`
- `period_start`, `period_end`
- `comparison_start`, `comparison_end`
- `reporting_lag_days`
- `filters_json`
- `source_fetched_at`
- `query_page_row_count`
- `page_total_row_count`
- `truncation_or_privacy_notes`
- `artifact_id`

### 9.10 Qualified long-tail query

Required fields:

- `id`
- `topic_cluster_id`
- `query_normalized`
- `query_original_examples[]`
- `first_seen_at`
- `last_seen_at`
- `weeks_observed`
- `impressions_total`
- `relevance_status`: `pending | qualified | rejected`
- `intent`, nullable
- `mapped_question_id`, nullable
- `mapped_target_page_id`, nullable
- `reviewed_by`, `reviewed_at`, nullable

### 9.11 Content intervention

Required fields:

- `id`
- `topic_cluster_id`
- `target_page_id`
- `title`
- `hypothesis`
- `change_summary`
- `status`: `proposed | approved | implemented | dismissed | reviewed`
- `baseline_search_snapshot_id`, nullable
- `baseline_observation_run_id`, nullable
- `implemented_at`, nullable
- `review_after`
- `success_measures[]`
- `owner`
- `outcome_notes`, nullable

## 10. Configuration examples

### 10.1 Question record

```yaml
stable_question_key: enterprise-multisite-fit
prompt_text: Can an enterprise use Umbraco for multi-site and multi-market content?
variant_type: canonical
intent: validate
audience: it-leader
market: GB
language: en
priority: core
expected_entities:
  - umbraco
target_pages:
  - https://example.com/enterprise-page
approved_message_set: enterprise-core-v1
```

### 10.2 Observation envelope

```json
{
  "runId": "run_123",
  "questionId": "question_456",
  "providerSurface": "provider-api-search-enabled",
  "repetition": 1,
  "method": {
    "market": "GB",
    "language": "en",
    "sessionState": "fresh",
    "retrievalState": "enabled",
    "configurationVersion": "provider-config-v3"
  },
  "rawResponseArtifactId": "artifact_789",
  "citations": [],
  "status": "succeeded"
}
```

## 11. Functional requirements

### FR-1: Create and freeze a question panel

The user can create a topic cluster, add questions and paraphrases, assign metadata, validate required fields, and activate a versioned panel.

Acceptance conditions:

- An active panel cannot be silently edited.
- Editing an active panel creates a new draft version.
- A diff shows added, removed, and changed questions and method settings.
- Reports identify the exact panel version used.

### FR-2: Configure provider surfaces

An administrator can add supported provider credentials, select a surface, configure permitted settings, test connectivity, and see health status.

Acceptance conditions:

- Credentials never appear in logs, exports, raw artifacts, or client responses.
- API and consumer-product surfaces are visibly distinct.
- Unsupported or unknown settings are stored as `unknown`, not guessed.
- A failed provider does not prevent other providers from completing.

### FR-3: Execute repeated observation runs

The system can run every eligible panel question against selected surfaces for a configured number of repetitions.

Acceptance conditions:

- Default repetitions: two.
- The job is idempotent for the tuple `run + question + surface + repetition`.
- Retries do not create duplicate successful observations.
- Partial completion is a supported run state.
- Cost and request ceilings can stop a run safely.

### FR-4: Import assisted product-interface observations

A reviewer can create an observation by pasting or uploading a raw answer and its visible citations, then record required context.

Acceptance conditions:

- Required context includes product surface, date/time, market, language, session state, and visible model when available.
- The system labels missing context as `unknown`.
- Imported observations are visibly marked and never mixed invisibly with API results.
- Screenshot or source artifact attachment is supported when workspace policy permits it.

### FR-5: Preserve raw evidence

The system stores the original answer, provider payload where permitted, visible citations, request metadata, and artifact checksum.

Acceptance conditions:

- Raw artifacts are immutable.
- Corrections create classification revisions rather than modifying raw data.
- Each report row can open or reference the underlying evidence.
- Export preserves observation and artifact identifiers.

### FR-6: Detect entity mentions

The system detects configured brand/entity aliases in the answer text.

Acceptance conditions:

- Alias matching is workspace-configurable.
- Matching handles case, punctuation, and unambiguous variants.
- Ambiguous aliases require review or a context rule.
- The extraction version is stored.

### FR-7: Extract and normalize citations

The system extracts cited URLs or structured citations and normalizes them without destroying the raw form.

Acceptance conditions:

- Preserve `raw_url` and derive `canonical_url` separately.
- Normalize scheme/host casing, fragments, standard ports, and configured tracking parameters.
- Do not merge distinct paths solely because titles are similar.
- Owned-domain and target-page matching use configured domain rules.
- Citation relevance remains reviewable.

### FR-8: Classify prominence

The system assigns one of five prominence labels: primary, shortlist, passing, absent, or unclear.

Guidance:

- `primary`: presented as the main answer or first explicit recommendation.
- `shortlist`: included among a bounded group of substantive options.
- `passing`: named incidentally or outside the central recommendation.
- `absent`: expected entity not named.
- `unclear`: answer structure does not support a defensible label.

Machine output may propose the label; a reviewer can correct it.

### FR-9: Review message accuracy

The system compares relevant statements with a versioned set of approved message points and routes uncertain or negative results for human review.

Acceptance conditions:

- The approved message set and its version are stored with the review.
- The allowed labels are correct, partly correct, materially wrong, not applicable, and unreviewed.
- The system never silently treats “no contradiction detected” as “correct.”
- Materially wrong observations appear in an exception report.
- Human notes can cite the exact answer passage and approved reference.

### FR-10: Calculate stability

The system calculates agreement across repeated observations within the same method-compatible cell.

A cell is defined by:

`panel version + question/paraphrase + provider surface + configuration version + market + language + measurement window`.

At minimum, stability reports agreement for:

- entity mention;
- owned citation;
- target-page citation;
- prominence band; and
- main recommended entity where extractable.

Do not combine observations with incompatible methods.

### FR-11: Ingest Search Console evidence

The system retrieves query/page and independent page-total evidence for configured properties and topic filters.

Acceptance conditions:

- Default reporting period is 28 days ending three days ago.
- Default comparison is the preceding equivalent period.
- The user can set property, page, country, device, and query filters.
- Query/page rows are not presented as complete property totals.
- Privacy suppression, row limits, and truncation are disclosed.
- Search evidence remains separate from answer-engine observations.

### FR-12: Discover long-tail queries

The system identifies newly observed non-brand queries and places them in a qualification queue.

Default qualification proposal:

- query is relevant to an active topic cluster; and
- query appears in at least two distinct weekly windows, or a reviewer explicitly qualifies it as high intent.

The thresholds must be configurable. The system must not infer commercial search volume from impressions.

### FR-13: Map questions, queries, and target pages

The user can map a buyer question to related observed search queries and intended pages.

The report must identify:

- intended page appears;
- unintended page appears;
- multiple owned pages compete;
- no owned page appears; or
- insufficient evidence.

### FR-14: Record content interventions

The user can record a proposed or implemented page change and attach baseline snapshots and review dates.

Acceptance conditions:

- Implemented actions require a timestamp and owner.
- Baseline references are immutable.
- The review compares defined before/after periods.
- Results are labelled observational, not causal.
- Confounding events can be added as annotations.

### FR-15: Generate reports

The system provides weekly pulse, monthly panel, and post-change reports.

Every report must include:

- methodology and date window;
- panel and configuration versions;
- completed, failed, and excluded observation counts;
- numerator and denominator for every rate;
- search evidence and AI-answer evidence in separate sections;
- changes versus a compatible prior period;
- factual-accuracy exceptions;
- unstable questions;
- newly qualified long-tail queries;
- page mismatches;
- relevant content interventions; and
- links or identifiers for raw evidence.

### FR-16: Export evidence

Users with permission can export:

- question registry;
- run metadata;
- observation classifications;
- citation records;
- search snapshots;
- long-tail qualification records;
- content interventions; and
- aggregate report data.

CSV supports analysis; JSON preserves nested metadata and identifiers. Raw artifacts follow workspace retention and access policy.

## 12. Metrics and formulas

### 12.1 Search question coverage

```text
tracked buyer questions with at least one mapped, relevant GSC query impression
-------------------------------------------------------------------------
eligible tracked buyer questions
```

This requires a maintained question-to-query mapping. It is not calculated through unrestricted semantic guessing without review.

### 12.2 Top-10 search coverage

```text
eligible query groups with the intended owned page in positions 1–10
------------------------------------------------------------------
eligible query groups with observed impressions
```

Report top 3, top 10, and top 20 distributions separately.

### 12.3 New qualified long-tail queries

Count queries first qualified during the selected period. Also show how many were machine-proposed, accepted, and rejected.

### 12.4 Answer-engine mention rate

```text
eligible successful observations that mention the configured entity
-------------------------------------------------------------------
eligible successful observations
```

Failed, excluded, and method-incompatible observations are reported but not silently included in the denominator.

### 12.5 Owned citation rate

```text
eligible successful observations with at least one owned-domain citation
-----------------------------------------------------------------------
eligible successful observations
```

### 12.6 Target-page citation rate

```text
eligible successful observations citing an intended target page
----------------------------------------------------------------
eligible successful observations
```

### 12.7 Observation stability

For a binary property such as entity mention:

```text
method-compatible repeated cells with full agreement
----------------------------------------------------
method-compatible repeated cells with >= 2 observations
```

Also expose the distribution rather than only the aggregate.

### 12.8 Message accuracy

Show counts and rates for reviewed observations only. Always display unreviewed volume separately.

### 12.9 Search position

Store the source-provided position and report both:

- impression-weighted average position; and
- median position across eligible query groups.

Never describe either as a fixed rank experienced by every searcher.

## 13. Reporting views

### 13.1 Executive view

- What changed materially?
- Is the evidence stable?
- Which buyer questions gained or lost coverage?
- Are any descriptions materially wrong?
- What requires a decision or content action?

### 13.2 Topic view

- Search coverage and long-tail discovery.
- Mention and citation rates by surface.
- Target-page selection.
- Accuracy exceptions.
- Active interventions and review dates.

### 13.3 Question matrix

Rows are buyer questions; columns are provider surfaces and search evidence. Each cell shows repetitions, mention, citation, prominence, stability, and raw evidence.

### 13.4 Page view

- Related questions and search queries.
- Search totals and position distribution.
- AI-answer citations to the page.
- Competing or unintended owned pages.
- Content interventions.
- Optional page-readiness findings.

### 13.5 Methodology view

- Panel version and changes.
- Providers, surfaces, models, markets, languages, retrieval state, and repetition count.
- Exclusions and incompatibilities.
- Extraction/classification versions.
- Known limitations.

## 14. Scheduling defaults

### Weekly pulse

- 10–12 core canonical questions.
- Selected high-priority provider surfaces.
- Two repetitions per cell.
- Matching GSC refresh when source limits permit.

### Monthly panel

- All 30–40 initial questions.
- Canonical question and one controlled paraphrase.
- Two repetitions per cell.
- Full human review of negative accuracy findings and a sample of positive labels.

### Post-change review

- Uses the same panel and compatible method as the baseline.
- Runs only after a configured review date.
- Includes search and crawl/index lag warnings.
- Does not claim causality.

## 15. Adapter contract

Each automated answer provider implements a common contract equivalent to:

```ts
interface AnswerObservationAdapter {
  key: string;
  validateConfiguration(config: unknown): Promise<ValidationResult>;
  estimateRunCost(input: ObservationRequest[]): Promise<CostEstimate>;
  observe(input: ObservationRequest): Promise<ObservationResult>;
  healthCheck(): Promise<AdapterHealth>;
}
```

`ObservationResult` must include:

- success or typed failure;
- provider request identifier when available;
- returned text or artifact reference;
- structured citations when available;
- visible/provider model identifier when available;
- response metadata permitted for storage;
- timing and cost data when available; and
- warnings about missing or unknown method fields.

Provider-specific parsing must remain inside the adapter. Core reporting consumes the normalized observation model.

## 16. API or service operations

Current Page Evidence exposes CLI commands and stdio MCP tools, not an HTTP application API. The HTTP paths below are conceptual operation names only. Prefer existing CLI/MCP seams for an approved local-first slice; introducing HTTP transport requires separate approval.

- `POST /topic-clusters`
- `POST /question-panels`
- `POST /question-panels/{id}/activate`
- `GET /question-panels/{id}/diff/{otherVersion}`
- `POST /provider-surfaces/{id}/test`
- `POST /observation-runs`
- `GET /observation-runs/{id}`
- `POST /observations/import`
- `GET /observations/{id}/evidence`
- `POST /observations/{id}/review`
- `POST /search-snapshots`
- `GET /long-tail-queries?status=pending`
- `POST /long-tail-queries/{id}/review`
- `POST /content-interventions`
- `POST /reports/weekly`
- `POST /reports/monthly`
- `GET /exports/{type}`

Mutating operations require authorization and create audit records.

## 17. Non-functional requirements

### 17.1 Security

- Define credential storage for the approved deployment. Current Page Evidence uses private environment configuration and local tokens, not a managed encrypted secret service.
- Apply least-privilege and read-only source scopes where possible.
- Redact credentials and authorization headers from logs and artifacts.
- Restrict raw-answer access by workspace role.
- Validate imported files and enforce size/type limits.
- Apply SSRF protections to any URL retrieval or page inspection.
- Maintain an auditable record of configuration and review changes.

### 17.2 Privacy

- Do not send visitor-level analytics or personal data to answer providers.
- Store only aggregate Search Console/analytics evidence required by the module.
- Define workspace-configurable retention for raw response artifacts.
- Support deletion required by workspace policy without corrupting aggregate audit history; retain tombstone metadata where lawful and appropriate.

### 17.3 Reliability

- Runs are resumable after worker failure.
- Retries use exponential backoff and provider-aware limits.
- One provider failure does not fail the whole run.
- Idempotency prevents duplicate observations.
- Artifact checksums detect corruption.
- Completed report calculations are reproducible from stored normalized data.

### 17.4 Cost control

- Estimate cost before an automated run.
- Support workspace, provider, run, and monthly ceilings.
- Stop safely before exceeding a hard ceiling.
- Show estimated and actual cost where providers expose usage.
- Allow core-only weekly schedules separate from full monthly panels.

### 17.5 Performance

- Run execution is asynchronous.
- The UI must remain responsive while a run is in progress.
- Paginate observation and citation tables.
- Precompute report aggregates after run/review completion.
- Raw artifacts load on demand rather than in list responses.

### 17.6 Accessibility

- Status and changes cannot rely on color alone.
- Tables, filters, review controls, and evidence drawers are keyboard accessible.
- Charts have equivalent text/table representations.

## 18. Observability and operational controls

Track:

- queued, running, completed, partial, failed, and cancelled runs;
- provider success and typed failure rates;
- request counts, latency, retries, and throttling;
- estimated and actual cost;
- extraction failures;
- observations waiting for review;
- Search Console connector freshness;
- artifact write/read failures; and
- scheduler drift.

Alerts should distinguish product failures from expected provider variance. A changed answer is not an operational error.

## 19. Comparison compatibility rules

A period comparison is compatible only when the following match or have an explicitly approved compatibility mapping:

- stable question or paraphrase identity;
- panel methodology version;
- provider surface;
- provider configuration version;
- market and language;
- retrieval state;
- session-state class;
- repetition policy; and
- classification definition.

If a provider silently changes a model or interface and the version is unknown, flag the comparison with reduced confidence instead of treating it as fully equivalent.

## 20. Testing strategy

### 20.1 Unit tests

- Prompt/panel versioning.
- Entity alias matching and ambiguity rules.
- URL normalization.
- Owned-domain and target-page matching.
- Metric numerators and denominators.
- Stability calculations.
- Compatibility decisions.
- Long-tail qualification thresholds.
- Idempotency keys.

### 20.2 Contract tests

- Each provider adapter against recorded fixtures.
- Search Console connector normalization.
- Artifact store read/write/checksum behavior.
- Export schemas.

### 20.3 Integration tests

- Create panel → run observations → extract → review → report.
- Partial provider failure.
- Retry without duplicate observations.
- Panel version change and incompatible comparison.
- Search snapshot joined to topic and target page.
- Content intervention baseline and follow-up.

### 20.4 Golden-data tests

Maintain a small reviewed fixture set containing:

- direct brand mention;
- alias mention;
- no mention;
- owned and third-party citations;
- irrelevant citation;
- primary, shortlist, passing, and unclear prominence;
- correct, partly correct, and materially wrong statements; and
- repeated stable and unstable cells.

Extraction changes must show their effect on this fixture set before release.

### 20.5 Security tests

- Credential redaction.
- Role enforcement.
- Imported file validation.
- URL fetch/SSRF controls.
- Cross-workspace data isolation.
- Audit-log completeness.

## 21. Release acceptance criteria

The first usable release is accepted when:

- A user can create and freeze a versioned question panel.
- The same panel can be rerun without reconstructing its method.
- At least one API provider adapter completes repeated observations.
- Product-interface observations can be imported with required context.
- Every reported mention and citation resolves to stored raw evidence.
- Raw artifacts remain unchanged after human correction.
- Rates display both numerator and denominator.
- Search Console query/page evidence and page totals are handled separately.
- New long-tail queries enter a human qualification queue.
- A reviewer can correct entity, citation relevance, prominence, and accuracy labels.
- Stability is calculated only from method-compatible repeated cells.
- A content intervention can reference immutable baseline snapshots.
- Weekly and monthly reports separate observations, diagnoses, and hypotheses.
- Provider failures produce partial runs rather than corrupt results.
- Credentials do not appear in logs or exports.
- CSV and JSON exports reproduce the displayed aggregates.
- A weekly pulse can be run and reviewed in under one hour, excluding provider wait time.

## 22. Delivery plan

### Phase 0: map the Page Evidence foundation

Deliverables:

- Use the verified architecture to identify reusable configuration, SQLite state, connectors and reports. Explicitly decide whether any workspace/auth, managed secret, job, blob-store or audit-log requirement belongs in an approved local-first slice; these services are not provided by the current product.
- Record architecture decisions for missing services.
- Select the first Search Console property and first supported answer adapter.
- Confirm data-retention and provider-terms constraints.

Exit condition: module boundaries and platform dependencies are agreed.

### Phase 1: evidence model and manual baseline

Deliverables:

- Topic clusters, panel/version, questions, targets, runs, observations, citations, classifications, and interventions.
- Assisted observation import.
- Raw artifact storage.
- Human review UI.
- CSV/JSON export.
- Manually initiated baseline report.

Exit condition: a full baseline can be stored, reviewed, and reproduced without automated provider execution.

### Phase 2: automated observation runner

Deliverables:

- Adapter contract.
- First API adapter.
- Scheduler/queue integration.
- Repetitions, idempotency, retries, partial-run handling, cost limits, and health status.
- Automated mention and citation extraction.
- Stability metrics.

Exit condition: the same panel can run automatically and every aggregate links to raw evidence.

### Phase 3: Search Console and long-tail layer

Deliverables:

- Search Console connector integration.
- Equivalent-period snapshots.
- Query/page and page-total handling.
- New-query detection and qualification queue.
- Question/query/page mapping.
- Search coverage and position distributions.

Exit condition: search and answer observations appear together but remain methodologically separate.

### Phase 4: reports and intervention review

Deliverables:

- Weekly pulse and monthly panel reports.
- Accuracy and instability exceptions.
- Content-intervention baseline and follow-up views.
- Methodology compatibility warnings.
- Notifications for completed runs and material review items.

Exit condition: the module supports a repeatable operating cadence and informs a real content decision.

### Phase 5: hardening and expansion

Deliverables:

- Additional providers or permitted product-surface capture.
- Optional page-readiness and verified analytics integrations.
- Performance, accessibility, security, retention, and cost hardening.
- Documentation and operator runbook.

Exit condition: new providers can be added through the adapter contract without changing core metrics or evidence rules.

## 23. Suggested GitHub epics

1. **Module foundation and Page Evidence integration**
2. **Question registry and panel versioning**
3. **Observation and immutable artifact storage**
4. **Assisted capture and human review**
5. **Answer-provider adapter framework**
6. **Automated entity and citation extraction**
7. **Prominence, accuracy, and stability**
8. **Search Console evidence ingestion**
9. **Long-tail discovery and qualification**
10. **Question/query/page mapping**
11. **Content intervention and baseline review**
12. **Weekly/monthly reporting and exports**
13. **Security, cost controls, and observability**
14. **Documentation and operator runbook**

Each epic should be split into vertical slices that leave the system demonstrably usable. Do not build all storage and adapters before producing the first reviewable baseline report.

## 24. Initial pilot recommendation

Use one coherent topic cluster with 30–40 questions, two or three relevant provider surfaces, one market, and one language.

For the initial Umbraco use case, an enterprise evaluation cluster could cover:

- enterprise CMS suitability;
- migration and modernization;
- multi-site and multi-market operation;
- composable architecture;
- Cloud hosting and operating responsibility;
- editor and developer experience;
- implementation through partners; and
- evidence from real customer cases.

The exact wording, target pages, and approved message points must be confirmed before the baseline panel is activated.

## 25. Open decisions

These decisions must be recorded in the Page Evidence repository before Phase 1 closes:

1. Which proposed platform requirements can be dropped or deferred to preserve the verified local-first CLI/MCP architecture?
2. What does “site signal” already store, and which identifiers should this module reuse?
3. Which answer-provider adapter is first?
4. Which consumer product surfaces warrant assisted sampling?
5. Which markets and languages are in the first quarter?
6. What are the workspace retention rules for raw answers and screenshots?
7. Who approves question panels and methodology changes?
8. Who owns monthly factual-accuracy review?
9. Which owned domains and entity aliases are authoritative?
10. Which analytics events, if any, are verified enough for a later integration?
11. What cost ceiling applies per weekly and monthly run?
12. What provider or interface changes make a time-series comparison incompatible?

## 26. Definition of success

The module succeeds when it changes a decision with inspectable evidence—for example:

- identifying a buyer question for which search impressions are emerging but no intended page ranks;
- showing that an unintended page is cited instead of the preferred source;
- detecting a repeated, materially wrong description that requires clearer source content;
- demonstrating that an observation is too unstable to justify action; or
- linking a content intervention to directional movement across search, citations, and site journeys without overstating causality.

The valuable asset is not a proprietary score. It is the versioned question panel, immutable evidence, transparent method, and decision history held inside Page Evidence.
