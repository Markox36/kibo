use aes_gcm::{aead::Aead, Aes256Gcm, KeyInit, Nonce};
use argon2::{Algorithm, Argon2, Params, Version};
use rand::RngCore;
use serde::Serialize;
use tauri::State;

use crate::AppState;

const MAGIC: &[u8] = b"KIBOB1\n";
const SALT_LEN: usize = 16;
const NONCE_LEN: usize = 12;
const KEY_LEN: usize = 32;

fn derive_key(passphrase: &str, salt: &[u8]) -> Result<[u8; KEY_LEN], String> {
    let params = Params::new(19 * 1024, 2, 1, Some(KEY_LEN)).map_err(|e| e.to_string())?;
    let argon = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut key = [0u8; KEY_LEN];
    argon
        .hash_password_into(passphrase.as_bytes(), salt, &mut key)
        .map_err(|e| e.to_string())?;
    Ok(key)
}

#[derive(Serialize)]
pub struct EncBackupResult {
    pub path: String,
    pub bytes: usize,
}

#[tauri::command]
pub async fn export_backup_encrypted(
    state: State<'_, AppState>,
    path: String,
    passphrase: String,
) -> Result<EncBackupResult, String> {
    if passphrase.len() < 8 {
        return Err("passphrase_too_short".into());
    }
    let json = {
        let conn = state.db.lock().await;
        crate::backup::snapshot_json(&conn).map_err(|e| e.to_string())?
    };

    let mut salt = [0u8; SALT_LEN];
    let mut nonce_bytes = [0u8; NONCE_LEN];
    rand::thread_rng().fill_bytes(&mut salt);
    rand::thread_rng().fill_bytes(&mut nonce_bytes);

    let key = derive_key(&passphrase, &salt)?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ciphertext = cipher
        .encrypt(nonce, json.as_bytes())
        .map_err(|e| e.to_string())?;

    let mut out = Vec::with_capacity(MAGIC.len() + SALT_LEN + NONCE_LEN + ciphertext.len());
    out.extend_from_slice(MAGIC);
    out.extend_from_slice(&salt);
    out.extend_from_slice(&nonce_bytes);
    out.extend_from_slice(&ciphertext);

    let bytes = out.len();
    std::fs::write(&path, out).map_err(|e| e.to_string())?;

    Ok(EncBackupResult { path, bytes })
}

#[tauri::command]
pub async fn import_backup_encrypted(
    state: State<'_, AppState>,
    path: String,
    passphrase: String,
) -> Result<crate::backup::BackupResult, String> {
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    if bytes.len() < MAGIC.len() + SALT_LEN + NONCE_LEN + 16 {
        return Err("invalid_file".into());
    }
    if &bytes[..MAGIC.len()] != MAGIC {
        return Err("bad_magic".into());
    }
    let salt = &bytes[MAGIC.len()..MAGIC.len() + SALT_LEN];
    let nonce_bytes = &bytes[MAGIC.len() + SALT_LEN..MAGIC.len() + SALT_LEN + NONCE_LEN];
    let ciphertext = &bytes[MAGIC.len() + SALT_LEN + NONCE_LEN..];

    let key = derive_key(&passphrase, salt)?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
    let nonce = Nonce::from_slice(nonce_bytes);
    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| "decrypt_failed_wrong_passphrase_or_corrupt".to_string())?;
    let json = String::from_utf8(plaintext).map_err(|e| e.to_string())?;

    let conn = state.db.lock().await;
    let value: serde_json::Value = serde_json::from_str(&json).map_err(|e| e.to_string())?;
    crate::backup::apply_snapshot(&conn, &value).map_err(|e| e.to_string())
}

