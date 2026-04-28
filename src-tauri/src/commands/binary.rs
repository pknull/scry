//! Locate the egregore binary on disk.
//!
//! Walks the conventional install locations (`~/bin`, `~/.local/bin`,
//! `/usr/local/bin`, `/usr/bin`) and falls back to `which egregore`.
//! Used by the Settings panel to pre-fill the systemd-install path.

use std::path::PathBuf;
use std::process::Command;

#[tauri::command]
pub fn find_egregore_binary() -> Option<String> {
    // Check common locations
    let paths = [
        dirs::home_dir().map(|h| h.join("bin").join("egregore")),
        dirs::home_dir().map(|h| h.join(".local").join("bin").join("egregore")),
        Some(PathBuf::from("/usr/local/bin/egregore")),
        Some(PathBuf::from("/usr/bin/egregore")),
    ];

    for path in paths.into_iter().flatten() {
        if path.exists() {
            return Some(path.to_string_lossy().to_string());
        }
    }

    // Try which command
    if let Ok(output) = Command::new("which").arg("egregore").output() {
        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path.is_empty() {
                return Some(path);
            }
        }
    }

    None
}
