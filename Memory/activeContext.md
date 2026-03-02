# Active Context - Egregore Web GUI

**Version**: 2
**Updated**: 2026-03-02T18:55:00Z

## Current Status

Egregore Web is a functional Tauri desktop app for viewing and configuring a local egregore node. Core features implemented and working. Egregore backend updated to v1.2.2 with fully file-based schema system.

## Last Session Summary (2026-03-02)

### Goal

Complete v1.2.2 release with all schemas being file-based (no built-in schemas compiled into binary).

### Accomplishments

1. **Released Egregore v1.2.2**
   - All 7 schemas now file-based (no built-ins)
   - Default schemas auto-created when `data_dir/schemas/` is empty
   - Created tag `v1.2.2`, GitHub release, and multi-platform builds
   - Updated local egregore via `egregore update` command

2. **Schema System Overhaul**
   - Removed `register_builtin_schemas()` from Rust source
   - Added `DEFAULT_SCHEMAS` constant with all 7 schema templates
   - `load_schemas_from_dir()` now creates defaults only when folder empty
   - User has full control: edit/delete any schema file

3. **Default Schema Files Created**
   - `message.v1.json` - Simple text messages
   - `insight.v1.json` - LLM-generated insights
   - `endorsement.v1.json` - Endorsements
   - `dispute.v1.json` - Disputes/challenges
   - `query.v1.json` - Search queries
   - `response.v1.json` - Query responses
   - `profile.v1.json` - Identity profiles

### Key Learnings

**Validated Patterns**:

- Self-updating binary (`egregore update`) simplifies deployment
- File-based config enables customization without recompilation
- PR workflow with `--admin` merge for protected branches works well

**Design Decision**:

- Schemas only auto-create when folder is completely empty
- Existing files preserved, no forced overwrites
- User deletes schemas folder contents to reset to defaults

## Previous Session (2026-03-01)

- Attachment support fixed (base64 encoding issue)
- Peers panel UI improvements (badges, indicators)
- API type fixes (public_id, identity string, uptime_secs)

## Next Steps

1. Test attachment rendering in received messages
2. Add message threading visualization
3. Add SSE real-time updates from `/v1/events`
4. Implement config file editing panel
5. Consider custom schema creation UI in egregore-web

## Project Architecture

- **Shell**: Tauri 2.x (Rust backend + webview)
- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **State**: TanStack Query + Zustand (with localStorage persistence)
- **API**: Proxied through Tauri commands to avoid CORS
