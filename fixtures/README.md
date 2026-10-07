# Search opportunity evaluation fixtures

`ahrefs-organic-keywords.csv` is synthetic. Its 28 standard headers follow the actual Organic Keywords comparison export inspected locally on October 6, 2026. A 29th unknown column exercises forward compatibility. No real export or first-party metrics are committed.

It includes current/previous evidence, boolean intent flags, comma-quoted SERP features, root/www/subdomain/competitor URLs, Lost rows, multiple languages, apostrophe-prefixed position changes, grouped/K-suffix volumes and a reported demand range.

`test/search-opportunities.test.ts` supplies synthetic GSC, page-source and explicit semantic-review evidence for all five actions:

| Case | Expected outcome |
|---|---|
| Established CMS page, 1,500 impressions, position 10, external demand 1,200 and exact query agreement | IMPROVE; external evidence increases confidence/potential compared with first-party-only analysis |
| Same page plus related API demand and a referenced, reviewed content gap | EXPAND on the existing URL |
| Migration demand, adjacent CMS traction/source context and explicit suitable-page inventory review | CREATE candidate, always review required |
| Two pages share a meaningful query, main page declines, both sources cited and redundant purpose explicitly assessed | CONSOLIDATE investigation; overlap alone does not qualify |
| Lottery query with 51,000 volume and no relevant first-party evidence | IGNORE |
| Historical-only URL or stale external data | No current content-gap justification or demand corroboration |
| Sparse GSC, incomplete query coverage or absent page enrichment | No actionable recommendation |

Tests also swap in another normalized provider, compare with/without external data, reject forged references, preserve provenance, exercise query omission/injection handling, and verify bounded service/CLI/MCP behavior. The actual Sitecore export is used only for local import validation and is not tracked.
