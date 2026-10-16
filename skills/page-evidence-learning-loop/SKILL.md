---
name: page-evidence-learning-loop
description: Record Page Evidence recommendations, actual changes, reviewer feedback and follow-up evidence in the local action log, and retrieve prior cases for later SEO/content investigations. Use for Page Evidence change logging or follow-up and alongside recommendations from its evidence. The aim is traceable, reusable experience; improved recommendations or traffic are not assumed.
---

# Page Evidence learning loop

Keep the experience in the selected instance's action log so a later AI session can retrieve it. The chat client interprets the cases; Page Evidence stores and returns evidence. Workflow version: `change-learning-v1`.

Read [the field mapping and update procedure](references/change-log.md) before recording or updating a case. It matters because the current update operation replaces omitted fields.

## Before a recommendation

- Confirm the selected MCP server/profile with `get_site_status`. Use only tools connected in this session; never switch sites to fill a gap.
- Read `review_local_actions(url)` for the page. For a broader investigation, inspect the instance's action log for related cases and root-level measurement notes. The current tool has no bounded cross-case search: do not claim a page-filtered read covers the whole site, and stop broad retrieval if it would expose unnecessary data.
- Retrieve `get_action_review_context(actionId)` for relevant implemented/reviewed cases when useful. Keep original reasoning, user feedback, observed outcomes and unresolved hypotheses distinct. Mention the case IDs that influenced the new analysis, what was reused or reconsidered, and any contradictory case. No stored case is also a valid result.

## Record the case

When change logging is authorised for this work, save each substantive recommendation as `Proposed`, with its evidence references and original hypothesis captured before the outcome is known. Include monitoring/no change when it is a substantive decision. Return the action ID. Logging permission never authorises changing a page or analytics setup.

- Separate user feedback/acceptance from implementation. Record `Accepted`, `Dismissed` or an adjustment only when supported by the user's decision. Set `Implemented` and its date only after the actual change is verified; record the diff/commit/reference and deviations from the proposal. Do not infer implementation from acceptance.
- Read the full existing record before every update. Keep its ID and resend all existing optional fields; preserve original description/hypothesis and append dated feedback, implementation and review entries to `outcomeNotes`. Map returned snake_case fields to the tool's camelCase inputs. Read back to verify. If a read/update round trip is unavailable or a concurrent update is apparent, do not replace the record blindly.
- Keep one case across proposal, decision, implementation and review. A materially different hypothesis can become a new linked case; do not duplicate an unchanged recommendation at every session.
- At follow-up, use comparable stored evidence. Record the result as `supports`, `contradicts` or `inconclusive`, with snapshot/period references and limitations. `Reviewed` means a review was recorded, not that the hypothesis was correct. Insufficient history stays inconclusive; a before/after change does not establish causality.

## Use the accumulated knowledge

The next investigation retrieves prior cases again. Use them as scoped experience with provenance, not universal rules. Store proposed lessons in case notes or a private review artifact with their originating case IDs and counterexamples. A human must approve any promotion into persistent skill/rule instructions; do not silently rewrite skills from observed outcomes. Retain corrections and retirement notes when a lesson no longer holds.

This workflow does not train a model, run background reviews or prove that advice improves. A loop has been exercised only when a later investigation actually retrieves and uses a prior recorded case. State when logging, follow-up or retrieval has not yet happened.
