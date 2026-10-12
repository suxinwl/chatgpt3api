# 0001: Discover current ChatGPT models

Status: pending-verification

- Owner: ModelCatalogService / AccountService
- Created: 2026-10-13
- Related ADRs: 0001, 0004

## Problem and user outcome

The chat catalog is fixed to `gpt-5.6` and `auto`. Users need new ChatGPT
models available to their Web accounts to appear in Studio and `/v1/models`.
Image 2.5 compatibility names must accurately describe their Web routing.

## Scope and ownership

- AccountService owns normalized account metadata and account selection.
- OpenAIBackendAPI discovers Web model identifiers during existing account sync.
- ModelCatalogService owns configured precedence, model projection and notes.
- Studio owns loading, selection and rendering of that projection.
- Official API adapters, database ownership changes and forced selection of
  official API image engines are outside this requirement.

## Interfaces and failure behavior

Account metadata gains `available_models` in the existing Account Repository.
Discovery has a ten-second request budget. Failure preserves the last snapshot
and does not fail quota synchronization. Catalog reads stay local. Explicit
configuration wins; account defaults and the existing static catalog provide
fallbacks. Text requests preserve the returned model identifiers and prefer
matching accounts. Model notes are an additive catalog capability.

## Acceptance and verification

- [x] Mock-synchronized new Web identifiers appear in Studio and `/v1/models`.
- [x] Config precedence, unavailable accounts and discovery failures are covered.
- [x] Text routing preserves identifiers and prefers matching accounts.
- [x] Image generation/edit compatibility wire routes remain valid under mocks.
- [x] Studio displays backend-provided notes at desktop and mobile widths.
- [ ] Live account entitlement, actual generation and user acceptance verified.

Thirty targeted backend checks passed against isolated account databases and
mocked upstream responses. Frontend production build and browser checks at
1366x900 and 390x844 passed, including model selection and the request model.
Existing history runtime checks and eight-route browser smoke also passed.
Live account entitlement and generation require real upstream credentials;
no such verification or user acceptance is recorded yet.

## Documentation, persistence and rollback

Update backend map, README and CHANGELOG. Account metadata uses the existing
repository transaction and full export; there is no schema migration or new
cache owner. Existing snapshot conflict protections remain authoritative.
No new ADR is required because no ownership changes. Rollback restores the
previous catalog implementation; the additional account field is inert.
