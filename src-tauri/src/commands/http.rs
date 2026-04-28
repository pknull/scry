//! HTTP proxy commands that bypass browser CORS by routing through the
//! Tauri backend (reqwest) to the local egregore daemon. The frontend
//! `apiGet` / `apiPost` / `apiDelete` wrappers in `src/api/client.ts`
//! invoke these.

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
