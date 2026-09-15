# Decisions

- Scry observes; its only writes are explicit operator-triggered
  control-plane actions (peer management, schema and retention changes,
  local service management). It never acts autonomously.
- Component ownership stays put: Familiar owns conversation and planning,
  Servitor owns execution and authority; Scry surfaces both without moving
  them into the desktop app.
- Consumer groups stay deleted; no panel returns without a new RFC.
- Single main branch; CI (npm run build) green before pushing.
- This repo carries its own Memory v2 pair; cross-component decisions live
  in the Thallus umbrella. Machine-local state stays under ignored Work/.
