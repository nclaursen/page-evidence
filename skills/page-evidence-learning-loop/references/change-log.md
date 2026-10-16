# Change log as retrievable experience

Requirement clarified by Niels on 16 October 2026: record recommendations, decisions, actual changes and subsequent observations so later AI investigations can retrieve and learn from the history. Capturing that history is the requirement; better advice or performance is not assumed.

Status: first client workflow available as [page-evidence-learning-loop](../SKILL.md), version `change-learning-v1`. Uses existing MCP tools and action fields; no server model calls, schema migration, background scheduler or automatic lesson promotion. It can be used with either instance when its MCP tools are connected. A real longitudinal pilot is still pending.

## One case, successive entries

| Existing field | Save here |
| --- | --- |
| `description` | Original observation, recommendation and decision rationale, captured before its outcome. Include profile/provider, evidence/snapshot IDs, compared periods and inspected source reference. Mark missing evidence explicitly. |
| `hypothesis` | Original expectation, uncertainty and what would support or contradict it. Monitoring/no change can be a deliberate recommendation. |
| `baselineSnapshot` | Verified comparable baseline ID, when available. Omit when unavailable; do not invent or adopt a legacy snapshot. |
| `status` | `Proposed`, user-supported `Accepted`/`Dismissed`, verified `Implemented`, then `Reviewed` when follow-up was recorded. Acceptance and review are not evidence of success. |
| `implementationDate` | Verified actual change date, not the date an idea was accepted. For monitoring/no-change cases leave it unset and explain why. |
| `reviewDate` | Agreed follow-up date, if any. Storing it does not schedule an automatic run. |
| `outcomeNotes` | Append dated entries for feedback, actual implementation, follow-up evidence and scoped lessons. Preserve the original case and earlier entries. |

Tag a new case's notes with `workflow: change-learning-v1`. Record the skill/rule version used when it is known; otherwise record that it is unknown. Preserve existing unversioned cases as historical context rather than reconstructing a rationale after seeing the outcome.

Suggested dated note entry:

```text
[YYYY-MM-DD | feedback / implementation / review / lesson]
Source: user feedback, verified commit, or evidence/snapshot reference
What happened: actual feedback, change or observation
Hypothesis assessment: supports / contradicts / inconclusive / not assessed
Limits: missing history, concurrent changes, coverage, reporting anomalies
For a later investigation: scoped experience to retrieve, with case IDs
```

Use only the relevant parts; unknowns stay unknown. A possible lesson belongs in the case record until reviewed. Keeping a case is not proof of learning: the loop closes when a later investigation retrieves it and identifies what it reused or reconsidered.

## Updating without losing the original record

`record_local_action` is currently a full upsert, not an append operation. Omitted optional values can replace stored values with empty fields. It is not an immutable audit trail and provides no concurrent-update detection. Work serially and read back after updating; do not claim stronger guarantees.

1. Fetch the existing record through `review_local_actions`, in the intended instance.
2. Preserve its original description, hypothesis, baseline, dates and earlier notes. Append a dated entry to the existing notes; change status/date only when the new evidence warrants it.
3. Send the same action ID and every existing field using this mapping. Preserve an existing nonempty value when no update is intended. Omit optional dates/IDs only when their stored value is empty/null. Do not print unrelated cases or raw exports.

| Returned record | `record_local_action` input |
| --- | --- |
| `id` | `actionId` |
| `url`, `description`, `hypothesis`, `status` | Same names |
| `action_type` | `actionType` |
| `implementation_date` | `implementationDate` |
| `baseline_snapshot` | `baselineSnapshot` |
| `review_date` | `reviewDate` |
| `outcome_notes` | `outcomeNotes` |

4. Read back the same case and verify original fields and accumulated notes. If an old record has no usable ID, do not silently invent an update target. Record that limitation and reconcile it before changing the case.

Original field corrections should be explained in a dated correction entry; preserve the earlier text in the notes if it must be replaced. There is no atomic append guarantee: structured append-only history is a future option only if actual use demonstrates that this workflow loses required information.

## Follow-up and retrieval

Use `get_action_review_context` for implemented cases with comparable history. Identity-incompatible legacy snapshots cannot establish a baseline. Keep the outcome inconclusive when coverage, timing or volume do not support assessment. Record user feedback even when traffic evidence is absent; usefulness and measured performance are separate observations.

Before the next recommendation, retrieve page cases and relevant root-level measurement annotations from the selected instance. Prior related cases may provide context, but the current log tool has no bounded search or cross-site identity envelope. Keep directories separate and avoid retrieving an entire large log unnecessarily. Report the IDs used and how each influenced the current interpretation; do not claim all history was searched.

## Checks for the first real pilot

- A dismissed or adjusted proposal retains its original hypothesis and the user's reason.
- Acceptance alone never becomes an implemented change; the real implementation and any deviation are recorded later.
- A review without comparable history records an inconclusive result rather than a success/failure claim.
- A later investigation retrieves a prior case, cites its ID and records what it reused or reconsidered, including contrary evidence.

These are workflow acceptance checks, not evidence that the AI has improved. Use synthetic data for storage validation; do not manufacture historical cases in a live instance. Later structured fields, append-only events or bounded case retrieval need a demonstrated persistence/retrieval gap.

Validation on 16 October 2026: skill frontmatter and local reference links passed checks. An isolated synthetic action was recorded as a proposal, updated with feedback and verified-implementation text, reviewed as inconclusive without history, and retrieved again with its original hypothesis, dates and accumulated notes intact. This verifies the existing storage path for the procedure; a later real AI investigation using a real prior case remains to be piloted. No live instance data was changed for this validation.
