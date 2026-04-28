//! Systemd user-service management commands for the egregore daemon.
//!
//! Wraps `systemctl --user` invocations and the unit-file install/uninstall
//! cycle. The frontend uses these to start/stop/install the egregore service
//! from the Settings panel.

use std::fs;
use std::path::PathBuf;
use std::process::Command;

const SERVICE_NAME: &str = "egregore";

fn get_systemd_user_dir() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from(".config"))
        .join("systemd")
        .join("user")
}

fn get_service_file_path() -> PathBuf {
    get_systemd_user_dir().join(format!("{}.service", SERVICE_NAME))
}

#[tauri::command]
pub fn systemd_status() -> Result<String, String> {
    let output = Command::new("systemctl")
        .args(["--user", "status", SERVICE_NAME])
        .output()
        .map_err(|e| format!("Failed to run systemctl: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    if stdout.is_empty() && !stderr.is_empty() {
        return Err(stderr.to_string());
    }

    Ok(stdout.to_string())
}

#[tauri::command]
pub fn systemd_is_active() -> Result<bool, String> {
    let output = Command::new("systemctl")
        .args(["--user", "is-active", SERVICE_NAME])
        .output()
        .map_err(|e| format!("Failed to run systemctl: {}", e))?;

    let status = String::from_utf8_lossy(&output.stdout).trim().to_string();
    Ok(status == "active")
}

#[tauri::command]
pub fn systemd_is_enabled() -> Result<bool, String> {
    let output = Command::new("systemctl")
        .args(["--user", "is-enabled", SERVICE_NAME])
        .output()
        .map_err(|e| format!("Failed to run systemctl: {}", e))?;

    let status = String::from_utf8_lossy(&output.stdout).trim().to_string();
    Ok(status == "enabled")
}

#[tauri::command]
pub fn systemd_is_installed() -> bool {
    get_service_file_path().exists()
}

#[tauri::command]
pub fn systemd_start() -> Result<String, String> {
    let output = Command::new("systemctl")
        .args(["--user", "start", SERVICE_NAME])
        .output()
        .map_err(|e| format!("Failed to start service: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok("Service started".to_string())
}

#[tauri::command]
pub fn systemd_stop() -> Result<String, String> {
    let output = Command::new("systemctl")
        .args(["--user", "stop", SERVICE_NAME])
        .output()
        .map_err(|e| format!("Failed to stop service: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok("Service stopped".to_string())
}

#[tauri::command]
pub fn systemd_restart() -> Result<String, String> {
    let output = Command::new("systemctl")
        .args(["--user", "restart", SERVICE_NAME])
        .output()
        .map_err(|e| format!("Failed to restart service: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok("Service restarted".to_string())
}

#[tauri::command]
pub fn systemd_enable() -> Result<String, String> {
    let output = Command::new("systemctl")
        .args(["--user", "enable", SERVICE_NAME])
        .output()
        .map_err(|e| format!("Failed to enable service: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok("Service enabled".to_string())
}

#[tauri::command]
pub fn systemd_disable() -> Result<String, String> {
    let output = Command::new("systemctl")
        .args(["--user", "disable", SERVICE_NAME])
        .output()
        .map_err(|e| format!("Failed to disable service: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok("Service disabled".to_string())
}

#[tauri::command]
pub fn systemd_install(egregore_path: String, data_dir: String) -> Result<String, String> {
    let service_dir = get_systemd_user_dir();
    fs::create_dir_all(&service_dir)
        .map_err(|e| format!("Failed to create systemd directory: {}", e))?;

    let service_content = format!(
        r#"[Unit]
Description=Egregore Node - Decentralized Knowledge Network
After=network.target

[Service]
Type=simple
ExecStart={egregore_path} --data-dir {data_dir}
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
"#
    );

    let service_path = get_service_file_path();
    fs::write(&service_path, service_content)
        .map_err(|e| format!("Failed to write service file: {}", e))?;

    // Reload systemd
    let output = Command::new("systemctl")
        .args(["--user", "daemon-reload"])
        .output()
        .map_err(|e| format!("Failed to reload systemd: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(format!("Service installed at {:?}", service_path))
}

#[tauri::command]
pub fn systemd_uninstall() -> Result<String, String> {
    // Stop and disable first
    let _ = Command::new("systemctl")
        .args(["--user", "stop", SERVICE_NAME])
        .output();
    let _ = Command::new("systemctl")
        .args(["--user", "disable", SERVICE_NAME])
        .output();

    let service_path = get_service_file_path();
    if service_path.exists() {
        fs::remove_file(&service_path)
            .map_err(|e| format!("Failed to remove service file: {}", e))?;
    }

    // Reload systemd
    let _ = Command::new("systemctl")
        .args(["--user", "daemon-reload"])
        .output();

    Ok("Service uninstalled".to_string())
}
