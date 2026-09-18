# Tauri security audit decisions

Reviewed 2026-09-18 against `main` at `71c0412`, cargo-audit 0.22.1, and
RustSec database commit `0765f6f611cb93c5ab2681b9c97fb06e5df9e1d1`
(updated 2026-09-18 06:41:06 UTC; 1,247 advisories).

The baseline audit exited 1 with two vulnerabilities and seven informational
warnings. The two patched dependencies were updated within their existing
semver ranges. Seven transitive risks are explicitly accepted in
[`src-tauri/.cargo/audit.toml`](../src-tauri/.cargo/audit.toml), which is loaded
by the CI job's `cargo audit` command in `src-tauri`. The configuration denies
all other warnings as well as vulnerabilities; it does not filter by platform
or severity. Ignoring an advisory accepts the risk; it does not fix the crate.

## Advisory matrix

Each advisory link was read alongside the local audit report. Versions and
dependency paths below come from `src-tauri/Cargo.lock` and the Cargo registry.

| Advisory | Action | Evidence and removal criterion |
| --- | --- | --- |
| [RUSTSEC-2026-0285](https://rustsec.org/advisories/RUSTSEC-2026-0285.html) | Bumped `rustls` 0.23.43 -> **0.23.45** using `cargo update -p rustls --precise 0.23.45`. | TLS 1.3 handshake messages could cross encryption boundaries. RustSec patches `>=0.23.45`; the lockfile now selects 0.23.45. No ignore. |
| [RUSTSEC-2026-0258](https://rustsec.org/advisories/RUSTSEC-2026-0258.html) | Bumped `h2` 0.4.15 -> **0.4.16** using `cargo update -p h2 --precise 0.4.16`. | Empty DATA frames could cause unbounded memory usage or panic. RustSec patches `>=0.4.16`; the lockfile now selects 0.4.16. No ignore. |
| [RUSTSEC-2025-0100](https://rustsec.org/advisories/RUSTSEC-2025-0100.html) | Ignored: `unic-ucd-ident` 0.9.0 is unmaintained; no patched release. | `tauri-utils 2.9.3 -> urlpattern 0.3.0 -> unic-ucd-ident 0.9.0`. Remove when upstream replaces the UNIC dependency. |
| [RUSTSEC-2025-0098](https://rustsec.org/advisories/RUSTSEC-2025-0098.html) | Ignored: `unic-ucd-version` 0.9.0 is unmaintained; no patched release. | `unic-ucd-ident 0.9.0 -> unic-ucd-version 0.9.0`. Remove when it leaves the resolved graph. |
| [RUSTSEC-2025-0081](https://rustsec.org/advisories/RUSTSEC-2025-0081.html) | Ignored: `unic-char-property` 0.9.0 is unmaintained; no patched release. | `unic-ucd-ident 0.9.0 -> unic-char-property 0.9.0`. Remove when it leaves the resolved graph. |
| [RUSTSEC-2025-0080](https://rustsec.org/advisories/RUSTSEC-2025-0080.html) | Ignored: `unic-common` 0.9.0 is unmaintained; no patched release. | `unic-ucd-ident 0.9.0 -> unic-ucd-version 0.9.0 -> unic-common 0.9.0`. Remove when it leaves the resolved graph. |
| [RUSTSEC-2025-0075](https://rustsec.org/advisories/RUSTSEC-2025-0075.html) | Ignored: `unic-char-range` 0.9.0 is unmaintained; no patched release. | Both `unic-ucd-ident 0.9.0` and `unic-char-property 0.9.0` depend on it. Remove when it leaves the resolved graph. |
| [RUSTSEC-2024-0429](https://rustsec.org/advisories/RUSTSEC-2024-0429.html) | Ignored: `glib` 0.18.5 needs a breaking upstream GTK/WebKit stack migration; no compatible patched release. | `tauri 2.11.5` requires `gtk ^0.18`; `gtk 0.18.2` requires `glib ^0.18`. RustSec patches `>=0.20.0` for undefined behavior/null-pointer crashes in `VariantStrIter`. Adding glib 0.20 directly would not replace the affected transitive copy. Remove after the entire stack uses a patched release. No Tauri/plugin major upgrade was attempted. |
| [RUSTSEC-2024-0370](https://rustsec.org/advisories/RUSTSEC-2024-0370.html) | Ignored: `proc-macro-error` 1.0.4 is unmaintained; no patched release. | `gtk 0.18.2 -> gtk3-macros 0.18.2 -> proc-macro-error 1.0.4`, also through `glib-macros 0.18.5`. Remove after upstream macro crates replace it. |

Cargo also re-resolved five existing Windows-only `windows-sys` dependency
edges: `dirs-sys` now uses 0.59.0, while `errno`, `rustix`, `tempfile`, and
`winapi-util` use 0.52.0. These versions were already in the lockfile and satisfy
the respective registry requirements (`>=0.59.0`, `>=0.52, <0.62`, and
`>=0.48.0, <=0.61`). No additional package version was added or changed.

## Verification

Audit, formatting, and Clippy run from `src-tauri`; the test and frontend
commands run from the repository root. Local validation uses Rust 1.96.1,
`RUSTFLAGS=-Dwarnings`, and a repository-local Cargo cache. No tool or system
package installation is required. Audit evidence is retained locally in the
ignored `Work/session-state/security-audit/` directory.

- Baseline: `cargo audit --json` exited 1 with exactly the nine findings above.
- Updated policy and lockfile: `cargo audit --no-fetch --json` exited 0 with
  zero vulnerabilities and zero unaccepted warnings; all seven ignores were
  present in the JSON settings. This uses the freshly fetched database above.
- The exact CI audit command, `cargo audit`, also passed (exit 0), fetching
  RustSec and checking all 472 locked dependencies.
- Negative control: auditing the original lockfile with the new configuration
  exited 1 and still reported both `RUSTSEC-2026-0258` and `RUSTSEC-2026-0285`.
- Negative control: a separate local copy of the configuration with only the
  `RUSTSEC-2024-0370` exception removed exited 1 on that unmaintained warning.
  The repository policy file was not altered for this check.
- `cargo fmt --all --check`: passed (exit 0).
- `cargo clippy --locked --all-targets --all-features -- -D warnings`: passed
  (exit 0), using the exact CI command and its `RUSTFLAGS=-Dwarnings` setting.
- `cargo test --locked --manifest-path src-tauri/Cargo.toml`: passed (exit 0);
  2 library tests passed, 0 failed/ignored; binary and doc-test targets each
  contained 0 tests.
- `npm run build`: passed (exit 0); TypeScript and Vite built 1,895 modules.
- `git diff --check`: passed (exit 0).

## Outstanding

The seven accepted risks remain until their upstream dependencies are replaced
or patched. Recheck these exceptions on Tauri, GTK/WebKit, and URLPattern
dependency updates. The hosted CI run can only be verified after the chair
publishes the changes; this task does not commit or push.
