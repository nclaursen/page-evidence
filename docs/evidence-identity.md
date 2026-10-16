# Evidence identity and compatibility

Implemented on 16 October 2026 in the shared Page Evidence core. Applies to personal/GA4, Umbraco/Matomo, Engage-selected and GSC-only configurations. Existing provider metrics, CLI aliases and MCP input schemas are unchanged.

## Snapshot provenance

New snapshot IDs retain the profile/provider/period prefix and append a SHA-256 fingerprint. Treat the entire ID as opaque. Payloads contain an additive `identity: {version: 1, fingerprint}` field. The fingerprint covers the exact profile, configured domain and GSC property, selected analytics connection, reporting lag, GSC/analytics row caps and tracking-parameter policy. Analytics connection identity is GA4 property ID, Matomo endpoint plus site ID, or Engage endpoint. Unselected provider settings do not affect it.

Tokens, OAuth credentials, client secrets, endpoint userinfo, query strings and fragments are excluded. Credential rotation does not change this scope. The fingerprint identifies configuration for comparison, not authentication or an access-control boundary. Separate private data directories remain required.

Cache reuse checks the payload as well as the ID. Page lookups, history and action reviews require the same identity. In-process query caches and persisted digest checkpoints use that scope too; a settings change starts a new digest baseline. History and action review return an additive `coverage.excludedIncompatibleSnapshots` count.

### Existing local data

No SQLite schema migration or deletion is required. Old snapshots and checkpoints remain on disk unchanged, but snapshots without verifiable identity are excluded from automatic analysis. An explicit legacy/mismatched snapshot request fails with an explanation. Incompatible pinned baselines remain invalid rather than being silently replaced.

After updating a client, its first evidence request fetches a new snapshot. New observations rebuild comparable history; this is not a historical backfill. Existing action descriptions, hypotheses, notes and baseline references remain intact. A legacy baseline reference may now produce an explicit evidence gap. Do not assign identity to old snapshots merely because their URL or current directory looks familiar.

Action records themselves are still scoped by their private data directory, not a connection fingerprint. Never share/reassign an instance directory. Binding actions to configurations would require a separately designed migration. Root-URL measurement annotations remain root-URL annotations; this change does not make them automatic site-wide caveats.

## Page identity policy

`pageKey()` is shared by page evidence matching, history/reviews, lifecycle, digest, external-search matching and Engage duplicate aggregation. It accepts HTTP(S) URLs within the configured host family. Relative provider URLs resolve against the configured domain.

- HTTP and HTTPS, and the configured root/www pair, are aliases. This is a comparison policy, not evidence of a canonical or redirect.
- Other subdomains and non-default ports remain distinct. A foreign host or non-HTTP URL cannot match a local page.
- Path case, trailing slashes and meaningful query values remain significant. Configured tracking parameters and fragments are removed.
- Stored row keys are not trusted for lookup; matching derives the key from each row's URL.

`normalize()` retains its path-only contract for local repository/source matching. Repository mapping remains a separate, configured heuristic; the new key does not prove that a repository contains a particular subdomain's source. Engage keeps different hosts separate, sums only its established additive duplicate metrics, and rejects out-of-site page URLs rather than merging their metrics.

## CI and validation

[Build and test](../.github/workflows/ci.yml) runs lockfile installation, TypeScript build and the complete Vitest suite on pushes and pull requests, with Node 22 and 24. It has read-only repository permissions. This is a validation workflow, not a release/deployment workflow; making its status required for merging remains a GitHub branch-protection decision.

Synthetic tests cover changed properties/connections, configuration/profile collisions, legacy and mismatched snapshots, pinned baselines, query/digest scope, subdomain/port matching and annotation preservation. GA4 mapping fixtures and Engage host aggregation fixtures supplement the existing adapter tests. `test/tsconfig.json` keeps tests within this package's TypeScript configuration even when checked out under an Astro repository.

Live provider access and running MCP-client upgrades are separate from these tests. Existing processes must reconnect after the updated build is installed; they do not reload merely because source files changed.
