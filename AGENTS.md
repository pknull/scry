# Scry

Tauri desktop admin dashboard for the Egregore network. (Renamed from egregore-web.)

## Architecture

```
┌─────────────────────────────────────────┐
│           Tauri 2.x Shell               │
│  ┌─────────────────────────────────┐    │
│  │      Rust Backend (reqwest)     │    │
│  │  - HTTP proxy (CORS bypass)     │    │
│  │  - Config file I/O              │    │
│  │  - Systemd service control      │    │
│  └─────────────────────────────────┘    │
│                  ↓ invoke               │
│  ┌─────────────────────────────────┐    │
│  │    React 19 + TypeScript        │    │
│  │  - TanStack Query (server)      │    │
│  │  - Zustand (UI state)           │    │
│  │  - Tailwind CSS                 │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
                  ↓
        Egregore Daemon (127.0.0.1:7654)
```

## Build & Run

```bash
npm install          # Install dependencies
npm run tauri dev    # Development (hot reload)
npm run tauri build  # Production build
```

## Project Structure

```
egregore-web/
├── src/                    # React frontend
│   ├── api/                # API client modules
│   │   ├── client.ts       # HTTP wrapper (invokes Tauri)
│   │   ├── feed.ts         # Feed/message operations
│   │   ├── peers.ts        # Peer management
│   │   ├── status.ts       # Node status/identity
│   │   ├── schema.ts       # Schema registry
│   │   ├── groups.ts       # Consumer groups
│   │   ├── retention.ts    # Retention policies
│   │   ├── topics.ts       # Topic subscriptions
│   │   ├── tasks.ts        # Task management
│   │   ├── traces.ts       # Trace operations
│   │   └── types.ts        # Shared TypeScript types
│   ├── components/
│   │   ├── feed/           # ChatFeed, MessageCard, MessageComposer
│   │   ├── layout/         # Sidebar, Header
│   │   ├── settings/       # UnifiedPeersPanel, SchemaPanel, etc.
│   │   ├── tasks/          # Task view components
│   │   ├── traces/         # Trace view components
│   │   └── ui/             # Button, Card, Input, Toggle
│   ├── hooks/              # React Query hooks
│   ├── stores/             # Zustand stores
│   │   └── appStore.ts     # View state, ignored authors
│   ├── App.tsx             # Main app with router
│   └── main.tsx            # Entry point
├── src-tauri/              # Rust backend
│   └── src/
│       ├── lib.rs          # Tauri command registration
│       └── commands.rs     # HTTP proxy, config, systemd
└── tauri.conf.json         # Tauri configuration
```

## Tauri Commands (Rust Backend)

| Command | Purpose |
|---------|---------|
| `api_get(endpoint)` | GET request to egregore daemon |
| `api_post(endpoint, body)` | POST request |
| `api_delete(endpoint)` | DELETE request |
| `read_config()` | Read YAML config file |
| `write_config(content)` | Write config with backup |
| `get_config_path_str()` | Get config file path |
| `systemd_status()` | Get service status |
| `systemd_is_active()` | Check if service is active |
| `systemd_is_enabled()` | Check if service is enabled |
| `systemd_is_installed()` | Check if service file exists |
| `systemd_start()` | Start service |
| `systemd_stop()` | Stop service |
| `systemd_restart()` | Restart service |
| `systemd_enable()` | Enable auto-start |
| `systemd_disable()` | Disable auto-start |
| `systemd_install(path, data_dir)` | Create systemd service |
| `systemd_uninstall()` | Remove systemd service |
| `find_egregore_binary()` | Locate egregore binary |

## State Management

**TanStack Query** (server state):

- Auto-polling: feed (5s), mesh (5s), peers (10s), authors (30s)
- Query invalidation after mutations
- 60s stale time, 1 retry

**Zustand** (UI state):

- `currentView`: Active panel (feed/tasks/traces/peers/schemas/groups/retention/topics/settings)
- `searchQuery`: Feed search text
- `selectedTaskId`: Currently selected task (for detail view)
- `selectedTraceId`: Currently selected trace (for detail view)
- `ignoredAuthors`: Authors filtered from feed (persisted to localStorage)

## UI Features

| View | Features |
|------|----------|
| **Feed** | Threaded messages, full-text search, publish (form/JSON), reply |
| **Tasks** | Task list, detail view, status tracking |
| **Traces** | Trace list, detail view, execution history |
| **Peers** | Add/remove peers, mesh health, direct/transitive/replicated classification |
| **Schemas** | List/register schemas, validate messages, toggle strict mode |
| **Groups** | Consumer group CRUD, join/leave, offset management |
| **Retention** | Policy CRUD (scope/age/count/bytes) |
| **Topics** | Subscribe/unsubscribe, known topics |
| **Settings** | Config editing, systemd control |

## CORS Bypass

Browser same-origin policy blocks direct requests to localhost:7654. Solution:

```
React → invoke('api_get') → Rust (reqwest) → Egregore Daemon
```

All API calls route through Tauri commands.

## Key Files

- `src/App.tsx` — View router, layout
- `src/components/feed/ChatFeed.tsx` — Main feed with threading
- `src/components/feed/MessageComposer.tsx` — Publish form/JSON
- `src/components/settings/UnifiedPeersPanel.tsx` — Merged peer view
- `src-tauri/src/commands.rs` — All Tauri commands
- `tauri.conf.json` — Window config, CSP, build settings

## Dependencies

| Package | Purpose |
|---------|---------|
| `@tanstack/react-query` | Server state, caching |
| `zustand` | UI state management |
| `@tauri-apps/api` | IPC with Rust backend |
| `tailwindcss` | Styling |
| `vite` | Build tooling |
