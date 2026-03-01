# Active Context - Egregore Web GUI

**Version**: 1
**Updated**: 2026-03-01T12:05:00Z

## Current Status

Egregore Web is a functional Tauri desktop app for viewing and configuring a local egregore node. Core features implemented and working.

## Last Session Summary (2026-03-01)

### Goal

Continue development of egregore-web GUI, focusing on attachment support and peers panel improvements.

### Accomplishments

1. **Attachment Support (Fixed)**
   - Initial implementation failed with HTTP 500 errors
   - Root cause: `FileReader.readAsDataURL()` produces base64 that egregore rejected
   - Fix: Switched to `FileReader.readAsArrayBuffer()` + manual `btoa()` encoding
   - Now working with 256KB limit
   - Images render inline, other files show download links

2. **Peers Panel Improvements**
   - Added "Configured" badge (blue) for manually added peers
   - IP addresses now highlighted with background styling
   - Connected peers show pulsing green indicator
   - Fixed identity display to show "You" correctly

3. **API Type Fixes**
   - Fixed `Peer.public_key` → `Peer.public_id` (matching actual API)
   - Fixed `Status.identity` from object to string (matching actual API)
   - Fixed `Status.uptime_seconds` → `Status.uptime_secs`
   - Local identity now correctly identified and displayed

### Key Learnings

**Validated Patterns**:

- Testing with hardcoded payloads isolates encoding issues from API issues
- MCP tools provide quick API verification independent of app

**Pitfalls Encountered**:

- `FileReader.readAsDataURL()` produces subtly different base64 than `btoa()`
- API response shapes don't always match initial type assumptions - verify with curl
- Hot reload doesn't always pick up changes - full restart sometimes needed

**Assumptions Challenged**:

- Assumed `identity` was an object with `public_key` - it's a direct string
- Assumed `public_key` field name - API uses `public_id` for peers

## Next Steps

1. Test attachment rendering in received messages
2. Consider larger attachment size limits if egregore supports it
3. Add message threading visualization
4. Add SSE real-time updates from `/v1/events`
5. Implement config file editing panel

## Project Architecture

- **Shell**: Tauri 2.x (Rust backend + webview)
- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **State**: TanStack Query + Zustand (with localStorage persistence)
- **API**: Proxied through Tauri commands to avoid CORS
