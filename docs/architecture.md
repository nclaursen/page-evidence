# Page Evidence architecture

## Audit scope and conclusion

Verified against package version `0.9.0`, Git base `c0f3ca9`, on 2026-10-11 by inspecting source, tests, configuration examples, and release workflow. This package has an independent Git root at `site-signal/` inside the audited Astro website checkout; its metadata names `nclaursen/page-evidence` as the canonical repository. Paths here are relative to this document unless shown as code.

**The current package largely follows a shared-product model, with gaps.** GA4, Matomo, Engage, and GSC-only profiles use the same orchestration, analytical rules, reports, CLI, and MCP server. Core responsibilities span several modules, not only `core.ts`; there are no organization-specific deployment directories or separate Umbraco/personal engines in this package. Provider assumptions and isolation gaps remain; see the prioritized [architecture backlog](architecture-backlog.md).

The user identifies Umbraco and personal instances. This audit verified support and documented representative profiles, not private env files, deployed clones, installed versions, MCP host configuration, credentials, or live API behavior. It cannot establish that both running instances currently use the same build. Airtable access elsewhere does not establish a Page Evidence connector.

## Implementation update — 16 October 2026

The shared core now binds new snapshots to versioned configuration identity, uses host-aware page keys for evidence matching, and includes build/test CI. See [identity and compatibility](evidence-identity.md) for the accepted policy, legacy-history transition and residual action-directory boundary. The original audit below remains the source for other findings; affected current-state statements have been updated.

Query-to-page drift now has a shared pure analysis module and a GSC-only cached service, exposed through one additive CLI/MCP tool. See [its contract](query-page-drift.md). The seven remaining missing IDs in the authorised personal log were repaired with backup and content preservation; no automatic legacy migration was introduced.

## Responsibility model

These are ownership boundaries, not a required directory layout or an approved refactor.

| Responsibility | Development rule | Current implementation |
| --- | --- | --- |
| Shared core | Own reusable analysis/reporting, processing/normalization, common rules, validation/error contracts, workflows, integration interfaces, configuration schemas, MCP functionality, and reusable UI if introduced | [core.ts](../src/core.ts) holds common types, env parsing, URL normalization, periods, storage, and basic rules; [service.ts](../src/service.ts) orchestrates evidence and reports; [digest.ts](../src/digest.ts), [action-review.ts](../src/action-review.ts), [freshness.ts](../src/freshness.ts), and [search-opportunities.ts](../src/search-opportunities.ts), and [query-page-drift.ts](../src/query-page-drift.ts) own reusable rules. No UI exists. Configuration is typed but lacks a comprehensive runtime schema. |
| Provider adapters | Own authentication, external API behavior, paging, external field mapping, provider-specific checks, capability/coverage metadata; expose reusable evidence without leaking provider assumptions | [google.ts](../src/google.ts) implements Google OAuth/GSC; [analytics.ts](../src/analytics.ts) defines the analytics interface, concrete adapters, factory, and GA4-only outcome access. [ahrefs-csv.ts](../src/ahrefs-csv.ts) imports external search evidence against [external-search.ts](../src/external-search.ts). |
| Instances | Select providers; configure credentials/connections, identity, deployment, feature/organization settings; keep genuinely custom business behavior behind explicit extensions | [core.ts](../src/core.ts) reads private environment configuration. One process handles one profile and one analytics provider. No instance-specific implementation is required for current functionality; deployment definitions/private configuration are outside this audited package. |

The enclosing checkout also contains `../private-site-assistant/`, outside this product's Git root. It independently implements Google access, personal configuration, normalization, analysis, storage, reports, and MCP tools; it does not import/depend on Page Evidence. Its rules and formats differ (for example, a 28-day comparison and different decline gates). This is verified duplication, not evidence that it is the active personal Page Evidence instance. Do not extend it as a parallel Page Evidence core; any consolidation needs separate approval and migration review.

## Provider contracts and capability differences

The implemented `AnalyticsProvider` in [analytics.ts](../src/analytics.ts) exposes `name`, `capabilities(): string[]`, `landingEvidence(period): Promise<AnalyticsEvidence>`, and optional `health(): Promise<ProviderHealth>`. Factory selection is static; adding an analytics provider currently involves the provider-name union/configuration, factory, adapter, and affected contracts/tests. GSC has concrete functions rather than a general search-provider interface.

`AnalyticsEvidence` in [core.ts](../src/core.ts) includes provider identity, metric labels, rows (`url`, nullable acquisition, nullable metric values), site-level source summaries, coverage/limitations, and optional metric availability, fetch time, period, and source/version metadata. Availability entries have `{available: boolean, reason?: string}`; they are not plain booleans. Health states distinguish availability, authentication, permissions, and incompatibility, but only Engage implements live `health()`. GA4/Matomo configured status does not prove live access.

| Adapter | Current evidence/API | Explicit limits |
| --- | --- | --- |
| GSC | Search Analytics finalized page, query/page, country/device/search-appearance rows via Google OAuth | Required for current shared reports/investigations, including GSC-only mode. Top-row evidence can be incomplete; query examples are not query-attributed analytics. Page/site queries page through a configured cap; per-page query fetches have a 5,000-row cap. |
| GA4 | Data API landing page + session source/medium; sessions, engaged sessions, engagement rate | One capped report per period; optional configured outcome events are property-level event counts. No query attribution. |
| Matomo | HTTPS Reporting API POST to `index.php`, `Actions.getPageUrls` and `Referrers.getReferrerType` | Page visits/pageviews/entries/rate fields; acquisition on page rows is `null`, referrer context is site-level. Capped retrieval, no implemented paging loop. Missing numeric values stay `null`, though availability metadata currently marks configured metrics available. |
| Umbraco Engage | Management API token, package, and aggregated analytics query endpoints; code targets majors 17/18 | Paginated page metrics and returned goals; no acquisition-source evidence, visitor profiles, heatmaps, writes, or report regeneration. Missing columns are unavailable. Normalized duplicates sum only additive metrics. Live installation compatibility remains unverified here. |
| `none` | Empty analytics evidence with an explicit GSC-only limitation | No analytics capabilities; preserves GSC analysis. |
| Ahrefs CSV | Local Organic Keywords import, normalized schema/provenance/diagnostics | An external search import, not an analytics provider. No live Ahrefs API, DataForSEO, or universal external-provider registry. |
| Airtable | None in this package | No connector, configuration contract, or MCP endpoint is implemented. |

Keep source semantics separate: GSC dates use Pacific time, GA4 dates follow its property timezone; Matomo installation timezone needs validation, and Engage sends UTC boundaries without establishing the installation's reporting timezone. Missing, unsupported, observed zero, failure, and partial coverage must remain distinguishable. Current capability strings are descriptive rather than a typed capability-negotiation protocol. Known deviations in measurement readiness are backlog items, not an excuse to assume provider equivalence.

See [provider notes](analytics-providers.md) for setup and consented live-test checklists, [search opportunity contracts](search-opportunities.md) for import/analysis limits, and [SECURITY.md](../SECURITY.md) for credential/endpoint restrictions.

## Instance configuration and storage

[.env.example](../.env.example) is the safe setup reference. `config()` reads `PAGE_EVIDENCE_PROFILE`, `SITE_DOMAIN`, `GSC_PROPERTY`, `ANALYTICS_PROVIDER`, provider connection variables, data directory, limits/lag, tracking parameters, optional repository/sitemap, and optional GA4 outcome names. It does not define an arbitrary organization-settings or extension-loader schema.

| Representative instance | Source selection | Separation required |
| --- | --- | --- |
| Personal / nclaursen.dk | GSC + GA4 | Own profile, private env, OAuth token, and data directory |
| Umbraco | GSC + Matomo; alternatively Engage when explicitly selected | Own profile, private env, credentials, and data directory for each selection |
| Future instance | Same core + supported adapter selection, or GSC + `none` | No copied engine; separately configured connections/state |

These are representative configurations, not audited deployment manifests. The process does not switch profiles per MCP call or combine multiple analytics providers. An Umbraco instance is not synonymous with the Engage adapter: Engage is an optional reusable provider.

Provider selection defaults to GA4 if `GA4_PROPERTY_ID` exists, otherwise `none`. Profile defaults to `default`. New `PAGE_EVIDENCE_*` names take precedence over their implemented `SITE_SIGNAL_*` aliases; `PRIVATE_SITE_DATA_DIR` is a legacy data-dir fallback. Default state remains `~/.site-signal` (a named profile gets a subdirectory), with `site-signal.sqlite` and private reports/token files. Both executable names, `page-evidence` and legacy `site-signal`, resolve to the same CLI. Preserve these compatibility contracts.

Snapshot IDs include profile, provider, period and a non-secret configuration fingerprint. Payload identity is validated before cache reuse/history/review; legacy snapshots remain stored but are excluded when identity cannot be verified. Action rows still rely on data-directory isolation. Never share or repurpose an instance directory. See [compatibility policy](evidence-identity.md).

## Data flow

1. CLI loads dotenv; built invocations can use Node's private `--env-file`. The direct source MCP entry reads the process environment; `npm run mcp` does not itself import dotenv. Configure its environment explicitly.
2. `config()` selects profile/settings; the service calculates equivalent 7/30/60/90-day periods and checks its local snapshot/cache. Selected adapters fetch current/prior GSC and analytics evidence concurrently; `none` supplies empty analytics evidence.
3. Adapters map API fields and report limits. Core normalization removes configured tracking parameters/fragments while retaining path/query distinctions. The shared `pageKey` preserves host identity for evidence matching and Engage aggregation; external `sitePageKey` delegates to it. Root/www and HTTP/HTTPS aliasing are explicit comparison policies. The path-only helper remains for repository source matching.
4. The service persists private snapshots and runs shared readiness, opportunity, query, digest, history, and action-review rules. External CSV imports persist normalized, profile/site-scoped datasets; the pure search-opportunity engine separates observations, derived results, and explicit user/model assessments.
5. Optional configured local source/sitemap context enriches investigations. Repository discovery currently scans Markdown/MDX/Astro/HTML with direct-reference/filename mapping, excluding dependency directories and local copies named `node_modules.*`, `node_modules 2` or `node_modules-backup`. It is not a general CMS integration. The chat client owns semantic interpretation and editorial proposals; the server calls no model.
6. CLI/MCP return evidence. MCP uses shared query filtering/warnings; local snapshots and generated Markdown/JSON reports retain raw external text. Reports, imports, actions, and digest checkpoints write only local state.

Snapshots expire after 24 hours; per-page query fetches after one hour, with at most 50 in-process entries. Query-cache keys include data directory, evidence fingerprint and period; refresh invalidates the current process/configuration scope, not other servers. Digest checkpoints share that identity and include the selected window and decision threshold. Explicit historical observations remain historical; missing history is not backfilled.

## MCP architecture

[mcp.ts](../src/mcp.ts) registers 23 tools using the MCP server SDK and stdio. There is no hosted HTTP MCP endpoint or website backend. Named MCP host entries can run the same built `dist/cli.js mcp` with separate env files/state. The package publishes a CLI with generated declarations, not a declared library `exports` API.

| Tools | Shared service responsibilities |
| --- | --- |
| `get_site_status`, `get_cache_status`, `refresh_site_evidence`, `get_change_digest` | Setup/provider health, cache controls, evidence retrieval, local checkpoint comparisons |
| `get_page_http_evidence` | Explicit provider-independent selected-page GET: bounded same-site redirects/statuses and static HTML canonical references; no storage or canonical-target fetch |
| `find_content_opportunities`, `find_question_opportunities`, `find_query_page_drift`, `find_search_opportunities`, `import_external_search_evidence` | Shared discovery/gates, bounded enrichment, local normalized imports |
| `get_page_context`, `get_page_investigation_context`, `get_question_page_context`, `get_page_segments`, `get_page_lifecycle`, `get_page_history`, `get_query_entry_exit` | Page/query/segment/history retrieval and source-scoped comparisons |
| `get_measurement_readiness`, `get_repository_context`, `get_internal_link_context` | Optional outcome/acquisition/context evidence |
| `review_local_actions`, `get_action_review_context`, `record_local_action` | Private annotations and descriptive review; no external write or causal claim |

Inputs use bounded Zod schemas; output is JSON encoded in MCP text content. Every handler passes through `safeQueryOutput` via `out`/`queryOut`; query/question-derived content is filtered and all external text carries a warning. This heuristic is not a security boundary. The wrapper does **not** add a universal profile/site/provider envelope: some service responses contain identity, others omit it. Likewise `find_content_opportunities` bounds candidates but still includes full snapshot rows. Preserve existing contracts while planning improvements; do not document uniform identity or response size as already enforced.

Status is not always offline: Engage status invokes live health. Cache status avoids provider calls. Refresh/discovery can fetch providers and persist snapshots; imports/actions/checkpoints mutate local state. No tool writes to analytics, a website, or Airtable.

## Extensions and feature placement

Existing extension seams are static analytics adapters, normalized external evidence, opt-in context configuration, and service functions registered in CLI/MCP. There is no dynamic plugin loader, arbitrary instance hook, shared dashboard, or CMS-neutral repository adapter today. For genuine organization-specific behavior, define the smallest explicit adapter/extension contract in the approved feature plan, keep organization policy outside shared rules, and expose any reusable capability through the core. Do not create a plugin framework preemptively.

Use the five placement questions in [AGENTS.md](../AGENTS.md#core-first-development), inspect existing contracts, then apply this model:

| Requested feature | Placement and compatibility |
| --- | --- |
| New query performance analysis | Shared core analysis, using/extending GSC or relevant provider interfaces. Both instances can use it when required data is available; unavailable evidence remains explicit. |
| Matomo API improvement | Matomo adapter; expose reusable evidence via the shared contract. Do not inject Matomo field/API assumptions into common rules. |
| Generally useful dashboard component | Shared UI if UI is approved; enable/configure per instance. No UI exists to extend today. |
| Umbraco-specific integration | Authentication/API behavior in an adapter or explicit extension; reusable underlying processing in core. Organization policy remains in configuration/custom behavior. |
| Data quality validation | Common checks in core, with provider metadata and provider-specific checks supplied by adapters. Test missing/partial/unsupported evidence across instances. |

Substantial features need a concise saved plan describing placement, smallest reusable approach, both instance implications, acceptance criteria, and validation. Minor changes use the same placement judgment without planning overhead. Preserve approved choices unless a concrete technical conflict requires adjustment.

## Cross-instance validation

Current [tests](../test/) cover common rules, Matomo/Engage adapters, GSC-only behavior, provider status, stored history/reviews, caches/digests, external evidence, rename compatibility, and CLI/MCP safety/contracts with synthetic data and mocked boundaries. GA4/Matomo/Engage receive adapter fixture coverage, with mocked service identity tests across all four provider selections. This is not a complete live two-instance workflow matrix. Tests establish the assertions they exercise, not installed/live compatibility.

For relevant shared changes, validate representative personal (GSC + GA4), Umbraco (GSC + Matomo), Engage-selected, and GSC-only configurations. Include safe defaults/legacy precedence, isolated state, shared outputs, provider-specific labels/scopes, missing/unsupported metrics, partial coverage/failures, cache/history behavior, and affected CLI/MCP schemas. Run common tests against the same synthetic search evidence to detect instance-specific rule drift. Do not add unrelated matrix tests for a documentation edit.

Use package `npm run build` and `npm test` for application changes; targeted tests are supported. `npm run doctor` makes live requests and is reserved for authorized integration verification. Record the actual provider/version/profile scope tested, migrations/config changes needed, and checks not run. Future instances must be able to use shared capabilities without copying code.

## Testing, release, and recorded decisions

[package.json](../package.json) defines TypeScript build, Vitest, source CLI commands, and `prepublishOnly` build → test. It declares Node `>=20`; the audit host has Node `24.13.1`. [vitest.config.ts](../vitest.config.ts) selects `test/**/*.test.ts`. There is no package `check`, `lint`, or SEO command. [publish-release.yml](../.github/workflows/publish-release.yml) creates a GitHub release for an existing version tag when triggered; it does not test/build/deploy instances or prove npm publication. The [package CI](../.github/workflows/ci.yml) now runs build/test on push and pull requests for Node 22/24; the release workflow itself remains unchanged. The enclosing website checks/deployment exclude Page Evidence.

Accepted governance decisions, authorized by the 2026-10-11 documentation task:

- **PE-D001 — One reusable product:** reusable capabilities belong in core, external behavior in adapters, instance differences in configuration or explicit extensions. Prefer small existing seams over forks or speculative generic frameworks. This is a development rule; identified implementation gaps are not resolved by documenting it.
- **PE-D002 — One instruction body:** package `AGENTS.md` owns product guidance; package `CLAUDE.md` imports it. Enclosing website instructions route Page Evidence work here without imposing Astro conventions. Keep these docs with the product when it is checked out independently.

Local-first read-only evidence, stdio transport, one-profile processes, GSC-led analysis, and legacy storage/names are observed current boundaries. Their original approval rationale was not verified, so this audit does not invent historical decisions. The [search/AI observation specification](search-ai-observation-module-spec.md) is an unapproved proposal. Its hosted-platform assumptions and model execution are outside current architecture; it does not authorize hosted services, model calls, schedules, or new integrations. Future accepted material decisions should record date/status, approved scope, rationale/trade-offs, and affected contracts here or in their approved plan.

## Implementation update — 7 November 2026

Shared core now provides descriptive symmetric click-change components in page context and digest changes. Digest orchestration optionally enriches three returned flagged pages using the existing profile-scoped per-page GSC query cache, returning up to five entered/exited rows per group, coverage and isolated failure states. Query periods are the current snapshot's adjacent periods, distinct from rolling digest checkpoint periods. Defaults and storage formats remain unchanged; MCP adds `includeQueries`, CLI adds `--include-queries`.

Local internal-link context adds bounded surrounding excerpts and statically detectable existing-link evidence with explicit parser limits. Editorial interpretation stays in the client. No analytics adapter, dependencies, external writes or migrations were added. See [approved scope and verification](2026-11-07-search-opportunity-plan.md); source tests do not verify installed clients or live providers.

Selected-page HTTP evidence is implemented in the shared [page-http.ts](../src/page-http.ts) module, called explicitly through service/CLI/MCP. It uses native HTTP(S) and DNS, pins validated public addresses per hop, stays within configured root/www hosts and bounds redirects/headers/body/runtime. Existing page investigation and digest tools do not acquire automatic page requests. It returns observed statuses and static HTML canonical references with identity, time, coverage and partial failures; no provider credentials, persistence, new dependency or transport change. See [scope and verification](2026-11-07-http-evidence-plan.md). This does not establish a Google-selected canonical, rendered DOM or live instance compatibility.

## Maintenance verification — 7 November 2026

Finalised the shared instructions and architecture/provider notes against the current source and workflows. Resolved historical C1/C2 findings remain identified as historical; the observation-module specification is an unapproved proposal with explicit missing-platform assumptions. Snapshot fingerprinting and independent build/test CI are documented as implemented.

The shared source scanner excludes local dependency copies with dot, whitespace or hyphen suffixes, covering repository mapping, source excerpts and link candidates without changing provider contracts or stored state. Git ignores dependency directories and the local `node_modules` symlink. The targeted source-context suite passed (18 tests), followed by package build and all 269 tests in 20 files. Verified 77 local documentation links and the Claude instruction import. No provider calls, private configuration access, dependency changes, migrations or architectural deviations were introduced by this cleanup. Earlier selected-page HTTP live checks remain recorded in their feature plan; no running analytics instance compatibility is claimed here.
