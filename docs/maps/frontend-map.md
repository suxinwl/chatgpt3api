# Frontend Map

Status: current

The Vue application owns transport validation, interaction state, layout, and
rendering. Business meaning arrives through backend projections.

## Route ownership

The route source is
[`../../web-vue/src/router/routes.ts`](../../web-vue/src/router/routes.ts).

| Route | Page owner | Principal page-private runtime/adapters |
| --- | --- | --- |
| `/login` | `Login.vue` | Auth adapter and redirect validation |
| `/` | `Dashboard.vue` | `dashboard/useDashboardPage.ts`, `statsApi` |
| `/accounts` | `Accounts.vue` | `accounts/useAccountsPage.ts`, account CRUD, selection, import, bulk-operation, and test runtimes |
| `/settings` | `Settings.vue` | Settings configuration, integrations, Prompt Sources, User Keys, backup, and external-source runtimes |
| `/proxy` | `Proxy.vue` | Default-proxy, group, and node-import runtimes; `proxyApi` |
| `/logs` | `Logs.vue` | Query, selection, export, and detail runtimes; `logsApi` |
| `/monitor` | `Monitor.vue` | Realtime list and detail runtimes; `monitorApi` |
| `/gallery` | `Gallery.vue` | Query, interaction, and operation runtimes; `galleryApi` |
| `/studio` | `Studio.vue` | Send, chat stream, image/file task, polling, conversation, prompt, model, layout, and scroll runtimes |
| `/debug` | Redirect only | Redirects to `/studio`; it is not a separate page |

`AppShell.vue` owns authenticated product navigation and header-level overlays.
Each page owns its responsive composition and has one explicit scroll owner per
scrolling region.

## Data path

```mermaid
flowchart LR
    Contract["Backend JSON contract"] --> Adapter["web-vue/src/api adapter"]
    Adapter --> Runtime["Page or page-private runtime"]
    Runtime --> View["Vue page/components"]
    Nanocat["nanocat-ui primitives"] --> View
```

- `web-vue/src/api/` owns HTTP transport, request types, response validation,
  and protocol normalization.
- Page-private runtimes own drafts, selection, polling, retained snapshots,
  loading/error state, overlay state, and orchestration for one page.
- Vue components render final backend semantics and page state. They may format
  pure visual values, but cannot infer backend status, capability, or next
  action from raw error strings or parallel flags.

## UI ownership boundary

| Belongs to `nanocat-ui` | Belongs to this repository |
| --- | --- |
| Tokens, controls, menus, generic overlays, focus behavior, theme state, and reusable dock/modal primitives | AppShell, routes, product copy, tables, charts, domain timelines, page workflows, and product-specific responsive layout |

A visual Module moves to Nanocat only after more than one real consumer or a
concrete cross-project use case exists. Page-specific code stays next to the
page while it has one owner. The Nanocat source is an independent repository
and is tested, committed, and released separately.

## Lifecycle rules

- Initial load, background refresh with a retained snapshot, true empty state,
  and error state are distinct.
- Entering a page may fetch immediately; refresh timers have one owner and are
  disposed with that owner.
- Closing an overlay returns focus according to the shared overlay contract and
  clears trigger states; pages do not add a competing focus lifecycle.
- A container that owns scrolling must have a bounded size in fixed-layout mode.
  In natural-height mode, document scrolling is the owner and nested regions do
  not claim the same axis.
- Single-item and batch actions call the same bulk Interface with one ID when
  their business semantics are identical.

## Studio history and Gallery image recovery

`useModelCatalog.ts` transports and caches the shared backend catalog.
`studioModelFormRuntime.ts` owns model selection, including newly discovered
Web identifiers, and exposes the selected model's backend-provided
`capabilities.image_model_notes` to `StudioComposer.vue`. The composer renders
the note without deriving model routing or entitlements in the browser.

`studioConversationState.ts` owns serialization and browser storage for Studio
history. It saves the complete conversation and message arrays in IndexedDB
(`chatgpt2api-studio`, `conversations`, `history`), including reference images
and received Image Asset results. On the first load, existing
`studio-conversations` localStorage data is imported; the old entry is removed
only after the IndexedDB transaction commits. Browsers without IndexedDB use
localStorage with the same explicit save-failure handling.

`studioConversationPersistenceRuntime.ts` owns restoration, save scheduling,
and errors. Studio waits for restoration before enabling history mutations;
a failed read offers retry without overwriting the saved history. Saves flush
when the page is hidden or exits. An unfinished save guards browser navigation,
and a failed save retains the committed snapshot and offers retry.

`studioImageTaskRuntime.ts` copies received asset results into conversation
messages, including backfilling completed messages whose task records still
exist. `StudioMessageList.vue` uses live task results when available and the
saved asset results otherwise. Long-conversation task reads are split into
batches of at most 100 IDs. Task expiration alone does not remove a saved asset
reference; server-side Image Asset retention still controls the actual files.
An already-expired legacy task without saved results cannot be reconstructed
from its task ID alone.

`galleryInteractionRuntime.ts` owns thumbnail-load failure state. A failed
thumbnail switches the card to the original URL; the card becomes unavailable
only if the original also fails. Applying a refreshed list clears that state
so transient failures can be retried.

See [`../control-panel-data-contract.md`](../control-panel-data-contract.md) for
projection consumption rules and [`critical-flows.md`](critical-flows.md) for
cross-layer sequences.
