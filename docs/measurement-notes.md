# External measurement notes

These notes describe external measurement limitations relevant across Page Evidence instances. They are evidence for interpretation, not corrections to stored analytics or proof of an effect on a particular site. Dates below are calendar dates; provider reporting timezones can shift the apparent daily boundary.

## ChatGPT attribution disruption, 8–15 October 2026

- **Reference:** `chatgpt-attribution-2026-10-08`
- **Reviewed:** 16 October 2026.
- **Assessment:** Independently supported loss of attribution on some ChatGPT links. Sufficient evidence for a qualified measurement annotation. Site-specific impact and universal recovery have not been verified.
- **Period:** Use 8–15 October 2026 as a reported incident window. The 15 October endpoint denotes a reported fix rollout, not a confirmed end for all accounts, regions, surfaces, or sites.

Some ChatGPT links reportedly arrived without `utm_source=chatgpt.com` and without a referrer. Such visits can lose their ChatGPT attribution and appear as Direct, depending on the analytics system's attribution rules. A decline in identifiable ChatGPT visits during this window does not by itself establish a decline in actual visits, and the evidence does not establish that all lost attribution became Direct.

### Evidence and confidence

1. **Independent primary link evidence:** [Profound, Josh Blyskal, 14 October](https://www.tryprofound.com/blog/chatgpt-missing-utm-tags). In its collected answers with citations, the proportion containing at least one tagged source link fell from approximately 98% on 8 October to 66% on 14 October. Some links inside additional panels retained tags. This supports a link-attribution discontinuity; it is not a measurement of visitor loss. The post does not disclose a sample size and comes from a commercial AI visibility vendor.
2. **Independent primary analytics evidence:** [LLM Pulse, Esteve Castells, 13 October](https://llmpulse.ai/blog/chatgpt-referral-traffic-fell/). Its monitored GA4 sites showed approximately 46% fewer ChatGPT sessions on 9–11 October versus the same days in the preceding two weeks. The authors explicitly could not distinguish lost visits from lost labels and did not observe a clear Direct increase. This supports a reporting anomaly, not its sole cause. The post does not disclose a site count and comes from a commercial AI visibility vendor.
3. **Primary recovery report:** [Cedric Huesler's follow-up](https://www.linkedin.com/posts/cedrichuesler_relieved-it-was-a-bug-chatgpt-is-tagging-share-7516558430854152192-vTAO/). He reports that OpenAI privately acknowledged a bug on 14 October, with recovery rolling out on 15 October. This is his account of the acknowledgement and telemetry, not a public OpenAI incident statement. Replies include users who did not yet see recovery. Treat the endpoint as provisional.
4. **Secondary corroboration:** [Search Engine Journal, Matt G. Southern](https://www.searchenginejournal.com/chatgpt-traffic-drop-appears-to-be-a-tracking-problem/593157/) brings together several observers and reports the recovery claim with caveats. It is additional reporting, not an independent dataset or an official confirmation.

All four sources were opened and read on 16 October 2026. No public OpenAI incident statement confirming this tracking bug or universal recovery was found in this review. The supplied screenshot led to the investigation; the linked sources support the saved note.

### Interpretation across instances

- Flag comparisons whose current or previous period overlaps the reported window, including longer rolling windows. Inspect subsequent days before assuming normal attribution resumed for a site.
- Compare identifiable ChatGPT sources, Direct, and total traffic on the same landing pages and periods. Preserve sessions versus visits and each provider's source/channel definitions. Do not redistribute Direct traffic or apply the external percentages as correction factors.
- The caveat concerns source attribution. It does not itself establish an error in total visits, conversions, GSC clicks/impressions, or search rankings. Do not interpret it as a content-change effect.
- GA4 and Matomo acquisition evidence may be relevant where available. Engage currently provides no acquisition-source evidence; a GSC-only profile cannot verify this anomaly. No live site-specific effect was tested for any provider.

### Local annotation and current limitation

The same reference was recorded through `record_local_action` in both connected personal and Umbraco instances as an `external_event`, dated `2026-10-08`. `Implemented` means the measurement note has been recorded, not that a site change was implemented or a fix verified. The reported endpoint is kept in the note because the existing action contract has no end-date field.

These are intended as site-wide caveats, stored against each site's root URL. Existing action/history filters match page URLs: a root annotation is **not automatically included on every page or report**, and this documentation is not a runtime incident registry. Consult the unfiltered action log or root URL annotation when reviewing affected periods. No code, provider configuration, historical data, or storage schema was changed.

## Reported Gemini attribution changes, September 2026

- **Reference:** `gemini-attribution-2026-09-10`
- **Reviewed:** 16 October 2026.
- **Assessment:** Primary vendor observations support a qualified attribution caveat, not a confirmed Google-wide incident or an effect on either local site.
- **Period:** Tags reportedly began appearing on 10 September and disappeared after 29 September in the source's sample. These are observation dates, not universal rollout boundaries; no confirmed recovery date is available.

[Vizzybl, Jez Lloyd, 4 October](https://vizzybl.ai/blog/gemini-utms) describes daily monitoring of 595 Gemini answers and approximately 4,200 citation links. It reports UTM tags on all 4,235 sampled links on 28 September, followed by their disappearance after 29 September. Its FAQ describes the peak as 28–29 September, so the exact transition boundary is not settled even within this source. This is a commercial vendor's sample, not independent verification of every Gemini surface. Its interpretation as a Google test and prediction of a permanent return are not established facts.

[LLM Pulse's separate analytics observations, 13 October](https://llmpulse.ai/blog/chatgpt-referral-traffic-fell/) describe a decline in Gemini referrals between 28 September and 2 October: the `gemini` source nearly disappeared while `gemini.google.com` referrals held steady or grew. This supports caution about source classification, but does not independently establish Vizzybl's exact dates or mechanism.

When comparing periods around these dates, inspect Gemini source labels together while retaining their original values, source/medium definitions, and provider metric names. A change in identifiable Gemini traffic may reflect changed tagging rather than changed visitation. Do not infer that every missing Gemini visit became Direct, backfill attribution, or apply a numerical correction. GA4/Matomo acquisition evidence may be relevant where available; Engage and GSC-only evidence cannot verify Gemini source attribution. Neither site's impact or recovery was tested.

The reference was recorded in both connected instances as an `external_event` on each site's root URL, with `implementationDate: 2026-09-10`. This is the reported beginning of the tagging change, not a site implementation date. The root-URL visibility and `Implemented` status limitations above apply here too.

## Reported Search Console performance delay, October 2026

- **Reference:** `gsc-reporting-delay-2026-10-11`
- **Reviewed:** 16 October 2026.
- **Assessment:** Firsthand reports of delayed performance data; no site-specific API impact or permanent data loss verified.
- **Period:** Observed on 10–11 October; normalisation reported on 12 October. The incident's exact start and recovery across all properties are unknown.

[Barry Schwartz, Search Engine Roundtable, 11 October, with subsequent updates](https://www.seroundtable.com/google-search-console-performance-report-delayed-42271.html) documented a performance report over 64 hours behind on 11 October and reported normalisation the following morning. [Webtaculos, 11 October](https://www.webtaculos.com/insights/google-search-console-data-delayed) separately describes a monitored property more than 60 hours behind. These are reporting observations, not evidence of a ranking or indexing failure. [Google's official anomalies list](https://support.google.com/webmasters/answer/6211453?hl=en), checked on 16 October, did not list this October performance delay.

Review the freshness and actual covered dates of snapshots fetched around 10–12 October before interpreting low recent totals. The observation window is not a known list of affected search-data dates. A delayed UI report does not establish that every API response or stored snapshot was incomplete; Page Evidence's reporting lag may already have excluded affected recent dates. No local snapshot was audited for this note. Do not treat missing rows as zero or infer permanent loss. Later normal reporting does not by itself validate an earlier stored snapshot.

The reference was recorded in both connected instances as an `external_event` on each site's root URL, with `implementationDate: 2026-10-11`, the dated firsthand observation. `Implemented` means the caveat was saved, not that a fix was verified. The root-URL visibility limitation above applies. This caveat concerns GSC freshness across analytics providers; no code, provider configuration, or historical snapshots were changed.
