# Selected-page HTTP evidence

Status: complete in this checkout, 2026-11-07. User authorised starting the next recorded backlog item. Not published or live-deployed.

## Scope and placement

Add an explicit `get_page_http_evidence` MCP tool and `page-http URL` CLI command. Shared, provider-independent retrieval belongs in `src/page-http.ts`, with configured identity supplied by the service. Existing page/digest tools do not gain automatic network requests. No new dependencies, integrations, credentials, persistence or migrations.

Inspect one absolute HTTP(S) URL on the configured site's exact hostname or root/www alias. Follow at most five redirects within those hosts on default ports, with a 20-second total deadline and a 256 KiB HTML limit. Record each response status, URL, Location and retrieval time. Block credentials, off-site targets, private/reserved IPs, and unsafe DNS results; pin the validated address to each request. Do not follow canonical targets. Return bounded static HTML canonical references, resolved against the final document/base URL, with coverage and parser limitations. No JavaScript execution, crawl, canonical-choice diagnosis, or Google-selected canonical claim.

## Acceptance and instance implications

Same behavior for personal GA4, Umbraco Matomo/Engage and GSC-only profiles. No provider/API/storage access is required. Preserve observed redirects/statuses when a later request fails or is blocked. Missing, truncated, non-HTML and failed canonical evidence remain distinct. All MCP output passes through the existing untrusted-text boundary. Existing tools and defaults remain compatible.

## Verification

Use mocked DNS/HTTP fixtures for statuses, redirect limits/loops/scope, private-address rejection, address pinning, body/time bounds, static canonical parsing, partial failures and provider-neutral identity. Verify additive MCP forwarding/safety and CLI wiring; run package build and full tests. No live requests or rollout are in scope. Record results before completion.

## Results

- `npm run build` passed; full `npm test` passed: 269 tests in 20 files.
- Mocked tests cover same-site/alias redirects, off-site/credential/port rejection, private and reserved IPv4/IPv6 and mixed DNS answers, per-hop DNS validation/address pinning, redirect loops/limits, total deadline, body bounds, encoding limitations, canonical/base handling, error statuses, and preservation of earlier responses after failure. Shared retrieval was exercised with GA4, Matomo, Engage and none identities; these tests do not establish live provider/instance compatibility.
- Additive MCP registration/forwarding and shared output warnings passed. Built CLI smoke check with synthetic configuration blocked an out-of-scope URL before DNS/HTTP. Documentation links and `git diff --check` passed.
- Existing tools/defaults, analytics adapters and local state formats are unchanged. No new dependency, migration or architectural deviation. Pre-existing source-context, test and provider-document edits were preserved.
- Remaining work: rebuild/reconnect installed clients and consented live verification per instance. Static HTML parsing remains partial; HTTP Link-header canonicals, rendered DOM and Google-selected canonical are outside this scope.

## Authorised live verification — 7 November 2026

User subsequently requested testing. Rebuilt the package successfully and reran the focused HTTP/MCP tests: 57 passed in three files. No implementation changes were needed.

Used the built CLI with an explicit test profile, `SITE_DOMAIN=nclaursen.dk`, analytics provider `none` and dotenv disabled. No account credentials, snapshots or action logs were accessed.

| Selected URL | Observed result |
| --- | --- |
| `https://nclaursen.dk/` | 200; static canonical `https://nclaursen.dk/`; complete |
| `http://nclaursen.dk/` | 200 without redirect; static canonical `https://nclaursen.dk/`; complete |
| `https://www.nclaursen.dk/` | 200 without redirect; static canonical `https://nclaursen.dk/`; complete |
| `https://nclaursen.dk/page-evidence-http-test-missing-20261107/` | 404 retained; canonical unavailable due to unsupported response encoding; partial |
| `https://example.com/` with the nclaursen.dk configuration | Blocked before DNS/HTTP; empty chain |

Also launched the built stdio MCP server, completed protocol initialization, listed all 23 tools and called `get_page_http_evidence` on `https://nclaursen.dk/blog/det-perfekte-chatgpt-prompt/`. It returned a 301 to `https://nclaursen.dk/blog/how-to-prompt-chatgpt-practical-framework/`, then 200 and the target's matching static canonical. The response retained the shared untrusted-text warning. The MCP integration assertion passed.

These observations verify the local built CLI and stdio MCP against the personal public site at the recorded time. They do not verify installed desktop clients, analytics providers or the Umbraco instance. Nothing was published or deployed. Reconnecting installed clients and testing other instances remain open.
