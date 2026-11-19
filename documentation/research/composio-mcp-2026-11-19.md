# Composio's consumer MCP: the tools Outlore's connector offers (read 2026-11-19)

Primary sources read for the Composio catalog entry and the Streamable-HTTP backend (CHG-0535). Composio is the
connector Outlore's specification names first; the claims below are from Composio's own docs and the ComposioHQ/composio
repo, never from a third party's summary. Nothing here was checked against the live server: no key was held and no
request was sent.

## Sources

- `https://docs.composio.dev/docs/composio-connect` (fetched 2026-11-19) — "Composio Connect is an MCP server at
  `https://connect.composio.dev/mcp`" that exposes **7 meta-tools** "so your agent can discover, connect, and execute
  upstream tools"; the consumer key: "Copy your consumer API key from the AI Clients setup in the Composio dashboard";
  client setups send `x-consumer-api-key` as the header name.
- Repo `ComposioHQ/composio`, branch `next`, commit `454b04fd7f2b3a3b04db933e42782e2885fb6876` (MIT; read 2026-11-19):
  - `docs/content/docs/composio-connect.mdx` — the source of the docs page above: URL
    `https://connect.composio.dev/mcp`, `x-consumer-api-key` header in every client recipe (Muse: "API key sent in the
    x-consumer-api-key header", n8n: `"x-consumer-api-key": "YOUR_CONSUMER_KEY"`), "the 7 meta-tools" with the exact
    list.
  - `ts/packages/cli/src/utils/meta-tool-slugs.ts` — the seven slugs, `satisfies`-synced with the API's
    `SessionExecuteMetaParams['slug']`: `COMPOSIO_SEARCH_TOOLS`, `COMPOSIO_GET_TOOL_SCHEMAS`,
    `COMPOSIO_MULTI_EXECUTE_TOOL`, `COMPOSIO_MANAGE_CONNECTIONS`, `COMPOSIO_WAIT_FOR_CONNECTIONS`,
    `COMPOSIO_REMOTE_WORKBENCH`, `COMPOSIO_REMOTE_BASH_TOOL`.
  - `docs/lib/meta-tool-overrides.ts` — Composio's own hand-written summaries, the closest primary source for what each
    meta-tool does: search "discovers the right tools … and returns them with an execution plan, connection status";
    schemas "returns the full input schema for tools you already know the slug for"; execute "executes up to 50 tools
    in parallel"; manage-connections "create, list, rename, or remove OAuth connections"; wait "wait for the user to
    complete an OAuth flow" (per the Connect page's list); workbench "runs Python in a persistent remote sandbox";
    bash "runs bash commands in a remote sandbox".
  - `docs/kb/source/toolkits/reddit/public.md` — "Use exactly this URL … switch the MCP server URL to
    `https://connect.composio.dev/mcp` … configure the current `x-consumer-api-key` header".
- `https://docs.composio.dev/docs/sessions-via-mcp` and `/docs/configuring-sessions` (fetched 2026-11-19) — session
  (SDK-created) MCP endpoints; read for the narrowing question below.

## The seven meta-tools and their classes (catalog.ts)

| Tool (exact name) | What it does (Composio's override file's words, condensed) | Class |
| --- | --- | --- |
| `COMPOSIO_SEARCH_TOOLS` | Discovers tools across every toolkit for a task, with an execution plan and connection status. | Read |
| `COMPOSIO_GET_TOOL_SCHEMAS` | Returns the full input schema for slugs the search returned. | Read |
| `COMPOSIO_MULTI_EXECUTE_TOOL` | Executes up to 50 tools in parallel across connected apps. | Write |
| `COMPOSIO_MANAGE_CONNECTIONS` | Creates, lists, renames or removes OAuth connections to upstream apps. | Write |
| `COMPOSIO_WAIT_FOR_CONNECTIONS` | Waits for the owner to complete an OAuth flow. | Write |
| `COMPOSIO_REMOTE_WORKBENCH` | Runs Python in a persistent remote sandbox. | Write |
| `COMPOSIO_REMOTE_BASH_TOOL` | Runs bash commands in a remote sandbox. | Write |

- The two `Read` tools are verified pure discovery by Composio's own words: search answers tools, a plan and connection
  status; schemas answers the schema of a known slug. Neither runs an app's tool nor changes a connection. A search's
  answer does tell the thread which of the owner's apps are already connected — the same reach a tool listing has,
  which the specification treats as unasked.
- Everything that executes, connects or runs code is `Write`: it asks, per the specification ("its execution tools are
  never Read"). Safety of "Execution" applies to note: `COMPOSIO_MULTI_EXECUTE_TOOL` moves data outside the host and its
  answer's content goes to the thread's model provider.
- A tool Composio adds is unnamed by the catalog, so it is unclassified and asks: adding one needs a deliberate entry.

## What no session-less narrowing means

The Composio Connect URL serves the fixed seven meta-tools to any holder of the consumer key; nothing in the docs or
the repo's docs source shows a way to scope it to read-only toolkits or to chosen apps. Server-side narrowing is a
feature of Composio **session** MCP endpoints (`composio.sessions.create(...)` with a project API key: `toolkits`
filters, `tools` enable/disable, `tags.disable` by hint, `require_approval`), which requires the SDK and a project key
— a different product shape from Outlore's consumer-key catalog entry. If the owner ever wants server-side read-only
narrowing, that is a design decision to revisit (a session per Outlore workspace, held like the key), not a setting this
entry can pass today. Until then Outlore's own gates hold: every non-`Read` tool asks before it runs.

## How the backend speaks to it (backends/httpMcp.ts)

- Streamable HTTP (the docs say "remote streamable HTTP" transport): one JSON-RPC `POST` per `tools/list` or
  `tools/call`, the key in the `x-consumer-api-key` header alone. **Not checked against the live server**: whether
  `connect.composio.dev/mcp` answers these without a prior `initialize` is assumed from the docs' stateless recipes
  (clients list tools right after adding the URL; the MCP Streamable HTTP transport allows stateless serving). If the
  first real run refuses it, the fallback is one `initialize` request when the backend opens, cached per open.
- Status mapping: 401/403 the consumer key rejected (Disconnected); 429 and 5xx unreachable; JSON-RPC `-32602`
  invalid arguments (the thread's own malformed call); everything else, an `isError` result included, failed. No answer
  text of the server leaves the backend: a rejection may echo the key it was given.

## Follow-up checks for the owner's first real run

- The consumer key is issued by the "AI Clients" setup page in the Composio dashboard (docs' words); the owner holds
  their own account. Nothing has been sent to Composio from this work, and nothing can be until the Vault exists.
- Tool listings: confirm the seven names arrive as above, and confirm a stateless `tools/list` is accepted.
- OAuth links in results start on Composio's own page (the Connect page: "the first time your agent needs an app,
  Composio generates an OAuth link you approve in your browser").
