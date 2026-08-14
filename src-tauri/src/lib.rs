mod commands;

use commands::{
    api_delete, api_get, api_post, find_egregore_binary, get_config_path_str, read_config,
    systemd_disable, systemd_enable, systemd_install, systemd_is_active, systemd_is_enabled,
    systemd_is_installed, systemd_restart, systemd_start, systemd_status, systemd_stop,
    systemd_uninstall, write_config,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            read_config,
            write_config,
            get_config_path_str,
            api_get,
            api_post,
            api_delete,
            systemd_status,
            systemd_is_active,
            systemd_is_enabled,
            systemd_is_installed,
            systemd_start,
            systemd_stop,
            systemd_restart,
            systemd_enable,
            systemd_disable,
            systemd_install,
            systemd_uninstall,
            find_egregore_binary
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
