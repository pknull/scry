# Objective

Scry is the eyes of Thallus: a Tauri 2.x desktop operator console (React,
TypeScript, Vite) for the local Egregore node. It observes feeds, peers,
schemas, retention, tasks and traces, and performs only explicit
operator-triggered control-plane writes. It never acts autonomously and owns
no conversation, planning or execution.

# State

Verified 2026-09-15. Version 0.2.0; main at e11248f (single main branch CI
trigger, 2026-08-15); CI green on main. The Gate 4 Scry assignment slice is
complete; the dead Consumer Groups panel was removed in the 2026-08-14
documentation audit (consumer groups are deleted network-wide). The Rust
backend talks to the node over reqwest. This repo now carries its own Memory
v2 pair; cross-component decisions stay in the Thallus umbrella (private
repo pknull/Thallus).

# Next

- None scheduled; expansion follows the umbrella's Gate 5 evidence rule.

# Blockers

- None.
