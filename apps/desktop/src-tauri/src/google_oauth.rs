use anyhow::{anyhow, Result};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::RngCore;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::net::TcpListener;
use std::time::Duration;

const SCOPE: &str = "openid email profile";
const AUTH_ENDPOINT: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT: &str = "https://oauth2.googleapis.com/token";

fn random_urlsafe(bytes: usize) -> String {
    let mut buf = vec![0u8; bytes];
    rand::thread_rng().fill_bytes(&mut buf);
    URL_SAFE_NO_PAD.encode(buf)
}

fn code_challenge(verifier: &str) -> String {
    let hash = Sha256::digest(verifier.as_bytes());
    URL_SAFE_NO_PAD.encode(hash)
}

fn parse_query(target: &str) -> HashMap<String, String> {
    let q = target.split_once('?').map(|(_, q)| q).unwrap_or("");
    q.split('&')
        .filter(|s| !s.is_empty())
        .filter_map(|pair| pair.split_once('='))
        .map(|(k, v)| {
            (
                urlencoding::decode(k).unwrap_or_default().into_owned(),
                urlencoding::decode(v).unwrap_or_default().into_owned(),
            )
        })
        .collect()
}

fn wait_for_code(listener: TcpListener, expected_state: &str) -> Result<String> {
    listener.set_nonblocking(false)?;
    let (mut stream, _) = listener.accept()?;
    stream.set_read_timeout(Some(Duration::from_secs(300)))?;

    let mut reader = BufReader::new(stream.try_clone()?);
    let mut request_line = String::new();
    reader.read_line(&mut request_line)?;
    loop {
        let mut line = String::new();
        let n = reader.read_line(&mut line)?;
        if n == 0 || line == "\r\n" || line == "\n" {
            break;
        }
    }

    let target = request_line.split_whitespace().nth(1).unwrap_or("/");
    let params = parse_query(target);

    let body = if let Some(err) = params.get("error") {
        render_error_page(err)
    } else {
        render_success_page()
    };
    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        body.len(),
        body
    );
    stream.write_all(response.as_bytes())?;
    let _ = stream.flush();

    if let Some(err) = params.get("error") {
        return Err(anyhow!("oauth_error:{}", err));
    }
    if params.get("state").map(String::as_str) != Some(expected_state) {
        return Err(anyhow!("state_mismatch"));
    }
    params
        .get("code")
        .cloned()
        .ok_or_else(|| anyhow!("missing_code"))
}

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

const PAGE_STYLES: &str = r#"
  :root { color-scheme: dark; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; }
  body {
    font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    background-color: #0a0a0b;
    background-image:
      radial-gradient(600px 400px at 20% 0%, rgba(124,140,255,0.10), transparent 70%),
      radial-gradient(600px 400px at 100% 100%, rgba(167,139,250,0.08), transparent 70%);
    color: #e8e8ee;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    -webkit-font-smoothing: antialiased;
    line-height: 1.5;
  }
  .card {
    width: 100%;
    max-width: 380px;
    background-color: #131316;
    border: 1px solid #23232a;
    border-radius: 16px;
    padding: 40px 32px 32px;
    box-shadow: 0 20px 50px -20px rgba(0,0,0,0.6);
    text-align: center;
  }
  .brand {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: #8a8a94;
    margin-bottom: 32px;
  }
  .brand-dot {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: linear-gradient(135deg, #7c8cff, #a78bfa);
  }
  .icon {
    width: 64px;
    height: 64px;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 20px;
  }
  .icon-ok {
    background-color: rgba(124,140,255,0.14);
    color: #a5b3ff;
  }
  .icon-err {
    background-color: rgba(239,68,68,0.12);
    color: #fca5a5;
  }
  h1 {
    font-size: 20px;
    font-weight: 600;
    margin-bottom: 8px;
    letter-spacing: -0.01em;
    color: #f2f2f6;
  }
  p {
    font-size: 14px;
    color: #9a9aa4;
  }
  .code {
    display: inline-block;
    margin-top: 14px;
    padding: 6px 10px;
    border-radius: 8px;
    background-color: rgba(255,255,255,0.04);
    border: 1px solid #23232a;
    font-family: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
    font-size: 11px;
    color: #e8e8ee;
    word-break: break-all;
    max-width: 100%;
  }
  .hint {
    margin-top: 28px;
    padding-top: 20px;
    border-top: 1px solid #23232a;
    font-size: 12px;
    color: #6b6b74;
  }
"#;

fn render_success_page() -> String {
    format!(
        r#"<!doctype html><html lang="es-ES"><head><meta charset="utf-8"><title>Kibo · Sesión iniciada</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>{styles}</style></head><body><main class="card"><div class="brand"><span class="brand-dot"></span>Kibo</div><div class="icon icon-ok"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div><h1>Sesión iniciada</h1><p>Ya puedes cerrar esta pestaña y volver a Kibo.</p><div class="hint">Esta ventana se puede cerrar en cualquier momento.</div></main><script>setTimeout(function(){{try{{window.close();}}catch(e){{}}}},1500);</script></body></html>"#,
        styles = PAGE_STYLES
    )
}

fn render_error_page(err: &str) -> String {
    format!(
        r#"<!doctype html><html lang="es-ES"><head><meta charset="utf-8"><title>Kibo · Inicio cancelado</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>{styles}</style></head><body><main class="card"><div class="brand"><span class="brand-dot"></span>Kibo</div><div class="icon icon-err"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></div><h1>Inicio de sesión cancelado</h1><p>No se ha completado el inicio de sesión con Google.</p><span class="code">{err}</span><div class="hint">Vuelve a Kibo e inténtalo de nuevo.</div></main></body></html>"#,
        styles = PAGE_STYLES,
        err = html_escape(err)
    )
}

#[derive(serde::Deserialize)]
struct TokenResp {
    id_token: Option<String>,
    error: Option<String>,
    error_description: Option<String>,
}

fn run_flow(client_id: String, client_secret: Option<String>) -> Result<String> {
    let listener = TcpListener::bind("127.0.0.1:0")?;
    let port = listener.local_addr()?.port();
    let redirect_uri = format!("http://127.0.0.1:{}/", port);
    let verifier = random_urlsafe(64);
    let challenge = code_challenge(&verifier);
    let state = random_urlsafe(24);

    let url = format!(
        "{}?client_id={}&redirect_uri={}&response_type=code&scope={}&code_challenge={}&code_challenge_method=S256&state={}&access_type=online&prompt=select_account",
        AUTH_ENDPOINT,
        urlencoding::encode(&client_id),
        urlencoding::encode(&redirect_uri),
        urlencoding::encode(SCOPE),
        urlencoding::encode(&challenge),
        urlencoding::encode(&state),
    );

    open::that(&url).map_err(|e| anyhow!("open_browser_failed: {}", e))?;
    let code = wait_for_code(listener, &state)?;

    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(20))
        .build()?;
    let mut form: Vec<(&str, &str)> = vec![
        ("code", code.as_str()),
        ("client_id", client_id.as_str()),
        ("code_verifier", verifier.as_str()),
        ("grant_type", "authorization_code"),
        ("redirect_uri", redirect_uri.as_str()),
    ];
    let secret_ref = client_secret.as_deref().unwrap_or("");
    if !secret_ref.is_empty() {
        form.push(("client_secret", secret_ref));
    }
    let resp: TokenResp = client.post(TOKEN_ENDPOINT).form(&form).send()?.json()?;
    if let Some(err) = resp.error {
        return Err(anyhow!(
            "token_exchange_failed: {} {}",
            err,
            resp.error_description.unwrap_or_default()
        ));
    }
    resp.id_token.ok_or_else(|| anyhow!("missing_id_token"))
}

#[tauri::command]
pub async fn open_external_url(url: String) -> Result<(), String> {
    if url.trim().is_empty() {
        return Err("empty_url".into());
    }
    open::that(&url).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn google_oauth_login(
    client_id: String,
    client_secret: Option<String>,
) -> Result<String, String> {
    if client_id.trim().is_empty() {
        return Err("missing_client_id".into());
    }
    let secret = client_secret.and_then(|s| {
        let t = s.trim().to_string();
        if t.is_empty() { None } else { Some(t) }
    });
    tokio::task::spawn_blocking(move || run_flow(client_id, secret))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}
