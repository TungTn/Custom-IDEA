const APP_KEYRING_SERVICE_PREFIX: &str = "custom-idea";

#[tauri::command]
pub fn app_secret_set(namespace: String, key: String, value: String) -> Result<(), String> {
  let ns = namespace.trim();
  let k = key.trim();
  if ns.is_empty() || k.is_empty() {
    return Err("Namespace and key must not be empty".to_string());
  }
  if ns.len() > 64 || k.len() > 256 || value.len() > 4096 {
    return Err("Secret key or payload exceeds permitted length limit".to_string());
  }
  let service = format!("{}-{}", APP_KEYRING_SERVICE_PREFIX, ns);
  let entry = keyring::Entry::new(&service, k)
    .map_err(|e| format!("Failed to access OS credential manager: {}", e))?;
  entry
    .set_password(&value)
    .map_err(|e| format!("Failed to save secret in OS credential manager: {}", e))
}

#[tauri::command]
pub fn app_secret_get(namespace: String, key: String) -> Result<Option<String>, String> {
  let ns = namespace.trim();
  let k = key.trim();
  if ns.is_empty() || k.is_empty() {
    return Err("Namespace and key must not be empty".to_string());
  }
  if ns.len() > 64 || k.len() > 256 {
    return Err("Secret key exceeds permitted length limit".to_string());
  }
  let service = format!("{}-{}", APP_KEYRING_SERVICE_PREFIX, ns);
  let entry = keyring::Entry::new(&service, k)
    .map_err(|e| format!("Failed to access OS credential manager: {}", e))?;
  match entry.get_password() {
    Ok(val) => Ok(Some(val)),
    Err(keyring::Error::NoEntry) => Ok(None),
    Err(e) => Err(format!("Failed to retrieve secret from OS credential manager: {}", e)),
  }
}

#[tauri::command]
pub fn app_secret_delete(namespace: String, key: String) -> Result<(), String> {
  let ns = namespace.trim();
  let k = key.trim();
  if ns.is_empty() || k.is_empty() {
    return Err("Namespace and key must not be empty".to_string());
  }
  if ns.len() > 64 || k.len() > 256 {
    return Err("Secret key exceeds permitted length limit".to_string());
  }
  let service = format!("{}-{}", APP_KEYRING_SERVICE_PREFIX, ns);
  let entry = keyring::Entry::new(&service, k)
    .map_err(|e| format!("Failed to access OS credential manager: {}", e))?;
  match entry.delete_credential() {
    Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
    Err(e) => Err(format!("Failed to delete secret from OS credential manager: {}", e)),
  }
}
