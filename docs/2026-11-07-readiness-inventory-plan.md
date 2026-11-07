# Provider readiness and bounded URL inventory

Status: complete in this checkout, 2026-11-07. Authorised by the user's request to build the next Page Evidence items; not published or deployed.

## Scope and placement

The next two open development items support deciding which evidence can inform a page investigation and finding known URLs with traceable local source mappings. Implement provider-aware measurement readiness and an explicit repository URL inventory. Shared aggregation and inventory belong in core modules; provider acquisition semantics and observed metric availability belong in analytics adapters. No website changes, live provider checks, dependencies, migrations or publishing.

Readiness preserves existing fields and adds explicit per-period availability, source scope, missing/unsupported/failed states and outcome failure reporting. It fetches analytics independently of GSC, so an analytics failure can be reported without hiding other evidence. Existing sync failure behavior stays unchanged. Observed zero must remain available; missing numeric fields must not become zero. Matomo referrer types cannot establish Google organic or AI sources; Engage and none do not supply acquisition evidence.

Inventory uses the configured repository as its explicit source, with hard file, byte, URL and mapping bounds. Only absolute same-site URLs found in source are known URL references; explicit static frontmatter URL/canonical/permalink declarations provide declared mappings. Filename matches are candidates, never verified routes. Return unmapped URLs, source files without declarations, truncation and parser limits. Do not infer Astro routes, fetch sitemaps, crawl, or claim a complete published inventory. Sitemap-only configurations return an explicit unsupported source state.

## Acceptance and validation

Preserve CLI/MCP defaults, existing fields, filtering and identity. Add bounded get_url_inventory / url-inventory interfaces. Test GA4, Matomo, Engage and none semantics, zero/missing/partial/failed evidence, outcome failure isolation, repository bounds and declaration/reference distinctions, and MCP forwarding/safety. Run focused tests, build and full suite. Update backlog and architecture. Mocked validation does not prove installed or live instance compatibility.


## Results

- `npm run build` passed. Full `npm test` passed: 289 tests across 22 files.
- Synthetic tests cover GA4/Matomo/Engage/none source semantics and period states, missing versus observed zero, partial coverage, failed periods/outcomes, malformed Matomo reports, nullable outcome counts, missing snapshot periods, inventory declarations/references/candidates, foreign/credential URLs, ignored directories/symlinks, file/output/mapping bounds, and MCP forwarding/shared output warnings.
- Added CLI commands `measurement-readiness` and `url-inventory`; MCP adds `get_url_inventory`. Existing inputs and fields remain. Metric availability and nullable outcome counts now honestly represent returned evidence; consumers must not treat null as zero.
- No dependencies, storage/configuration migration or architectural deviation. Source inventory is deliberately repository-only and cannot establish a complete published URL list. No live provider, installed MCP client or Umbraco/personal deployment was checked; rebuild/reconnect clients for rollout.

## Authorised live verification — 7 November 2026

The user requested live testing before commit/push. Connected personal GA4 and Umbraco Matomo MCP tools both returned current and previous analytics periods successfully. Assertions verified provider-specific acquisition states, preservation of observed zeros, missing Matomo metrics, bounded inventory output, declaration/reference distinctions and shared untrusted-text warnings. Both configured repositories returned URL references; these remained explicitly unmapped. The Umbraco inventory disclosed skipped oversized files and bounded source/output lists as partial coverage. No private paths, raw source data or account exports are stored here.

The built CLI also inspected the public personal homepage: HTTP 200 and a matching static canonical, with complete bounded HTTP evidence. These checks verify the connected instances and the tested public URL at the recorded time; Engage live access, configured business-outcome retrieval and complete route mapping were not tested. Missing/unconfigured outcomes were reported explicitly. No provider data, website or private configuration was changed.

The pre-commit package build and all 289 tests in 22 files also passed.
