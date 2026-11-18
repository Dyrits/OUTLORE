---
status: accepted
---

# Code Mode runs the model's code in QuickJS compiled to WebAssembly, inside the host service

Decided by the owner on 2026-11-17 ([CHG-0441](../changelog/0.1.7-Prototype.md)). Code Mode for connectors ([connectors specification](../capabilities/connectors/specifications.md#code-mode), CHG-0324) lets a thread reach its connectors' tools by writing a short JavaScript program instead of calling each tool. That program comes from a model and must run where it has no file, no environment, no network and no process of its own, and reaches only the connector calls Outlore hands it. Outlore runs it in **QuickJS compiled to WebAssembly** (`quickjs-emscripten-core` with the single-file synchronous release build, MIT, pinned at 0.32.0), in the host service's own process, one fresh runtime per call.

## Why

- **Nothing to deny, because nothing is there.** A QuickJS context starts with the ECMAScript built-ins only: no `fetch`, no `require`, no `process`, no file or socket API. Each connector function is added by the host and is the only way out. A denial list would have to be kept complete; this has nothing to list.
- **Limits Outlore can set**: a memory ceiling, a stack ceiling, an interrupt on CPU time, and a cap on connector calls per run, all per runtime.
- **Ships as JavaScript.** The WebAssembly is inlined in one module that `bun build` bundles into `service.js` (about 1.2 MB measured), with no native build for macOS, Windows or Linux and no extra binary. It ran unchanged under Node 26, Bun 1.4 and the bundled service.
- **Local.** The code's data, which is what a connector returns, stays on the host ([Local data](../requirements.md#privacy-and-data)).
- **Waiting is free.** A connector call is a promise inside QuickJS that Outlore resolves when the call ends, so a write that waits for the owner's answer holds no CPU and is not counted against the time limit.

## Considered Options

- **Cloudflare's `DynamicWorkerExecutor` on the owner's account** (`@cloudflare/codemode` 0.5.6, the relay's account, [0016](0016-shared-relay-on-the-owners-free-cloudflare-account.md)): rejected. Connector results would leave the host for Cloudflare, and every run would need the network and the owner's Cloudflare setup.
- **`isolated-vm`** (a V8 isolate): rejected. Faster, but a native module to build and ship per platform, with slower maintenance.
- **A Deno child process with every permission off**: rejected. Strong isolation, but a runtime of about 100 MB to ship and update.
- **Node's `vm` module**: rejected. Node documents it as not a security mechanism.
- **Depending on `@cloudflare/codemode` for its types and wrappers**: rejected. Its package brings the AI SDK, Zod, the MCP SDK and Cloudflare Worker types; Outlore reuses its design (one code tool, typed declarations in the tool's description, results unwrapped from MCP text, errors thrown into the code) and writes the small parts it needs.

## Consequences

- QuickJS interprets; a run is slower than V8 for heavy computation. The code is expected to be short glue between connector calls.
- A run is not resumable: if the host stops during a run, the run is lost and the thread sees its call fail. Cloudflare's replay after an approval is not needed, since a run simply waits for the owner's answer.
- The executor is replaceable behind `runCode` in `packages/service/src/connectors/codeExecutor.ts`.

## Note · 2026-11-18 · Code Mode widened beyond connectors; this decision is unchanged

At the owner's instruction Code Mode now covers every tool of Outlore's tool server, Outlore's own thread tools as well as the connectors' ([CHG-0446](../changelog/0.1.8-Prototype.md), [CHG-0447](../changelog/0.1.8-Prototype.md), [connectors specification](../capabilities/connectors/specifications.md#code-mode)). This decision stands as written: nothing in the executor is about connectors, since the host hands it named functions and it reaches nothing else. The runner now installs any nested set of host functions as globals (`connectors.<connector>.<tool>` and `outlore.<tool>`), where it installed one `connectors` global. "Local" extends to what Outlore's own tools return (lore, journals), which also stays on the host. No hard-to-reverse choice appears, so there is no new ADR; the title and first paragraph above, which say "for connectors", keep the words they were decided with.
