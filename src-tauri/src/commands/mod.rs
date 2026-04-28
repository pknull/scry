//! Tauri command bindings invoked by the React frontend.
//!
//! Split into thematic submodules:
//! - `config`  : egregore config-file I/O (read / write / locate)
//! - `http`    : CORS-bypassing HTTP proxy to the local egregore daemon
//! - `systemd` : Linux user-service install / start / stop / status
//! - `binary`  : `which egregore` and conventional-path discovery
//!
//! Each submodule's `pub` fns are re-exported here so `lib.rs`'s
//! `invoke_handler!(generate_handler![...])` array can reference them at the
//! flat path it has historically used.

mod binary;
mod config;
mod http;
mod systemd;

pub use binary::find_egregore_binary;
pub use config::{get_config_path_str, read_config, write_config};
pub use http::{api_delete, api_get, api_post};
pub use systemd::{
    systemd_disable, systemd_enable, systemd_install, systemd_is_active, systemd_is_enabled,
    systemd_is_installed, systemd_restart, systemd_start, systemd_status, systemd_stop,
    systemd_uninstall,
};
