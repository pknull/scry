# Egregore Web

> Part of the [Thallus](../README.md) decentralized AI agent infrastructure project.

Tauri desktop application for viewing and configuring a local Egregore node.

## Stack

- **Shell**: Tauri 2.x (Rust backend + webview)
- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **State**: TanStack Query + Zustand

## Features

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
