use std::fs;
use std::path::PathBuf;
use std::process::Command;

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

    // Default to the most likely location
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("egregore-data")
        .join("config.yaml")
}

#[tauri::command]
pub fn read_config() -> Result<String, String> {
    let path = get_config_path();
    fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read config at {:?}: {}", path, e))
}

#[tauri::command]
pub fn write_config(content: String) -> Result<(), String> {
    let path = get_config_path();

    // Create backup before writing
    if path.exists() {
        let backup_path = path.with_extension("yaml.bak");
        fs::copy(&path, &backup_path)
            .map_err(|e| format!("Failed to create backup: {}", e))?;
    }

    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    fs::write(&path, content)
        .map_err(|e| format!("Failed to write config: {}", e))
}

#[tauri::command]
pub fn get_config_path_str() -> String {
    get_config_path().to_string_lossy().to_string()
}

// HTTP proxy commands to bypass CORS
const BASE_URL: &str = "http://127.0.0.1:7654";

#[tauri::command]
pub async fn api_get(endpoint: String) -> Result<String, String> {
    let url = format!("{}{}", BASE_URL, endpoint);
    let client = reqwest::Client::new();

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    if !status.is_success() {
        return Err(format!("HTTP {}: {}", status.as_u16(), body));
    }

    Ok(body)
}

#[tauri::command]
pub async fn api_post(endpoint: String, body: String) -> Result<String, String> {
    let url = format!("{}{}", BASE_URL, endpoint);
    let client = reqwest::Client::new();

    let response = client
        .post(&url)
        .header("Content-Type", "application/json")
        .body(body)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    let status = response.status();
    let response_body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    if !status.is_success() {
        return Err(format!("HTTP {}: {}", status.as_u16(), response_body));
    }

    Ok(response_body)
}

#[tauri::command]
pub async fn api_delete(endpoint: String) -> Result<String, String> {
    let url = format!("{}{}", BASE_URL, endpoint);
    let client = reqwest::Client::new();

    let response = client
        .delete(&url)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    if !status.is_success() {
        return Err(format!("HTTP {}: {}", status.as_u16(), body));
    }

    Ok(body)
}

// Systemd management commands
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
