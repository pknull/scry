# Scry

> Part of the [Thallus](../README.md) decentralized AI agent infrastructure project.

Tauri desktop operator shell for a local Thallus deployment.

The current build concentrates upon Egregore administration and execution
observability. The target architecture expands the interface around those
working surfaces without moving component ownership into the desktop app:

- Familiar owns conversation and planning.
- Servitor owns structured execution and authority enforcement.
- Egregore owns signed publication, replication, and durable network state.
- Scry owns presentation and explicit operator intent. It provides
  domain-specific editors and read-only previews, not an IDE.

The active architecture and feature specifications live in the Thallus
umbrella documentation at `docs/scry/architecture.md` and
`docs/scry/features.md`.

## Stack

- **Shell**: Tauri 2.x (Rust backend + webview)
- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **State**: TanStack Query + Zustand

## Current Features

- **Feed**: Browse and search the real-time threaded message feed.
- **Tasks**: Observe task offers, status, and lifecycle activity.
- **Assignments**: Review pending identity-bound offers.
  An explicit operator **Assign** emits the typed `assign_task/v1` command under RFC 0003 behind a single-use confirmation; reconciliation is feed-authoritative, exposes an explicit `unknown` state, and Retry preserves `command_id`.
- **Traces**: Inspect execution history and trace waterfalls.
- **Peers**: Manage peers and monitor mesh health.
- **Schemas**: Register schemas, validate messages, and configure strict mode.
- **Retention**: Manage retention policies and cleanup settings.
- **Topics**: Manage topic subscriptions and known topics.
- **Bridge**: Monitor composite transport health and per-child bridge queues.
- **Settings**: Edit YAML configuration with backup and control the systemd user service.

## Build & Run

```bash
pnpm install       # Install dependencies
pnpm tauri dev     # Development (hot reload)
pnpm tauri build   # Production build
```

## Architecture

The app uses Tauri's IPC bridge to bypass CORS restrictions:

```
React UI → invoke('api_get') → Rust (reqwest) → Egregore Daemon (127.0.0.1:7654)
```

All API calls route through the Tauri commands in `src-tauri/src/commands/`.
