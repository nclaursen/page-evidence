# Analytics-provider implementation notes

This document records Page Evidence's implemented analytics-provider contract and setup without turning it into a multi-tenant or hosted service. See [architecture.md](architecture.md) for core/provider/instance responsibilities and [AGENTS.md](../AGENTS.md) for the shared development rules.

## Operating model

One Page Evidence process serves one named site profile:

| MCP entry | Example analytics provider | Private state directory |
| --- | --- | --- |
| `page-evidence-niels` | GA4 | `~/.site-signal/niels` |
| `page-evidence-umbraco` | Matomo | `~/.site-signal/umbraco` |
| `page-evidence-engage` | Umbraco Engage | `~/.site-signal/engage` |

These are representative entries using the same CLI/MCP package, not audited deployment manifests. Each needs its own private environment file and data directory. A profile must never share a snapshot database/token directory with another profile. Current snapshot identifiers include profile, analytics provider, period and a versioned non-secret configuration fingerprint covering site/property and relevant settings. Payload identity is validated before cache reuse, history and action review; unverifiable legacy snapshots remain stored but are excluded. See [evidence identity and compatibility](evidence-identity.md). Action rows also rely on directory isolation; do not repurpose existing state for a different site/property.

This is deliberately **not** one MCP server that switches site at tool-call time. A caller chooses the named MCP server before it asks for data. Snapshots and page-context responses include profile/provider identity, while site/connection scope is bound through snapshot identity. A universal MCP identity envelope is not implemented. Response consistency is an [architecture backlog item](architecture-backlog.md#recommended--material-architecture-improvements).

## Provider boundary

GSC is implemented in `src/google.ts`. `src/analytics.ts` defines the implemented `AnalyticsProvider` interface and selects a concrete adapter from configuration. Its current interface is:

```ts
interface AnalyticsProvider {
  name: AnalyticsProviderName;
  capabilities(): string[];
  landingEvidence(period: Period): Promise<AnalyticsEvidence>;
  health?(): Promise<ProviderHealth>;
}
```

The referenced types are defined in `src/core.ts` and `src/analytics.ts`. `AnalyticsEvidence` includes rows with nullable acquisition/metric values, site-level `sourceSummaries`, labels, coverage, and optional availability/fetch/period/source metadata. Availability is `Record<string, {available: boolean; reason?: string}>`, not a boolean map. Engage implements live health; GA4/Matomo status reports configuration and requires a separate live access check. Capability strings do not guarantee identical provider behavior.

The internal format is intentionally narrow. It supports page context and reports without pretending that different products share identical semantics. Human-facing output must use each provider's original metric labels: for example, a Matomo `visit` must never be displayed as a GA4 `session`.

`none` is a valid provider. It returns no analytics rows plus a clear `analytics not configured` limitation; GSC opportunity discovery remains available.

## Configuration

The public package uses provider selection and profile isolation. All values below are local-only and must stay in a private environment file.

```env
PAGE_EVIDENCE_PROFILE=niels
PAGE_EVIDENCE_DATA_DIR=/absolute/path/to/private/page-evidence/niels
ANALYTICS_PROVIDER=ga4
GA4_PROPERTY_ID=123456789

# Or, for another Page Evidence MCP entry:
PAGE_EVIDENCE_PROFILE=umbraco
PAGE_EVIDENCE_DATA_DIR=/absolute/path/to/private/page-evidence/umbraco
ANALYTICS_PROVIDER=matomo
MATOMO_URL=https://analytics.example.com/
MATOMO_SITE_ID=1
MATOMO_TOKEN_AUTH=replace-with-read-only-token

# Or, for an Umbraco Engage 17/18 profile:
PAGE_EVIDENCE_PROFILE=engage
PAGE_EVIDENCE_DATA_DIR=/absolute/path/to/private/page-evidence/engage
ANALYTICS_PROVIDER=engage
UMBRACO_BASE_URL=https://cms.example.com/
UMBRACO_CLIENT_ID=page-evidence
UMBRACO_CLIENT_SECRET=replace-with-api-user-secret
```

GSC configuration remains per profile. The Matomo and Umbraco base URLs must use HTTPS, except that Umbraco permits HTTP for a local development host. Each connector uses only the endpoints needed for read operations.

## Implementation status

Completed:

1. Provider selection/required-setting checks and `profile` plus `analyticsProvider` in snapshots, reports, page context, and MCP status. Comprehensive configuration validation and consistent identity on all tool responses remain gaps.
2. Existing GA4 acquisition data extracted behind the provider interface.
3. A `none` provider for explicit GSC-only operation.
4. Matomo's read-only Reporting API adapter using `Actions.getPageUrls` and `Referrers.getReferrerType`.
5. Generic analytics evidence and provider-specific metric labels in service output.
6. Umbraco Engage 17/18 API-user authentication, package/version health checks, and paginated aggregated page analytics through the Management API.

Still to validate against a real Matomo instance:

1. Confirm exact returned fields, URL shape, timezone, pagination, and permission behaviour.
2. Capture token-free integration fixtures from a consented test site.

Candidate selection remains GSC-led in this phase. Analytics data provides acquisition and outcome context; it does not create a blended ranking score.

## Matomo live-test checklist

Use a real, non-production-sensitive profile and a read-only token. Before treating any Matomo field as product contract, verify:

1. The server URL, `idSite`, and token can call the Reporting API.
2. A fixed supported comparison window (7/30/60/90 days) returns page URL rows from `Actions.getPageUrls`.
3. Returned page URLs can be normalized against the site's GSC URLs without losing meaningful query parameters.
4. Referrer/organic context is available at a usable scope. Record whether it can be returned per page, per segment, or only as a separate site-level report.
5. Available goal/outcome data can be read without requesting write permissions. If not configured, return an explicit unavailable capability.
6. Pagination, row limits, timezone, sampling/aggregation, and delayed-data behaviour are represented in `coverage.limitations`.
7. Snapshot/page-context responses identify the configured profile and `analyticsProvider: matomo`; record any tool that omits identity metadata rather than claiming universal coverage.

Do not add support for optional Matomo modules (including AI-referrer reporting) until their availability and permission requirements have been confirmed on the target instance.

## Umbraco Engage live-test checklist

Use a dedicated API user on a consented test instance. Before treating the adapter as verified for a specific installation:

1. Confirm `page-evidence doctor` succeeds against both the v17 and v18 installations in scope and reports the detected package version.
2. Confirm the user has Engage section access and the minimum permission required by the analytics query endpoint, without broader write permissions.
3. Compare one fixed date range with the Engage backoffice for page views, page sessions, page visitors, bounce rate, average time, engaged time, and goal completions.
4. Verify the installation's reporting timezone, processing lag, pagination totals, and `reportsExist` behaviour.
5. Confirm normalized Engage page URLs match the corresponding GSC page URLs, including any meaningful query-string policy.
6. Confirm missing metric columns remain `null`/unavailable rather than becoming zero, and that zero-valued returned metrics remain zero.
7. Confirm no visitor-profile, heatmap, scroll-map, write, or report-generation endpoints appear in request logs.

The connector calls Umbraco directly; it does not shell out to the Umbraco CLI. Candidate selection remains GSC-led, and Engage evidence is page-level context rather than query attribution or acquisition-source evidence.


### Measurement readiness states (7 November 2026)

`get_measurement_readiness` fetches two analytics periods and configured outcomes independently of GSC and reports isolated failures. Per-period metric summaries preserve numeric zero, missing rows and partial coverage. GA4 and Matomo availability now reflects returned numeric values; missing configured GA4 outcome counts are nullable rather than implicit zero. Existing lens booleans remain observation flags; inspect additive `lensEvidence` for missing, unsupported, failed and not-observed states. Source classification stays in the adapter: GA4 session source/medium supports landing-page acquisition observations; Matomo's site-level referrer types cannot establish Google organic or AI referral sources; Engage and none have no acquisition source lens. No live instance compatibility is established by mocked tests. See the [plan](2026-11-07-readiness-inventory-plan.md).
