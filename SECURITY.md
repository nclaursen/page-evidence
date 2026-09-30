# Security and privacy

Site Signal is local-first. OAuth tokens, Matomo tokens, Umbraco API-user credentials, cached data, reports, and action logs are stored under `~/.site-signal` by default (or `SITE_SIGNAL_DATA_DIR`) and are never sent anywhere except the configured Google APIs, Matomo Reporting API, or Umbraco instance.

The tool always requests only `webmasters.readonly`; it requests `analytics.readonly` only when the selected analytics provider is GA4. Matomo credentials are used only for read-only Reporting API requests. Umbraco client credentials are exchanged for an access token in memory and used only with the allow-listed Engage package and analytics query endpoints. Engage support reads aggregated page reports; it does not request visitor profiles, heatmaps, scroll maps, or write endpoints, and it never starts report generation. Umbraco requires HTTPS except for a local development host.

Use a dedicated Umbraco API user with access to the Engage section and only the analytics permission needed by the query endpoint. Site Signal never changes a website, analytics configuration, or an external business system. Do not commit `.env`, token files, snapshots, or reports. Report vulnerabilities privately through GitHub Security Advisories when the repository is published.
