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
