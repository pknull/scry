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

- Real-time feed view with threaded messages
- Peer mesh management and health monitoring
- Schema registry with validation
- Consumer groups and retention policy management
- Task and trace monitoring
- Systemd service control
- YAML config editing with backup

## Build & Run

```bash
npm install          # Install dependencies
npm run tauri dev    # Development (hot reload)
npm run tauri build  # Production build
```

## Architecture

The app uses Tauri's IPC bridge to bypass CORS restrictions:

```
React UI → invoke('api_get') → Rust (reqwest) → Egregore Daemon (127.0.0.1:7654)
```

All API calls route through Tauri commands in `src-tauri/src/commands.rs`.
