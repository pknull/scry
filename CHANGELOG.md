# Changelog

All notable changes to scry are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project's pre-1.0 versioning treats minor bumps as the breaking-change signal.

## [0.2.0] - 2026-04-27

### ⚠ Breaking

- **Publish form removed.** `src/components/feed/MessageComposer.tsx` (form mode + JSON mode + attachments + schema selector) is deleted, and the inline publish surface inside `ChatFeed` is gone. Publishing arbitrary feed messages is not part of an operator console; that surface lives in Familiar / the network's normal task lifecycle. Aligns with the umbrella's `docs/architecture/contracts.md` (Scry: observability + explicit operator-triggered control-plane writes).
- **Manual task-assignment button removed.** `src/components/tasks/AssignButton.tsx` is deleted, and the `assigner` prop is no longer threaded through `TaskDetail` / `TaskOffers`. The Tasks panel is an offer-and-lifecycle observer; assignments happen via the network's natural offer/assign flow, not by operator click.
- **API surface trimmed.** `src/api/feed.ts` no longer exports `publishMessage()`; `src/api/tasks.ts` no longer exports `publishTaskAssign()`. Internal TypeScript callers must remove these imports.

### Added

- `CONTRIBUTING.md`, dual `LICENSE-APACHE` / `LICENSE-MIT`, and `.github/workflows/ci.yml` (lint + typecheck + test + build for the React frontend; cargo fmt + clippy + test for the Tauri backend).

### Changed

- Header label: "Task Assignment" → "Task Activity".
- `AGENTS.md` directory + view tables updated. Feed view documented as "browsing, full-text search, trace pivots". Tasks view documented as "list, detail, status, offer observation".
- Three version locations brought into sync at `0.2.0`: `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json` (`package.json` was lagging at `0.0.0` while the Tauri side had drifted to `0.1.0`).

### Build

- `coverage/` is now gitignored — vitest output no longer appears in `git status`.

## [earlier] - prior

Earlier history is preserved in `git log`. Highlights: bridge-panel rendering of CompositeTransport health and queues; comprehensive business-logic test suite; task and trace view hardening.
