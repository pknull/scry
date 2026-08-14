//! HTTP proxy commands that bypass browser CORS by routing through the
//! Tauri backend (reqwest) to the local egregore daemon. The frontend
//! `apiGet` / `apiPost` / `apiDelete` wrappers in `src/api/client.ts`
//! invoke these.

const BASE_URL: &str = "http://127.0.0.1:7654";

fn validate_endpoint(endpoint: &str) -> Result<(), String> {
    if endpoint.starts_with("//") {
        return Err("API endpoint must not start with //".to_string());
    }

    if !(endpoint.starts_with("/v1/") || endpoint.starts_with("/metrics")) {
        return Err("API endpoint must start with /v1/ or /metrics".to_string());
    }

    if endpoint.contains("://") {
        return Err("API endpoint must not contain a URL scheme".to_string());
    }

    if endpoint.contains("..") {
        return Err("API endpoint must not contain path traversal".to_string());
    }

    if endpoint.chars().any(char::is_whitespace) {
        return Err("API endpoint must not contain whitespace".to_string());
    }

    Ok(())
}

fn build_url(endpoint: &str) -> Result<String, String> {
    validate_endpoint(endpoint)?;
    Ok(format!("{}{}", BASE_URL, endpoint))
}

#[tauri::command]
pub async fn api_get(endpoint: String) -> Result<String, String> {
    let url = build_url(&endpoint)?;
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
    let url = build_url(&endpoint)?;
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
    let url = build_url(&endpoint)?;
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

#[cfg(test)]
mod tests {
    use super::validate_endpoint;

    #[test]
    fn accepts_supported_endpoint_prefixes() {
        for endpoint in ["/v1/status", "/metrics"] {
            assert!(
                validate_endpoint(endpoint).is_ok(),
                "expected {endpoint:?} to be accepted"
            );
        }
    }

    #[test]
    fn rejects_unsafe_or_unsupported_endpoints() {
        for endpoint in [
            "http://evil",
            "//host/path",
            "/v1/../admin",
            "/v1/feed?next=http://evil",
            "/v1/status bad",
            "foo",
            "",
        ] {
            assert!(
                validate_endpoint(endpoint).is_err(),
                "expected {endpoint:?} to be rejected"
            );
        }
    }
}
