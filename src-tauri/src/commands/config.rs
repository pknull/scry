//! Egregore config-file I/O commands.
//!
//! Discovers `config.yaml` in conventional locations (custom data dir, XDG
//! config, dotfile) and exposes read/write/path-introspection commands to the
//! Tauri frontend.

use std::fs;
use std::path::PathBuf;

fn get_config_path() -> PathBuf {
    // Check common locations for egregore config
    let paths = [
        // Custom data directory (most common)
        dirs::home_dir().map(|h| h.join("egregore-data").join("config.yaml")),
        // XDG config
        dirs::config_dir().map(|c| c.join("egregore").join("config.yaml")),
        // Home directory
        dirs::home_dir().map(|h| h.join(".egregore").join("config.yaml")),
    ];

    for path in paths.into_iter().flatten() {
        if path.exists() {
            return path;
        }
    }

    // Default to home directory
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("egregore-data")
        .join("config.yaml")
}

#[tauri::command]
pub fn read_config() -> Result<String, String> {
    let path = get_config_path();
    fs::read_to_string(&path).map_err(|e| format!("Failed to read config at {:?}: {}", path, e))
}

#[tauri::command]
pub fn write_config(content: String) -> Result<(), String> {
    let path = get_config_path();

    // Create parent directory if needed
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    // Backup existing config
    if path.exists() {
        let backup = path.with_extension("yaml.bak");
        let _ = fs::copy(&path, backup);
    }

    fs::write(&path, content).map_err(|e| format!("Failed to write config: {}", e))
}

#[tauri::command]
pub fn get_config_path_str() -> String {
    get_config_path().to_string_lossy().to_string()
}
