# OpenBot connector inventory

Date: 2026-11-25.
Subject: Nightly Labs' OpenBot, `github.com/nightly-labs/openbot`, read at commit `b1e5ea74206e1e16fa2eae62d8d131ea1349eaa0` (Sun 22 Nov 2026), the same commit as the [integration parity note](openbot-integration-parity-2026-11-22.md).
Outlore baseline: commit `953e98b9`, [catalog entries](../../packages/service/src/connectors/catalogEntries.ts), [catalog types](../../packages/service/src/connectors/catalog.ts), [connectors specification](../capabilities/connectors/specifications.md).
Method: I cloned the repository at the pinned commit, read the registry, each built-in connector's code and the architecture documents, and parsed all 255 `plugin.json` manifests with a script.
Licences and tool counts that the OpenBot tree does not state were read live on 2026-11-25 from npm and from each server's own repository, and are marked "live".
Nothing here was run against a live service: no sign-in, `tools/list` or tool call was made, so tool counts and read-only modes are as documented, not measured.

## Summary

- OpenBot has two connector layers.
  The eight built-in connectors are native code with a controller, a panel and an IPC contract each.
  The marketplace has 255 plugin manifests that each declare one MCP server.
- The 255 manifests are 255 distinct vendor listings with 247 distinct hosts.
  The other eight are `stdio` servers started with `npx` or a local binary.
  Three listings stand for several products: Atlassian (Jira, Confluence and Bitbucket), Apple apps (seven macOS apps) and the aggregators Composio, Zapier, Make, IFTTT, Windsor.ai and Apify.
- 247 manifests are remote MCP servers over HTTPS, one is a local loopback server (Figma desktop) and eight are stdio.
- 226 manifests offer a browser OAuth sign-in (222 only that, four also a key).
  That is 89% of the catalog, and it is the main gap for Outlore: its catalog has an HTTP backend with a fixed header and a Vault key, and no OAuth client.
- Only 24 manifests need no OAuth to work against Outlore's current HTTP backend: 14 remote servers that need no credential, six that take one key in a header and four that offer a key beside the browser sign-in.
- OpenBot's own code is under the PolyForm Noncommercial licence 1.0.0 (`LICENSE`, `NOTICE`), so Outlore can read the manifests as facts but must not copy OpenBot code or its manifest text.
- The manifests carry no licence, no tool count and no tool classification.
  Read-only modes appear only in free-text descriptions of 16 listings.

## How OpenBot declares a connector

### Built-in connectors

`src/renderer/src/features/connectors/connector-registry.ts` builds a `ConnectorSet` keyed by `ConnectorId` in `createConnectorSet`.
It adds Slack, Discord and Telegram from one `MessagingApi`, WhatsApp from its own port, GitHub, 1Password and Bitwarden from their ports, and Proton Pass through `createPasswordManagerConnector("protonpass", ...)`.
`createConnectorRegistry` then gives each id an access state: `available`, `local-only`, `hidden`, `unsupported` or `loading`.
`docs/architecture/integrations.md` ("Add a connector") lists seven steps per connector: an IPC contract, a main-process service, a device-code sign-in where possible, a `CONNECTOR_IDS` entry, a listing, a renderer controller and text keys.
The same document says a connector links OpenBot to an outside account for all agents and that "the built-in entries (Computer Use, the GitHub connector) have no MCP row".

| Connector | Delivery | Authentication | Server and licence | What the agent gets |
| --- | --- | --- | --- | --- |
| GitHub | Remote MCP at `https://api.githubcopilot.com/mcp/` (`GITHUB_CONNECTOR_MCP_SERVER_URL`, `packages/contracts/src/ipc-mcp-servers.ts:13`), reached through a local proxy (`src/main/github-mcp-proxy.ts`) that swaps in a per-repository token | Device flow of a GitHub App, `OpenBotGit`, with only the public client ID (`src/main/github-connector-config.ts:1-2`, `github-device-flow.ts:6-7`) | GitHub's official server `github/github-mcp-server`, MIT (live: GitHub API, pushed 2026-11-24); GitHub states the remote server is hosted by GitHub | The server's tools, plus `GIT_CONFIG` credential-helper environment so `git` and `gh` use the same grants (`agentEnvironment` in `github-connector-service.ts`) |
| Slack | Hosted: OpenBot's one Slack app, an account Worker and an event relay, "Signal" (`docs/architecture/channels-and-messaging.md`, "Messaging connections") | Hosted OAuth in the Worker, which ends in an `openbot://slack-workspace` link with a sealed bot-token grant | OpenBot code, PolyForm Noncommercial | Inbound mentions and messages answered by an orchestrator agent, and the tools below |
| Discord | Hosted, as Slack | Hosted OAuth, ending in `openbot://discord-guild` | OpenBot code | As Slack, with role-based access (`discord-access-v1`) |
| Telegram | Hosted: one OpenBot bot whose token only Signal holds | A one-use link code in a `t.me` link; no OAuth | OpenBot code | As Slack |
| WhatsApp | Native, on the host: a vendored Baileys v7.0.0-rc14 (MIT) without its copyleft parts, plus OpenBot's clean-room Signal code (`packages/whatsapp`) | QR code or a pairing code that links the number as a device of the host | Baileys MIT, OpenBot code | As Slack, with the owner's own chat always allowed and other senders only when allowed |
| 1Password | Native: the `op` CLI and a 1Password SDK client (`src/main/onepassword-connector-service.ts`) | The user's `op` session creates a service account scoped `<vault>:read_items` on a vault named "Shared with OpenBot" (`:31`, `:586-640`), or the user pastes a token | 1Password's CLI and SDK | Logins for browser sign-in; no MCP tools |
| Bitwarden | Native: the `bw` CLI | A `bw` session key kept in memory; a joined server uses an API key and the master password | Bitwarden's CLI | As 1Password |
| Proton Pass | Native: `pass-cli` (`src/main/password-managers/proton-pass-driver.ts`) | A web sign-in in a temporary `pass-cli` session makes an agent access key, or the user pastes one | Proton's CLI | As 1Password |

Facts about the messaging tools come from `MESSAGING_TOOL_DEFINITIONS` and `MESSAGING_OUTBOUND_TOOLS` in `src/backend/messaging/messaging-tools.ts`.
The five tools are `messaging_remember`, `messaging_forget_memory`, `messaging_history`, `messaging_list_places` and `messaging_post`, and the code names the last two (and `messaging_history` with a `connection` or `place`) as outbound calls.
So OpenBot itself separates inbound-safe from outbound tools by exact name, as Outlore does with Read and Write.

What the three families mean for Outlore:

- **Messaging (Slack, Discord, Telegram).**
  The connection is a channel into the agent, not a toolbox.
  It depends on OpenBot-run infrastructure: an installed Slack app with a signing secret, a Telegram bot token that "must not reach any host", and a public events URL (`https://signal.openbot.run/v1/slack/events`).
  An Outlore host has no equivalent service, so these cannot be copied; an MCP server for each service (sending, reading history) is the closer match.
- **WhatsApp.**
  It is the only messaging connector that runs entirely on the host, and the only one that needs a QR code or a pairing code shown inside the app.
  That is a connector-specific sign-in screen, which Outlore does not have today.
- **Password managers.**
  They feed OpenBot's browser sign-in.
  They expose no MCP tools; the agent-facing browser tools are `list_logins`, `request_vault_item` and others (`docs/architecture/browser.md:382`).
  The 1Password design (a read-only service account on one dedicated shared vault) is a useful pattern for secrets that never reach the model.

### Marketplace plugins

`marketplace/plugin-catalog/plugins/<slug>/plugin.json` is one directory per vendor.
`catalog.json` (`catalogVersion` v1, `updatedAt` 2026-11-10) holds the order and four featured slugs: `aave`, `canva`, `notion`, `figma`.
`scripts/build-plugin-catalog.ts` validates the sources and generates the renderer catalog, the account Worker's routes and an offline snapshot.
The README of the catalog states the rules.

Every manifest has these top-level keys: `slug`, `name`, `tagline`, `description`, `category`, `creatorName`, `iconUrl`, `version`, `prompts`, `apps`, `skills`, `websiteUrl`, `privacyPolicyUrl`, `termsUrl`.
All 255 have exactly one app, and all `skills` lists are empty by the README rule "Skills stay `[]` until pinned skill versions exist".
An app is `{ id, name, description, iconUrl, server }`, plus `macAutomation` on the Apple listing only.
A `server` is one of two shapes (`scripts/build-plugin-catalog.ts:96-113`):

- `http`: `{ name, transport: "http", url, earlierUrls?, auth? }`.
  The URL must be `https://`, or a loopback `http://` URL when the only flow is `local`.
- `stdio`: `{ name, transport: "stdio", command, args, env?, auth? }`.
  `env` holds fixed non-secret values, and a key may not be a variable that an auth field types (`parseServerEnv`).
  The README forbids `workingDirectory`, and a `command` can start with `~/`.

Sign-in is the `auth` array, with three flow kinds (`PluginAuthFlow`, `build-plugin-catalog.ts:57-94`):

| Kind | Fields | Rule |
| --- | --- | --- |
| `link` | `id`, `label` | HTTP servers only. The user signs in on the vendor's page; OpenBot's main process is the MCP OAuth client, keeps the tokens in encrypted storage and adds `Authorization` when it hands the server to a provider (catalog README). |
| `key` | `id`, `label`, one or two `fields`, `docsUrl`, `docsLabel` | A field is `{ id, label, header or env, prefix?, placeholder?, hint?, optional?, url? }`. An HTTP key goes in a `header`, a stdio key in an `env` variable, and `url: true` asks for a server address. The user types it in the connect dialog and the directory holds no secret. |
| `local` | `id`, `label`, `steps` (one to eight), `note?`, `docsUrl?` | HTTP only, a loopback URL only, and the only flow of that server. Used once, for Figma's desktop server. |

The vendor-side sign-in must pass `bun run test:mcp-catalog` (`scripts/mcp-catalog-smoke.ts`): the server must answer 401 with a `Bearer` challenge, publish protected-resource metadata, and name an authorization server that lists S256 and the `code` response type and has either a `registration_endpoint` or `client_id_metadata_document_supported`.
A server that fails this "needs a sign-in app first", so the listing uses a `key` flow or is left out (`docs/architecture/integrations.md`, "Add an application").
For servers that register only approved clients OpenBot has a built-in client (`BUILT_IN_MCP_CLIENTS`; Meta Ads is the one the document names), reached through an `openbot.run` redirect that sends the grant to `http://127.0.0.1:28417/mcp-auth`.
Agents never receive the OAuth token: a local proxy (`mcp-oauth-proxy.ts`) holds it and gives the provider only an HMAC bearer for one route and one agent.

## What the manifests show

Counts come from a script that parsed `plugins/*/plugin.json` at the pinned commit; the full table follows the analysis.

| Delivery and authentication | Plugins |
| --- | --- |
| Remote MCP, OAuth browser sign-in only | 222 |
| Remote MCP, no credential | 14 |
| Remote MCP, key in a header only | 6 |
| Remote MCP, OAuth browser sign-in or key | 4 |
| Local loopback MCP (Figma desktop) | 1 |
| stdio, key in an environment variable | 6 |
| stdio, no credential | 2 |
| **Total** | **255** |

The 14 remote servers with no credential are 1inch, Aave, AWS Knowledge, CoinGecko, Context7, Convex, DeepWiki, Exa, Excalidraw, GoDaddy, Hugging Face, Parallel, Svelte and Twilio Docs.
The six remote key-only listings are HighLevel, Omnisend, PostHog, Render, RevenueCat and Tessie.
The four that offer both are Composio, Hindsight, Honcho and Postiz.
The eight stdio listings are Airtable, Apple apps, Brave Search, Firecrawl, HubSpot, Obsidian, Paper and Resend.

By category: productivity 76, coding 42, data-analytics 39, research 27, design 25, other 20, automation 18, documents 8.

Maintainer and licence:

- The manifest field is `creatorName`, which is OpenBot's claim of who made the listing.
  For remote servers the host is on the vendor's own domain, so I treat the vendor as the operator; I did not verify each one.
- The manifests give no licence for any remote server.
  A hosted MCP endpoint is a service under the vendor's terms, and its code is generally not published; each listing carries `privacyPolicyUrl` and `termsUrl` instead.
- Seven stdio packages were checked live on 2026-11-25 (npm `license` field and the GitHub licence detector):

| Package | Pinned by OpenBot | Maintainer | Licence | Tool count stated | Read-only mode |
| --- | --- | --- | --- | --- | --- |
| `airtable-mcp-server` | unpinned | Community (`domdomegg`, Adam Jones), although the manifest's `creatorName` says Airtable | MIT | not stated in the README sections read | none found; scopes of the Airtable token limit it |
| `@brave/brave-search-mcp-server` | unpinned | Brave Software (official) | MIT | not stated | not applicable (search only) |
| `firecrawl-mcp` | unpinned | Firecrawl (official) | MIT | 34 with the full profile, 3 on the keyless hosted endpoint, 12 on the search-only endpoint | scrape is read-only only when `CLOUD_SERVICE=true` |
| `@hubspot/mcp-server` | `0.4.0` | HubSpot (npm maintainers with `@hubspot.com` addresses) | MIT on npm; GitHub's detector found none and the repository was last pushed 2025-04-25 | not stated | none found |
| `obsidian-mcp-server` | `3.7.2` (live latest 3.9.0) | Community (`cyanheads`, Casey Hand) | Apache-2.0 | 14 tools, 3 resources | `OBSIDIAN_READ_ONLY=true` |
| `resend-mcp` | unpinned | Resend (official) | MIT | not stated in the lines read | none found |
| `mcp-icloud` (Apple apps) | `2.1.4` (live latest 2.2.2) | Community (`MrGo2`, Carlos Lorenzo) | MIT | 41 tools | the server annotates tools read-only; the README adds that no mode limits it |

- Paper runs `~/.paper/bin/paper mcp`, a relay installed by the proprietary Paper desktop app; its licence is not stated in the tree.
- Figma's desktop server at `http://127.0.0.1:3845/mcp` needs a Dev or Full seat, and its listing says "Read-only for now".

Read-only statements in manifest text (free text, not a machine field): Adobe Analytics (an admin grants "MCP Read-only Access" or "MCP Full Access"), ClickHouse (read-only `SELECT`), Cloudflare (choose "Read only" on the consent page), Figma, Help Scout, Neon (choose at authorize), Otter, Pennylane, Ramp (choose at sign-in), RevenueCat (a read-only key limits to reads), SnapTrade, Truthifi, Ubersuggest, vidIQ and WordPress.com (choose at sign-in).
Render has read-only SQL but no mode.

Four constraints noted by the catalog README show how fragile some listings are:

- Omnisend uses a key because its registration endpoint rejects OpenBot ("unknown application: OpenBot", 400 `invalid_client_metadata`), and the listing "was not tested with a real key".
- GitLab refuses classic personal access tokens on its MCP server, and a listing cannot ask for a server address and a browser sign-in together, so a self-hosted GitLab must be added by hand.
- Honcho and Hindsight offer OAuth by metadata but their documentation names only keys, so both listings keep a key flow.
- Obsidian needs the user to install the Local REST API community plugin and keeps `OBSIDIAN_VERIFY_SSL=false` because the plugin's certificate is self-signed.

## Distinct services

Counting services and not packages:

- 255 listings are 255 vendor services and 247 distinct hosts; no host is shared, so there are no duplicate listings.
- Atlassian covers three products (Jira, Confluence, Bitbucket); Trello is a separate listing from the same company.
- Apple apps covers Calendar, Reminders, Notes, Contacts, Mail, Messages and Safari, which Outlore already offers.
- Aggregators reach many services behind one listing: Composio (already in Outlore), Zapier, Make, IFTTT, Windsor.ai, Apify and Colibird's `localmcp` (mail, calendar and files on the user's computer).
- Superhuman and Coda are two listings of one company, as are WordPress.com and Spacefast (Automattic).
- The eight built-ins add Slack, Discord, Telegram, WhatsApp, GitHub, 1Password, Bitwarden and Proton Pass, none of which is in the marketplace list.

## Fit with Outlore's constraints

From `catalog.ts`, `catalogEntries.ts` and the connectors specification:

- An `Http` backend is `{ header, url }`: one header, one Vault key, no OAuth.
  The specification's sign-in rule is that the owner connects an app "on Composio's own page, not in Outlore", and that a macOS permission is asked from the host's window.
- A `Stdio` backend is a vendored, pinned server run by a system Node with fixed environment; no entry yet passes a Vault secret as an environment variable.
- Every tool is classified Read or Write by exact name after reading the server, and an unnamed tool asks.
  No OpenBot manifest provides that classification, so each added connector needs its `tools` map written from a real `tools/list`.
- Permissive licence is recorded per entry (`licence`).
  Hosted servers have no licence to record, so the entry would carry the vendor's terms instead; that needs a decision.

Three consequences:

1. **Immediately addable without new sign-in code (24 listings).**
   The remote servers with no credential need no secret, and those with a header key need only the existing Vault and `Http` backend.
   The four key-or-OAuth listings can start with the key.
2. **One piece of shared work unlocks 226 listings.**
   A generic MCP OAuth client on the host (protected-resource discovery, dynamic registration or a client metadata document, PKCE, a loopback callback, token refresh, tokens in the Vault, an `Authorization` header added by the host and never shown to the model).
   OpenBot's design is the reference: its `McpOAuth` renews tokens without a browser, drops them on `invalid_grant`, and its proxy hands a provider only a route-bound bearer.
   The sign-in page is the vendor's own, which fits Outlore's rule; the callback listener is not a sign-in screen in Outlore.
3. **Stdio entries need a secret-to-environment path.**
   Brave Search, Firecrawl, Resend, HubSpot, Airtable and Obsidian keep their key in an environment variable, so the `Stdio` backend must take a Vault value without showing it to the model or logging it.

## Inventory of all 255 marketplace listings

Delivery "remote MCP" is an HTTPS URL.
Authentication "OAuth, browser" is a `link` flow, and "key" a `key` flow (a header for remote, an environment variable for stdio).

| Slug | Vendor (manifest creatorName) | Category | Delivery | Authentication | Endpoint or command | Read-only statement |
| --- | --- | --- | --- | --- | --- | --- |
| 1inch | 1inch | coding | remote MCP | none | `api.1inch.com/mcp/protocol` |  |
| 21st | 21st | coding | remote MCP | OAuth, browser | `21st.dev/api/mcp` |  |
| 2chat | 2Chat | productivity | remote MCP | OAuth, browser | `mcp.2chat.io/mcp` |  |
| aave | Avara | data-analytics | remote MCP | none | `mcp.aave.com/mcp` |  |
| adobe-analytics | Adobe | data-analytics | remote MCP | OAuth, browser | `aa-mcp.adobe.io/mcp` | read-only grant available |
| adspirer | Adspirer | data-analytics | remote MCP | OAuth, browser | `mcp.adspirer.com/mcp` |  |
| affinity | Affinity | productivity | remote MCP | OAuth, browser | `mcp.affinity.co/mcp` |  |
| agentmail | AgentMail | automation | remote MCP | OAuth, browser | `mcp.agentmail.to/mcp` |  |
| ahrefs | Ahrefs | research | remote MCP | OAuth, browser | `api.ahrefs.com/mcp/mcp` |  |
| airtable | Airtable | data-analytics | stdio | key | `npx -y airtable-mcp-server` |  |
| airwallex | Airwallex | other | remote MCP | OAuth, browser | `mcp.airwallex.com/mcp` |  |
| akiflow | Akiflow | productivity | remote MCP | OAuth, browser | `mcp.akiflow.com/mcp` |  |
| aleph | Aleph | data-analytics | remote MCP | OAuth, browser | `mcp.getaleph.com/mcp` |  |
| algolia | Algolia | coding | remote MCP | OAuth, browser | `mcp.algolia.com/mcp` |  |
| allo | Allo | productivity | remote MCP | OAuth, browser | `mcp.withallo.com/mcp` |  |
| alphavantage | Alpha Vantage | data-analytics | remote MCP | OAuth, browser | `mcp.alphavantage.co/mcp` |  |
| amplemarket | Amplemarket | research | remote MCP | OAuth, browser | `mcp.amplemarket.com/mcp` |  |
| amplitude | Amplitude | data-analytics | remote MCP | OAuth, browser | `mcp.amplitude.com/mcp` |  |
| ando | Ando | productivity | remote MCP | OAuth, browser | `mcp.ando.so/mcp` |  |
| apify | Apify | research | remote MCP | OAuth, browser | `mcp.apify.com` |  |
| apollo | Apollo.io | research | remote MCP | OAuth, browser | `mcp.apollo.io/mcp` |  |
| apple-apps | MrGo2 | productivity | stdio | none | `npx -y mcp-icloud@2.1.4` |  |
| appsignal | AppSignal | coding | remote MCP | OAuth, browser | `appsignal.com/api/mcp` |  |
| artie | Artie | data-analytics | remote MCP | OAuth, browser | `mcp.artie.com/mcp` |  |
| atlan | Atlan | data-analytics | remote MCP | OAuth, browser | `mcp.atlan.com/mcp` |  |
| atlassian | Atlassian | productivity | remote MCP | OAuth, browser | `mcp.atlassian.com/v2/mcp` |  |
| attio | Attio | productivity | remote MCP | OAuth, browser | `mcp.attio.com/mcp` |  |
| aws-knowledge | Amazon Web Services | coding | remote MCP | none | `knowledge-mcp.global.api.aws` |  |
| base44 | Base44 | coding | remote MCP | OAuth, browser | `app.base44.com/mcp` |  |
| basecamp | 37signals | productivity | remote MCP | OAuth, browser | `mcp.basecamp.com/mcp` |  |
| beehiiv | beehiiv | productivity | remote MCP | OAuth, browser | `mcp.beehiiv.com/mcp` |  |
| betterstack | Better Stack | coding | remote MCP | OAuth, browser | `mcp.betterstack.com` |  |
| bird | Bird | automation | remote MCP | OAuth, browser | `mcp.bird.com` |  |
| blotato | Blotato | automation | remote MCP | OAuth, browser | `mcp.blotato.com/mcp` |  |
| brave-search | Brave | research | stdio | key | `npx -y @brave/brave-search-mcp-server` |  |
| brex | Brex | other | remote MCP | OAuth, browser | `api.brex.com/mcp` |  |
| brightdata | Bright Data | research | remote MCP | OAuth, browser | `mcp.brightdata.com/mcp` |  |
| browserless | Browserless | automation | remote MCP | OAuth, browser | `mcp.browserless.io/mcp` |  |
| buffer | Buffer | automation | remote MCP | OAuth, browser | `mcp.buffer.com/mcp` |  |
| buildkite | Buildkite | coding | remote MCP | OAuth, browser | `mcp.buildkite.com/mcp` |  |
| calendly | Calendly | productivity | remote MCP | OAuth, browser | `mcp.calendly.com` |  |
| canva | Canva | design | remote MCP | OAuth, browser | `mcp.canva.com/mcp` |  |
| cartesia | Cartesia | design | remote MCP | OAuth, browser | `mcp.cartesia.ai/mcp` |  |
| circleback | Circleback | productivity | remote MCP | OAuth, browser | `circleback.ai/api/mcp` |  |
| clarify | Searis | data-analytics | remote MCP | OAuth, browser | `mcp.clarify.io/mcp` |  |
| clerk | Clerk | coding | remote MCP | OAuth, browser | `mcp.clerk.com/mcp` |  |
| clickhouse | ClickHouse | data-analytics | remote MCP | OAuth, browser | `mcp.clickhouse.cloud/mcp` | read-only queries |
| clickup | ClickUp | productivity | remote MCP | OAuth, browser | `mcp.clickup.com/mcp` |  |
| close | Close | productivity | remote MCP | OAuth, browser | `mcp.close.com/mcp` |  |
| cloud66 | Cloud 66 | coding | remote MCP | OAuth, browser | `app.cloud66.com/mcp` |  |
| cloudflare | Cloudflare | coding | remote MCP | OAuth, browser | `mcp.cloudflare.com/mcp` | Read only choice at consent |
| cloudinary | Cloudinary | design | remote MCP | OAuth, browser | `asset-management.mcp.cloudinary.com/mcp` |  |
| cobrain | Cobrain | productivity | remote MCP | OAuth, browser | `cobrain.space/mcp` |  |
| coda | Superhuman | documents | remote MCP | OAuth, browser | `coda.io/apis/mcp` |  |
| coinbase | Coinbase | data-analytics | remote MCP | OAuth, browser | `agents.coinbase.com/mcp` |  |
| coingecko | CoinGecko | data-analytics | remote MCP | none | `mcp.api.coingecko.com/mcp` |  |
| composio | Composio | automation | remote MCP | OAuth, browser + key | `connect.composio.dev/mcp` |  |
| context7 | Upstash | research | remote MCP | none | `mcp.context7.com/mcp` |  |
| convex | Convex | coding | remote MCP | none | `mcp.convex.dev/mcp` |  |
| craft | Craft Docs | documents | remote MCP | OAuth, browser | `mcp.craft.do/my/mcp` |  |
| crustdata | Crustdata | research | remote MCP | OAuth, browser | `mcp.crustdata.com/mcp` |  |
| customerio | Customer.io | automation | remote MCP | OAuth, browser | `mcp.customer.io/mcp` |  |
| dart | Dart | productivity | remote MCP | OAuth, browser | `mcp.dartai.com/mcp` |  |
| datadog | Datadog | coding | remote MCP | OAuth, browser | `mcp.datadoghq.com/v1/mcp` |  |
| dataforseo | DataForSEO | research | remote MCP | OAuth, browser | `mcp.dataforseo.com/mcp` |  |
| dealroom | Dealroom.co | research | remote MCP | OAuth, browser | `mcp.dealroom.co/mcp` |  |
| deepledger | DeepLedger | other | remote MCP | OAuth, browser | `mcp.deepledger.ai/mcp` |  |
| deepwiki | Cognition | coding | remote MCP | none | `mcp.deepwiki.com/mcp` |  |
| dida365 | Hangzhou Suishouji Network Technology | productivity | remote MCP | OAuth, browser | `mcp.dida365.com` |  |
| digitalocean | DigitalOcean | coding | remote MCP | OAuth, browser | `mcp.digitalocean.com/mcp` |  |
| dropbox | Dropbox | documents | remote MCP | OAuth, browser | `mcp.dropbox.com/mcp` |  |
| eden | Eden | productivity | remote MCP | OAuth, browser | `mcp.eden.so/mcp` |  |
| elevenlabs | ElevenLabs | design | remote MCP | OAuth, browser | `api.elevenlabs.io/v1/mcp` |  |
| era | Era | productivity | remote MCP | OAuth, browser | `context.era.app/mcp` |  |
| etoro | eToro | data-analytics | remote MCP | OAuth, browser | `mcp.public-api.etoro.com/mcp` |  |
| evernote | Evernote | documents | remote MCP | OAuth, browser | `mcp.evernote.com/mcp` |  |
| exa | Exa | research | remote MCP | none | `mcp.exa.ai/mcp` |  |
| excalidraw | Excalidraw | design | remote MCP | none | `mcp.excalidraw.com/mcp` |  |
| extend | Extend | other | remote MCP | OAuth, browser | `mcp.paywithextend.com/mcp` |  |
| fal | fal | design | remote MCP | OAuth, browser | `mcp.fal.ai/mcp-relay` |  |
| fanvue | Fanvue | other | remote MCP | OAuth, browser | `mcp.fanvue.com/mcp` |  |
| fastmail | Fastmail | productivity | remote MCP | OAuth, browser | `api.fastmail.com/mcp` |  |
| fathom | Fathom | productivity | remote MCP | OAuth, browser | `api.fathom.ai/mcp` |  |
| feishu | Feishu | productivity | remote MCP | OAuth, browser | `mcp.feishu.cn/mcp` |  |
| fellow | Fellow | productivity | remote MCP | OAuth, browser | `fellow.app/mcp` |  |
| figma | Figma | design | local loopback MCP | local app | `http://127.0.0.1:3845/mcp` | read-only for now |
| firecrawl | Firecrawl | research | stdio | key | `npx -y firecrawl-mcp` |  |
| fireflies | Fireflies.ai | productivity | remote MCP | OAuth, browser | `api.fireflies.ai/mcp` |  |
| floot | Floot | coding | remote MCP | OAuth, browser | `mcp.floot.com/mcp` |  |
| folk | folk | productivity | remote MCP | OAuth, browser | `mcp.folk.app/mcp` |  |
| freee | freee | other | remote MCP | OAuth, browser | `mcp.freee.co.jp/mcp` |  |
| futu | Futu | data-analytics | remote MCP | OAuth, browser | `mcp.futunn.com/mcp` |  |
| gitbook | GitBook | documents | remote MCP | OAuth, browser | `mcp.gitbook.com/mcp` |  |
| gitlab | GitLab | coding | remote MCP | OAuth, browser | `gitlab.com/api/v4/mcp` |  |
| godaddy | GoDaddy | other | remote MCP | none | `mcp.godaddy.com` |  |
| gojiberry | Gojiberry | research | remote MCP | OAuth, browser | `mcp.gojiberry.ai` |  |
| grafana | Grafana Labs | coding | remote MCP | OAuth, browser | `mcp.grafana.com/mcp` |  |
| granola | Granola | productivity | remote MCP | OAuth, browser | `mcp.granola.ai/mcp` |  |
| greenhouse | Greenhouse | productivity | remote MCP | OAuth, browser | `mcp.greenhouse.io/mcp` |  |
| guru | Guru | documents | remote MCP | OAuth, browser | `mcp.api.getguru.com/mcp` |  |
| harmonic | Harmonic | research | remote MCP | OAuth, browser | `mcp.api.harmonic.ai` |  |
| helium10 | Helium 10 | data-analytics | remote MCP | OAuth, browser | `mcp.helium10.com/mcp` |  |
| helpscout | Help Scout | productivity | remote MCP | OAuth, browser | `mcp.helpscout.net/mcp` | read-only |
| hex | Hex Technologies | data-analytics | remote MCP | OAuth, browser | `app.hex.tech/mcp` |  |
| heyreach | HeyReach | automation | remote MCP | OAuth, browser | `mcp.heyreach.io/mcp` |  |
| higgsfield | Higgsfield | design | remote MCP | OAuth, browser | `mcp.higgsfield.ai/mcp` |  |
| highlevel | HighLevel | productivity | remote MCP | key | `services.leadconnectorhq.com/mcp` |  |
| hindsight | Vectorize | productivity | remote MCP | OAuth, browser + key | `api.hindsight.vectorize.io/mcp` |  |
| honcho | Plastic Labs | productivity | remote MCP | OAuth, browser + key | `mcp.honcho.dev` |  |
| hospitable | Hospitable | productivity | remote MCP | OAuth, browser | `mcp.hospitable.com/mcp` |  |
| hostinger | Hostinger | coding | remote MCP | OAuth, browser | `mcp.hostinger.com` |  |
| hubspot | HubSpot | productivity | stdio | key | `npx -y @hubspot/mcp-server@0.4.0` |  |
| huggingface | Hugging Face | research | remote MCP | none | `huggingface.co/mcp` |  |
| ibkr | Interactive Brokers | data-analytics | remote MCP | OAuth, browser | `api.ibkr.com/v1/api/mcp-public` |  |
| ifttt | IFTTT | automation | remote MCP | OAuth, browser | `ifttt.com/mcp` |  |
| incidentio | incident.io | coding | remote MCP | OAuth, browser | `mcp.incident.io/mcp` |  |
| instantly | Instantly | productivity | remote MCP | OAuth, browser | `mcp.instantly.ai/mcp` |  |
| intercom | Intercom | productivity | remote MCP | OAuth, browser | `mcp.intercom.com/mcp` |  |
| invideo | invideo | design | remote MCP | OAuth, browser | `mcp.invideo.io/mcp` |  |
| jobtread | JobTread | productivity | remote MCP | OAuth, browser | `api.jobtread.com/mcp` |  |
| kajabi | Kajabi | productivity | remote MCP | OAuth, browser | `mcp.kajabi.com/mcp` |  |
| kensho | Kensho Technologies | data-analytics | remote MCP | OAuth, browser | `kfinance.kensho.com/integrations/mcp` |  |
| kit | Kit | productivity | remote MCP | OAuth, browser | `app.kit.com/mcp` |  |
| klaviyo | Klaviyo | productivity | remote MCP | OAuth, browser | `mcp.klaviyo.com/mcp` |  |
| knowify | Knowify | productivity | remote MCP | OAuth, browser | `assistant.knowify.com/api/v2/mcp` |  |
| krisp | Krisp | productivity | remote MCP | OAuth, browser | `mcp.krisp.ai/mcp` |  |
| lark | Lark Technologies | documents | remote MCP | OAuth, browser | `mcp.larksuite.com/mcp` |  |
| launchdarkly | LaunchDarkly | coding | remote MCP | OAuth, browser | `mcp.launchdarkly.com/mcp` |  |
| lemlist | lemlist | productivity | remote MCP | OAuth, browser | `app.lemlist.com/mcp` |  |
| linear | Linear | coding | remote MCP | OAuth, browser | `mcp.linear.app/mcp` |  |
| littlebird | Littlebird | productivity | remote MCP | OAuth, browser | `mcp.littlebird.ai/mcp` |  |
| localmcp | Colibird | productivity | remote MCP | OAuth, browser | `www.local-mcp.com/mcp` |  |
| longbridge | Longbridge | data-analytics | remote MCP | OAuth, browser | `mcp.longbridge.com` |  |
| lovable | Lovable | coding | remote MCP | OAuth, browser | `mcp.lovable.dev` |  |
| lusha | Lusha | research | remote MCP | OAuth, browser | `mcp.lusha.com` |  |
| magicpatterns | Magic Patterns | design | remote MCP | OAuth, browser | `mcp.magicpatterns.com/mcp` |  |
| magnific | Magnific | design | remote MCP | OAuth, browser | `mcp.magnific.com` |  |
| mailerlite | MailerLite | productivity | remote MCP | OAuth, browser | `mcp.mailerlite.com/mcp` |  |
| make | Make | automation | remote MCP | OAuth, browser | `mcp.make.com/v2` |  |
| massive | Massive | data-analytics | remote MCP | OAuth, browser | `mcp.massive.com` |  |
| mem | Mem | productivity | remote MCP | OAuth, browser | `mcp.mem.ai/mcp` |  |
| mem0 | Mem0 | productivity | remote MCP | OAuth, browser | `mcp.mem0.ai/mcp/` |  |
| mercury | Mercury | other | remote MCP | OAuth, browser | `mcp.mercury.com/mcp` |  |
| meta-ads | Meta | data-analytics | remote MCP | OAuth, browser | `mcp.facebook.com/ads` |  |
| metricool | Metricool | data-analytics | remote MCP | OAuth, browser | `ai.metricool.com/mcp` |  |
| miro | Miro | design | remote MCP | OAuth, browser | `mcp.miro.com/` |  |
| mixpanel | Mixpanel | data-analytics | remote MCP | OAuth, browser | `mcp.mixpanel.com/mcp` |  |
| mobbin | Mobbin | design | remote MCP | OAuth, browser | `api.mobbin.com/mcp` |  |
| monarch | Monarch | other | remote MCP | OAuth, browser | `api.monarch.com/mcp` |  |
| monday | monday.com | productivity | remote MCP | OAuth, browser | `mcp.monday.com/mcp` |  |
| moomoo | moomoo | data-analytics | remote MCP | OAuth, browser | `mcp.moomoo.com/mcp` |  |
| mural | Mural | design | remote MCP | OAuth, browser | `mcp-canvas.mural.co/mcp` |  |
| navan | Navan | data-analytics | remote MCP | OAuth, browser | `mcp.navan.com/mcp` |  |
| neon | Neon | coding | remote MCP | OAuth, browser | `mcp.neon.tech/mcp` | read-only choice at authorize |
| netlify | Netlify | coding | remote MCP | OAuth, browser | `netlify-mcp.netlify.app/mcp` |  |
| northbeam | Northbeam | data-analytics | remote MCP | OAuth, browser | `mcp.northbeam.io` |  |
| notion | Notion | productivity | remote MCP | OAuth, browser | `mcp.notion.com/mcp` |  |
| obsidian | Obsidian | productivity | stdio | key | `npx -y obsidian-mcp-server@3.7.2` |  |
| omneky | Omneky | design | remote MCP | OAuth, browser | `mcp.omneky.com/mcp` |  |
| omnisend | Omnisend | automation | remote MCP | key | `mcp.omnisend.com/mcp` |  |
| openart | OpenArt | design | remote MCP | OAuth, browser | `mcp.openart.ai/mcp` |  |
| opusclip | OpusClip | design | remote MCP | OAuth, browser | `mcp.opus.pro/mcp` |  |
| otter | Otter.ai | productivity | remote MCP | OAuth, browser | `mcp.otter.ai/mcp` | read-only |
| pandadoc | PandaDoc | documents | remote MCP | OAuth, browser | `mcp.pandadoc.com/v1/mcp` |  |
| paper | Paper | design | stdio | none | `~/.paper/bin/paper mcp` |  |
| parallel | Parallel Web Systems | research | remote MCP | none | `mcp.parallel.ai/mcp` |  |
| pennylane | Pennylane | other | remote MCP | OAuth, browser | `mcp.pennylane.com/mcp` | read-only |
| picsart | Picsart | design | remote MCP | OAuth, browser | `api.picsart.com/gen-ai/mcp` |  |
| pipedrive | Pipedrive | productivity | remote MCP | OAuth, browser | `mcp.pipedrive.ai/mcp` |  |
| planetscale | PlanetScale | coding | remote MCP | OAuth, browser | `mcp.pscale.dev/mcp/planetscale` |  |
| planningcenter | Planning Center | productivity | remote MCP | OAuth, browser | `mcp.planningcenteronline.com/mcp` |  |
| plaud | Plaud | productivity | remote MCP | OAuth, browser | `mcp.plaud.ai/mcp` |  |
| posthog | PostHog | data-analytics | remote MCP | key | `mcp.posthog.com/mcp` |  |
| postiz | Postiz | automation | remote MCP | OAuth, browser + key | `mcp.postiz.com/mcp-oauth-dynamic` |  |
| postman | Postman | coding | remote MCP | OAuth, browser | `mcp.postman.com/mcp` |  |
| prisma | Prisma | coding | remote MCP | OAuth, browser | `mcp.prisma.io/mcp` |  |
| profound | Profound | data-analytics | remote MCP | OAuth, browser | `mcp.tryprofound.com/mcp` |  |
| public | Public | data-analytics | remote MCP | OAuth, browser | `mcp.public.com/mcp` |  |
| pylon | Pylon | productivity | remote MCP | OAuth, browser | `mcp.usepylon.com` |  |
| qonto | Qonto | other | remote MCP | OAuth, browser | `mcp.qonto.com/mcp` |  |
| quo | Quo | productivity | remote MCP | OAuth, browser | `mcp.quo.com/mcp` |  |
| railway | Railway | coding | remote MCP | OAuth, browser | `mcp.railway.com` |  |
| raindrop | Raindrop.io | productivity | remote MCP | OAuth, browser | `api.raindrop.io/rest/v2/ai/mcp` |  |
| ramp | Ramp | other | remote MCP | OAuth, browser | `mcp.ramp.com/mcp` | full or read-only at sign-in |
| readai | Read AI | productivity | remote MCP | OAuth, browser | `api.read.ai/mcp` |  |
| readwise | Readwise | research | remote MCP | OAuth, browser | `mcp2.readwise.io/mcp` |  |
| refero | Refero | design | remote MCP | OAuth, browser | `api.refero.design/mcp` |  |
| render | Render | coding | remote MCP | key | `mcp.render.com/mcp` | read-only SQL tool; no mode |
| resend | Resend | automation | stdio | key | `npx -y resend-mcp` |  |
| restream | Restream | productivity | remote MCP | OAuth, browser | `mcp.restream.io/mcp` |  |
| revenuecat | RevenueCat | other | remote MCP | key | `mcp.revenuecat.ai/mcp` | read-only key |
| riverside | Riverside | design | remote MCP | OAuth, browser | `mcp.riverside.com/mcp` |  |
| roam | Roam Research | productivity | remote MCP | OAuth, browser | `mcp.roamresearch.com/mcp` |  |
| robinhood | Robinhood | data-analytics | remote MCP | OAuth, browser | `agent.robinhood.com/mcp/trading` |  |
| runpod | Runpod | coding | remote MCP | OAuth, browser | `mcp.runpod.io/` |  |
| runway | Runway | design | remote MCP | OAuth, browser | `mcp.runwayml.com/mcp` |  |
| ryze | Ryze AI | data-analytics | remote MCP | OAuth, browser | `connector.get-ryze.ai/mcp` |  |
| salesloft | Salesloft | productivity | remote MCP | OAuth, browser | `mcp.salesloft.com/mcp` |  |
| sanity | Sanity | coding | remote MCP | OAuth, browser | `mcp.sanity.io` |  |
| scrapecreators | Scrape Creators | research | remote MCP | OAuth, browser | `api.scrapecreators.com/mcp` |  |
| searchatlas | Search Atlas | research | remote MCP | OAuth, browser | `mcp.searchatlas.com/mcp` |  |
| semrush | Semrush | research | remote MCP | OAuth, browser | `mcp.semrush.com/v2/mcp` |  |
| sentry | Sentry | coding | remote MCP | OAuth, browser | `mcp.sentry.dev/mcp` |  |
| seranking | SE Ranking | research | remote MCP | OAuth, browser | `api.seranking.com/mcp` |  |
| servicem8 | ServiceM8 | productivity | remote MCP | OAuth, browser | `api.servicem8.com/mcp` |  |
| smartlead | Smartlead | automation | remote MCP | OAuth, browser | `mcp.smartlead.ai/mcp` |  |
| snaptrade | SnapTrade | data-analytics | remote MCP | OAuth, browser | `agent.snaptrade.com/mcp/portfolio` | read-only |
| sonarqube | SonarSource | coding | remote MCP | OAuth, browser | `api.sonarcloud.io/mcp` |  |
| spacefast | Automattic | productivity | remote MCP | OAuth, browser | `mcp.spacefast.com` |  |
| speko | Speko | automation | remote MCP | OAuth, browser | `mcp.speko.ai/mcp` |  |
| square | Block | other | remote MCP | OAuth, browser | `mcp.squareup.com/mcp` |  |
| statsig | Statsig | coding | remote MCP | OAuth, browser | `api.statsig.com/v3/mcp` |  |
| stripe | Stripe | other | remote MCP | OAuth, browser | `mcp.stripe.com` |  |
| sunra | Sunra | design | remote MCP | OAuth, browser | `mcp.sunra.ai` |  |
| sunsama | Sunsama | productivity | remote MCP | OAuth, browser | `api.sunsama.com/mcp` |  |
| supabase | Supabase | coding | remote MCP | OAuth, browser | `mcp.supabase.com/mcp` |  |
| superhuman | Superhuman | productivity | remote MCP | OAuth, browser | `mcp.mail.superhuman.com/mcp` |  |
| superme | SuperMe | research | remote MCP | OAuth, browser | `mcp.superme.ai/mcp` |  |
| supermemory | Supermemory | productivity | remote MCP | OAuth, browser | `mcp.supermemory.ai/mcp` |  |
| svelte | Svelte | coding | remote MCP | none | `mcp.svelte.dev/mcp` |  |
| syncro | Syncro | productivity | remote MCP | OAuth, browser | `mcp.services.syncromsp.com/mcp/stream` |  |
| tableau | Tableau | data-analytics | remote MCP | OAuth, browser | `mcp.tableau.com` |  |
| tavily | Tavily | research | remote MCP | OAuth, browser | `mcp.tavily.com/mcp` |  |
| tessie | Tessie | other | remote MCP | key | `mcp.tessie.com` |  |
| ticktick | TickTick | productivity | remote MCP | OAuth, browser | `mcp.ticktick.com` |  |
| tinyfish | TinyFish | automation | remote MCP | OAuth, browser | `agent.tinyfish.ai/mcp` |  |
| todoist | Doist | productivity | remote MCP | OAuth, browser | `ai.todoist.net/mcp` |  |
| tradingview | TradingView | data-analytics | remote MCP | OAuth, browser | `mcp.tradingview.com/mcp` |  |
| transcriptapi | TranscriptAPI | research | remote MCP | OAuth, browser | `transcriptapi.com/mcp` |  |
| trello | Atlassian | productivity | remote MCP | OAuth, browser | `mcp.trello.com/v1` |  |
| truthifi | Truthifi | data-analytics | remote MCP | OAuth, browser | `api.truthifi.com/mcp` | read-only |
| trypost | TryPost | automation | remote MCP | OAuth, browser | `app.trypost.it/mcp/trypost` |  |
| turso | Turso | coding | remote MCP | OAuth, browser | `mcp.turso.ai/mcp` |  |
| twilio-docs | Twilio | coding | remote MCP | none | `mcp.twilio.com/docs` |  |
| typeform | Typeform | productivity | remote MCP | OAuth, browser | `api.typeform.com/mcp` |  |
| typefully | Typefully | productivity | remote MCP | OAuth, browser | `mcp.typefully.com/mcp` |  |
| ubersuggest | NP Digital | data-analytics | remote MCP | OAuth, browser | `ubersuggest-mcp.neilpatelapi.com/mcp` | read-only |
| upwork | Upwork | other | remote MCP | OAuth, browser | `mcp.upwork.com/mcp` |  |
| vercel | Vercel | coding | remote MCP | OAuth, browser | `mcp.vercel.com` |  |
| videogen | VideoGen | design | remote MCP | OAuth, browser | `mcp.videogen.io/mcp` |  |
| vidiq | vidIQ | data-analytics | remote MCP | OAuth, browser | `mcp.vidiq.com/mcp` | read-only |
| webflow | Webflow | design | remote MCP | OAuth, browser | `mcp.webflow.com/mcp` |  |
| wellnessproject | Wellness Project | other | remote MCP | OAuth, browser | `wellnessproject.ai/api/mcp` |  |
| whop | Whop | other | remote MCP | OAuth, browser | `mcp.whop.com/mcp` |  |
| windsor | Windsor.ai | data-analytics | remote MCP | OAuth, browser | `mcp.windsor.ai` |  |
| withings | Withings | other | remote MCP | OAuth, browser | `mcp.withings.com/mcp` |  |
| wix | Wix | coding | remote MCP | OAuth, browser | `mcp.wix.com/mcp` |  |
| wordpress | Automattic | productivity | remote MCP | OAuth, browser | `public-api.wordpress.com/wpcom/v2/mcp/v1` | full or read-only at sign-in |
| workable | Workable | productivity | remote MCP | OAuth, browser | `mcp.workable.com/mcp` |  |
| workos | WorkOS | coding | remote MCP | OAuth, browser | `mcp.workos.com/mcp` |  |
| wpvibe | SeedProd | productivity | remote MCP | OAuth, browser | `mcp.wpvibe.ai/mcp` |  |
| ynab | YNAB | productivity | remote MCP | OAuth, browser | `api.ynab.com/mcp` |  |
| you | You.com | research | remote MCP | OAuth, browser | `api.you.com/mcp` |  |
| zapier | Zapier | automation | remote MCP | OAuth, browser | `mcp.zapier.com/api/v1/connect` |  |
| zoominfo | ZoomInfo | research | remote MCP | OAuth, browser | `mcp.zoominfo.com/mcp` |  |

## Ranked shortlist: 30 OpenBot connectors Outlore could add

This ranking is my judgement and not a claim of the source.
The criteria, in order: usefulness to an owner who works with coding agents and a small business; official vendor operation; a read-only way to start; the licence of a server Outlore could pin or reach; and fit with today's backends.
Fit codes: **A** works with the current `Http` backend (no credential, or one header key in the Vault); **B** needs the shared MCP OAuth client described above; **C** needs the `Stdio` backend to take a Vault secret as an environment variable; **L** a local app on the owner's computer.
"Licence" is the licence of an open-source repository of the same vendor, read live on 2026-11-25 from the GitHub API; the manifests do not say whether it is the code behind the hosted URL, so for hosted servers treat it as a hint and not as the licence of the endpoint.
"Not stated" means neither the OpenBot tree nor the vendor pages I read name a licence.
No tool count is stated by OpenBot for any remote server; counts below come from the servers' own documents where I found one.

| Rank | Service | Delivery | Authentication | Maintainer | Licence | Read-only and tools | Fit | Why it ranks here |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | GitHub (built-in) | Remote MCP, `api.githubcopilot.com/mcp/` | OpenBot uses a GitHub App device flow; the server also accepts a personal access token as a Bearer header | GitHub (official) | MIT, `github/github-mcp-server` | `--read-only` and toolset flags documented for the local server, no remote header found in the README read; tool count not stated | A with a token, B with OAuth | Every coding quest needs repositories, issues and pull requests; OpenBot's own proxy shows per-repository scoping |
| 2 | Linear | Remote MCP, `mcp.linear.app/mcp` | OAuth, browser | Linear (official) | Not stated | not stated | B | OpenBot's worked example; issue triage is the commonest planning tool for agents |
| 3 | Notion | Remote MCP, `mcp.notion.com` | OAuth, browser | Notion (official) | MIT for the separate local server `makenotion/notion-mcp-server`; hosted endpoint not stated | not stated | B | One of OpenBot's four featured listings; docs and wikis |
| 4 | Atlassian | Remote MCP, `mcp.atlassian.com` | OAuth, browser | Atlassian (official) | Not stated | not stated | B | Jira, Confluence and Bitbucket in one listing, so one sign-in covers three products |
| 5 | Sentry | Remote MCP, `mcp.sentry.dev` | OAuth, browser | Sentry (official) | Not stated | not stated | B | Error triage is a read-heavy task for coding agents |
| 6 | Context7 | Remote MCP, `mcp.context7.com/mcp` | None | Upstash (official) | MIT, `upstash/context7` | docs lookup only; tool count not stated | A | Library documentation without a secret; the cheapest first win |
| 7 | Supabase | Remote MCP, `mcp.supabase.com` | OAuth, browser | Supabase (official) | Not stated | not stated | B | Database and backend work from an agent |
| 8 | Cloudflare | Remote MCP, `mcp.cloudflare.com` | OAuth, browser | Cloudflare (official) | Apache-2.0, `cloudflare/mcp-server-cloudflare` | consent page offers "Read only" | B | Workers, logs and DNS; a read-only choice exists |
| 9 | Vercel | Remote MCP, `mcp.vercel.com` | OAuth, browser | Vercel (official) | Not stated | not stated | B | Deployments and logs for web projects |
| 10 | GitLab | Remote MCP, `gitlab.com/api/v4/mcp` | OAuth, browser (classic tokens refused) | GitLab (official) | Not stated | not stated | B | The other code host; self-hosted instances need their own address, which OpenBot's listing cannot carry |
| 11 | Stripe | Remote MCP, `mcp.stripe.com` | OAuth, browser | Stripe (official) | MIT, `stripe/ai` | not stated | B | Payments and billing reads for a business owner |
| 12 | Exa | Remote MCP, `mcp.exa.ai/mcp` | None | Exa (official) | MIT, `exa-labs/exa-mcp-server` | search only | A | Web research without a secret |
| 13 | Brave Search | stdio, `npx -y @brave/brave-search-mcp-server` | API key in `BRAVE_API_KEY` | Brave (official) | MIT (live: npm and GitHub) | search only | C | Independent web search; the key comes from Brave's own dashboard |
| 14 | Firecrawl | stdio, `npx -y firecrawl-mcp` | API key in `FIRECRAWL_API_KEY` | Firecrawl (official) | MIT (live: npm and GitHub) | 34 tools in the full profile; scrape read-only only under `CLOUD_SERVICE=true` | C | Page reading and crawling for research |
| 15 | Hugging Face | Remote MCP, `huggingface.co/mcp` | None | Hugging Face (official) | MIT, `huggingface/hf-mcp-server` | not stated | A | Model, dataset and paper search |
| 16 | DeepWiki | Remote MCP, `mcp.deepwiki.com/mcp` | None | Cognition (official) | Not stated | repository questions, not stated | A | Answers about public repositories with no secret |
| 17 | Datadog | Remote MCP, `mcp.datadoghq.com` | OAuth, browser | Datadog (official) | Not stated | not stated | B | Monitoring and logs for operations work |
| 18 | Grafana | Remote MCP, `mcp.grafana.com` | OAuth, browser | Grafana Labs (official) | Apache-2.0, `grafana/mcp-grafana` | not stated | B | Dashboards and alerts |
| 19 | Neon | Remote MCP, `mcp.neon.tech` | OAuth, browser | Neon (official) | MIT, `neondatabase/mcp-server-neon` | read-only choice at authorize | B | Postgres projects with a read-only way in |
| 20 | PostHog | Remote MCP, `mcp.posthog.com/mcp` | Personal API key as a Bearer header | PostHog (official) | MIT, `PostHog/mcp`, but archived 2026-01-19 | not stated | A | Product analytics; fits the header backend as is |
| 21 | Figma | Local loopback MCP, `127.0.0.1:3845/mcp` | Local app with MCP turned on in Figma's own menu | Figma (official) | Not stated | "Read-only for now"; needs a Dev or Full seat | L | Design context for coding quests; no secret, but the owner must keep Figma open |
| 22 | Todoist | Remote MCP, `ai.todoist.net` | OAuth, browser | Doist (official) | Not stated | not stated | B | Personal tasks |
| 23 | ClickUp | Remote MCP, `mcp.clickup.com` | OAuth, browser | ClickUp (official) | Not stated | not stated | B | Team tasks |
| 24 | Airtable | stdio, `npx -y airtable-mcp-server` | Personal access token in `AIRTABLE_API_KEY` | Community (`domdomegg`), not Airtable | MIT | token scopes limit it; tool count not stated | C | Small databases; the community maintainer is a risk to name in the notice |
| 25 | Dropbox | Remote MCP, `mcp.dropbox.com` | OAuth, browser | Dropbox (official) | Not stated | not stated | B | Files and documents |
| 26 | Fastmail | Remote MCP, `api.fastmail.com` | OAuth, browser | Fastmail (official) | Not stated | not stated | B | A mail account that is not tied to a Mac |
| 27 | Resend | stdio, `npx -y resend-mcp` | API key in `RESEND_API_KEY` | Resend (official) | MIT (live: npm and GitHub) | `--allowed-file-dirs` limits file attachments; no read-only mode found | C | Sending transactional mail from a Ritual |
| 28 | HubSpot | stdio, `npx -y @hubspot/mcp-server@0.4.0` | Service key in `PRIVATE_APP_ACCESS_TOKEN` | HubSpot (official npm scope) | MIT on npm; GitHub's detector found none | not stated | C | CRM for a business owner; the repository was last pushed 2025-04-25 |
| 29 | Zapier | Remote MCP, `mcp.zapier.com` | OAuth, browser | Zapier (official) | Not stated | not stated | B | An aggregator like Composio; overlaps the connector Outlore has, so place it after the direct ones |
| 30 | Obsidian | stdio, `npx -y obsidian-mcp-server@3.7.2` | Local REST API plugin key in `OBSIDIAN_API_KEY`, plus `OBSIDIAN_BASE_URL` | Community (`cyanheads`) | Apache-2.0 | 14 tools; `OBSIDIAN_READ_ONLY=true` | C | A note vault on the owner's own computer, with a read-only switch |

What the shortlist does not include, and why:

- **Slack, Discord, Telegram.**
  They are hosted channels run by OpenBot's infrastructure, not MCP servers.
  The services have their own MCP servers or APIs; another research errand covers them.
- **WhatsApp.**
  It needs a QR code or a pairing code shown in the app, which Outlore has no screen for.
- **1Password, Bitwarden, Proton Pass.**
  They feed a browser sign-in and expose no tools.
  Outlore's rule that secrets never reach the model fits them, but their use is a Vault and browser design question and not a connector listing.
- **Apple apps and Composio.**
  Already in the Outlore catalog.
- **Finance and trading listings** (Robinhood, Interactive Brokers, Coinbase, Public, Futu and similar).
  The tools can place orders; classify them only after a separate review.
- **The other listings.**
  Marketing, sales-outreach, creative-media and vertical SaaS services stay in the table as candidates for a second round.

## Open questions this note leaves

1. Which of the 14 no-credential remote servers answer `initialize` with no account today: OpenBot's smoke script `bun run test:mcp-catalog` says it checks this, but I did not run it, and it needs the network.
2. Whether a hosted server's tool list matches a pinned repository's: Outlore classifies tools by exact name, so each entry needs its real `tools/list` captured, as the Apple entry's fixture does.
3. How a connector with no licence to record (a hosted service) is shown in a catalog whose entry has a `licence` field.
4. Whether an owner-visible notice should name that the vendor sees what the tools return, as the Composio entry's notice does.

## Sources

- [OpenBot repository at the pinned commit](https://github.com/nightly-labs/openbot/tree/b1e5ea74206e1e16fa2eae62d8d131ea1349eaa0) and its [connector registry](https://github.com/nightly-labs/openbot/blob/b1e5ea74206e1e16fa2eae62d8d131ea1349eaa0/src/renderer/src/features/connectors/connector-registry.ts).
- [Plugin manifests](https://github.com/nightly-labs/openbot/tree/b1e5ea74206e1e16fa2eae62d8d131ea1349eaa0/marketplace/plugin-catalog/plugins), [catalog README](https://github.com/nightly-labs/openbot/blob/b1e5ea74206e1e16fa2eae62d8d131ea1349eaa0/marketplace/plugin-catalog/README.md), [catalog build script](https://github.com/nightly-labs/openbot/blob/b1e5ea74206e1e16fa2eae62d8d131ea1349eaa0/scripts/build-plugin-catalog.ts).
- [Integrations and sign-in](https://github.com/nightly-labs/openbot/blob/b1e5ea74206e1e16fa2eae62d8d131ea1349eaa0/docs/architecture/integrations.md) and [channels and messaging](https://github.com/nightly-labs/openbot/blob/b1e5ea74206e1e16fa2eae62d8d131ea1349eaa0/docs/architecture/channels-and-messaging.md) at the same commit.
- GitHub MCP server README, read 2026-11-25: `https://raw.githubusercontent.com/github/github-mcp-server/main/README.md`.
- npm registry and GitHub API for the package and repository licences, read 2026-11-25.
