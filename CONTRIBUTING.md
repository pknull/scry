# Contributing to Scry

Thanks for your interest. Scry is the desktop admin dashboard for [Thallus](../) — a Tauri 2.x app (React + TypeScript frontend, Rust backend) for viewing and managing an egregore node.

## Before You Start

- Scry is **read-oriented** by design. It observes and configures; it does not act autonomously. Changes that add autonomous behaviour need discussion.
- For large UI changes, open an issue first with a mockup or wireframe.

## Development Setup

```bash
git clone <repo>
cd scry
pnpm install
pnpm tauri dev
```

Requires Node 20+, Rust stable, and Tauri system dependencies. See the [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your OS.

## Pre-Submit Checklist

### Frontend

```bash
pnpm lint
pnpm build
pnpm test:run
```

### Tauri Backend

```bash
cd src-tauri
cargo fmt --all --check
cargo clippy --all-targets --all-features -- -D warnings
```

CI also runs `cargo audit` on the Tauri backend.

## Areas That Need Care

### Systemd Control
`src-tauri/src/commands/systemd.rs` exposes systemd control commands (start/stop/restart/install/uninstall). These are privileged operations. Don't add new privileged operations without discussion.

### HTTP Proxy
The Tauri backend proxies HTTP to the local egregore node to bypass CORS. Don't let this proxy reach arbitrary URLs — it should only target the configured local node.

### Config Writing
The app edits the egregore config file directly. Any write path must back up the existing file before overwriting.

## Code Style

### TypeScript/React
- React 19 function components
- TanStack Query for server state
- Zustand for UI state
- Tailwind CSS for styling (no separate CSS files for components)
- Prefer composition over inheritance
- Small components, co-locate related ones

### Rust (Tauri)
- Rust 2021 edition
- `cargo fmt`, `cargo clippy`
- Keep commands in the matching thematic module under `src-tauri/src/commands/` (`binary.rs`, `config.rs`, `http.rs`, or `systemd.rs`) and re-export them from `commands/mod.rs`

## Adding a New View

1. Create the component under the matching area in `src/components/`
2. Add a route / nav entry if it needs top-level navigation
3. Use TanStack Query for any server data
4. Add a test for interactive logic

## Adding a New Tauri Command

1. Add the command function to the matching module under `src-tauri/src/commands/`
2. Re-export it from `src-tauri/src/commands/mod.rs` and register it in the invoke handler in `src-tauri/src/lib.rs`
3. Add TypeScript bindings in `src/api/`
4. Document the command in the function's doc comment

## Pull Request Process

1. Fork and branch from `main`
2. Make your change; add tests where practical
3. Run both frontend and backend checklists
4. Open a PR with a screenshot or short video for UI changes

## License

By contributing, you agree that your contributions will be licensed under [MIT OR Apache-2.0](../LICENSE-MIT).
