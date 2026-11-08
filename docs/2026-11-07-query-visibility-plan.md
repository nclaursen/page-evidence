# Query visibility filters on search opportunities

Status: complete in this checkout, 2026-11-07. Authorised by the user's request to do the next backlog item; not published or deployed.

## Decision and placement

Help a reviewer find existing pages with observed queries in a chosen impression/position range before considering new content. Extend existing find_search_opportunities / opportunities inputs and cached page-query retrieval; no new MCP tool, provider calls beyond the existing page budget, dependencies, integrations, storage changes or publishing.

Add optional queryVisibility filters for minimum query impressions and minimum/maximum average GSC position. Existing minimumImpressions remains the page threshold. An explicitly enabled mode defaults to 25 query impressions and positions 4–20; these are editable retrieval bounds, not universal targets or forecasts. Filter current observed queries before bounding examples, return up to five per candidate with exact-normalized prior observations and descriptive movement. Missing prior queries remain null. Preserve query sanitization and existing review gates; intent/answer quality stays with the reviewer. With the mode absent, existing classification and inputs retain their behavior.

The existing impression-ranked page budget remains; disclose that eligible queries on uninspected pages can be missed. Matching query evidence supplies the position-range signal in this mode, allowing a page whose average position is outside the range to qualify if an inspected query matches. Return counts/bounds, selected filters, periods, retrieval limitations and a review prompt. No action is inferred from position alone.

## Verification and acceptance

Test inclusive boundaries, editable ranges, page/query volume gates, movement and missing baselines, selection before output truncation, hostile/omitted query text, partial/failed retrieval and all four analytics selections using shared rules. Verify CLI/MCP forwarding/validation and unchanged defaults. Run targeted checks, build and full suite. Live checks can use connected evidence tools where the new optional input is available; do not claim rollout from source tests. Record results and update backlog/docs before completion.


## Results

- Package `npm run build` passed; full `npm test` passed with 307 tests across 23 files. Focused engine/service/CLI/MCP tests passed before the full suite.
- New coverage checks inclusive/custom ranges, page and query volume gates, matching-query selection before bounding, page-average/query-position differences, current/prior observations, missing baselines, example bounds, failed/partial retrieval visibility, GA4/Matomo/Engage/none shared behavior, omission/instruction filtering, cached retrieval reuse and CLI/MCP forwarding. Default mode remains unchanged.
- Documentation paths and `git diff --check` passed. No dependencies, migrations, additional tools, adapter changes or architectural deviation.
- Connected MCP clients still advertise the previous input schema. New filter inputs were validated in source/build tests, not through those live clients. Rebuild/reconnect before live filter verification; earlier live drift/digest checks do not validate this new optional mode.

## Authorised fresh-process live verification — 7 November 2026

The user requested an MCP restart for live testing. Desktop settings access was blocked by the computer-use tool, and the installed CLI exposes no restart command. The desktop-owned connections were not restarted. Instead, fresh, isolated stdio MCP processes were launched using the existing named personal and Umbraco launch configurations, both pointing to this checkout's built executable; they were closed after verification. No credentials or private configuration were printed or changed.

Both fresh servers exposed queryVisibility in tools/list. Live tools/call checks confirmed unchanged default responses, optional filters (25 query impressions, inclusive average positions 4–20), the three-page inspection budget, five-query example bounds, movement/null semantics, shared output warnings and rejection of inverted ranges. Both used 5 October–3 November against 5 September–4 October 2026.

The personal instance returned two matching existing-page candidates with no retrieval issues. The Umbraco instance returned two matching candidates and disclosed a capped page-query retrieval; that candidate remained IGNORE with incomplete coverage rather than passing the improvement gate. Private source paths, raw result datasets and account exports are not stored here. This verifies fresh configured MCP processes against live evidence, not a refresh of the desktop's existing tool schema. No code repair was required.
