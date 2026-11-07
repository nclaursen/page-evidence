# Search opportunity improvements

Status: complete in this checkout, 2026-11-07. Approved by user; not published or live-deployed.

## Scope and placement

Implement only emerging-query digest enrichment, descriptive click-change breakdowns and better internal-link evidence. Record all seven ideas in BACKLOG.md. Pure arithmetic belongs in shared core analysis; service orchestration reuses cached GSC page queries; local source evidence remains in context.ts. Preserve existing CLI/MCP fields and defaults, adding an opt-in includeQueries flag to digest. No dependencies, storage migration, model calls or external mutations.

Digest enrichment is limited to three returned flagged pages and five examples per query group. It compares the current snapshot's adjacent periods, explicitly distinct from the rolling checkpoint comparison. Partial query failures must preserve the digest. Click components use symmetric allocation of the impression/CTR interaction and sum to observed click change; missing/zero impression periods remain unavailable. Link evidence includes bounded source excerpts and statically detectable Markdown/HTML links; it does not claim complete rendered-link coverage or decide anchors editorially.

## Acceptance and instance implications

Shared behavior works for GA4, Matomo, Engage and GSC-only configurations; these features use GSC and optional local source without equating analytics metrics. Existing tools/names/defaults and query sanitization remain compatible. No configuration changes except optional existing repository setup; no private data access or live rollout.

## Verification

Add meaningful arithmetic, missing-evidence, bounded-fetch/cache/failure, source-link and MCP safety/forwarding tests. Run targeted tests, package build and full suite. Check documentation paths. Record results and remaining limitations here before completion.

## Results

- Package `npm run build` passed; full `npm test` passed: 208 tests in 19 files.
- New coverage verifies symmetric arithmetic and unavailable baselines, page-context exposure, digest defaults/baselines/three-page bounds/query limits/cache reuse/partial failure handling, mocked GA4/Matomo/Engage/none configurations, MCP forwarding/query filtering, and local link/excerpt evidence.
- Existing CLI/MCP names and default behavior remain; additions are optional/additive. No adapter changes, dependencies, configuration migration or storage migration. No architectural deviation.
- No live providers, deployed instances or installed MCP client versions were checked. Source parsing remains intentionally partial; query rows remain bounded. Restart/reconnect clients using this build to expose the optional digest input.
