# Evidence identity and CI

Status: implemented and locally verified. Scope authorised by Niels on 16 October 2026: start with the recommended site/snapshot identity, host-aware page identity, and CI work.

## Scope and placement

- Core owns a versioned, non-secret evidence fingerprint covering exact profile, site, GSC property, selected analytics connection, retrieval limits, lag and tracking policy. Snapshot IDs include it; saved payloads must match it before cache reuse, page lookup, history or action-review comparisons. Query caches and digest checkpoints use the same scope.
- Keep the existing path normalizer for source-context compatibility. Add one shared host-aware page key for matching and Engage aggregation; delegate the external-search key to it. HTTP/HTTPS and the configured root/www pair are aliases. Other subdomains and non-default ports remain distinct; foreign hosts and non-HTTP URLs cannot match. Preserve case, trailing slash and meaningful query values.
- Retain existing SQLite formats, old snapshots, digest checkpoints and action records on disk. Unfingerprinted snapshots cannot be assigned a trustworthy connection retrospectively: do not adopt, rewrite, delete or use them automatically. Explicit legacy/mismatched snapshot requests fail clearly; history/review report excluded snapshot counts and incompatible pinned baselines remain invalid. Fresh observations establish new comparable history/checkpoints.
- Action storage continues to rely on separate private instance directories. No action-schema migration or profile repurposing is introduced; this residual boundary remains documented. Keep existing annotations and apply host-aware URL matching. No live provider calls, private-state migration, package publication or running-client restart is part of this implementation.
- Add package-local GitHub Actions CI for Node 22 and 24, using the lockfile, build and full tests on pushes and pull requests. Do not alter release automation or add dependencies.

## Acceptance and verification

1. Reusing a data directory after changing site, GSC property, selected analytics connection, retrieval settings or a sanitization-colliding profile cannot return previous evidence as current. Unchanged settings reuse their cache; credential rotation does not invalidate evidence or enter fingerprints.
2. Page context, history, action review, digest and Engage aggregation do not conflate different hosts sharing a path; external-search matching uses the same policy. Existing path-only helper behavior remains compatible.
3. Legacy snapshots remain retrievable from storage but excluded from automatic analysis. Explicit requests and pinned baseline gaps explain the limitation; recent measurement notes remain intact.
4. Meaningful mocked service tests cover GA4, Matomo, Engage and none identity isolation; adapter fixtures verify GA4 mapping and Engage host aggregation. Existing CLI/MCP contracts remain intact apart from additive identity/coverage metadata and opaque snapshot ID values.
5. Run targeted tests, package build, complete suite and diff checks. Inspect workflow syntax and document that hosted CI and live instance behaviour have not been verified locally.

## Affected files and remaining work

Implemented core/service identity checks, shared host-aware analytics/external-search matching, adapter/service regression tests, package CI and compatibility documentation. Local architecture and architecture-backlog records were updated; their pre-existing untracked files remain outside this implementation commit.

Verification completed on Node 24.13.1:

- Targeted regression suite: 107 tests passed before the additional adapter/site-change cases.
- Local package build and complete suite: 157 tests passed before the final site-change case.
- Separate clean checkout copy: `npm ci --no-audit --no-fund`, `npm run build`, and final `npm test` passed (158 tests across 14 files). The copy uses the repository lockfile and no parent website dependencies.
- CI YAML parsed; Node 22/24 matrix and validation job confirmed. Diff whitespace checks passed.
- No provider calls, private SQLite changes, installed-client restart or live-instance verification. Hosted CI/Node 22 execution and branch-protection enforcement are not established by local Node 24 tests.

No new dependencies or storage-schema migration; actions remain isolated by private directories. Query-to-page drift and decision-record workflows remain separate future increments.
