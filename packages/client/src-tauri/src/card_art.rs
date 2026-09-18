//! `cardart://` — card scans for the desktop shell: the native half of
//! `vite-card-art.ts`, answered in Rust.
//!
//! The web client asks for `/card-art/<path>`, which only the dev/preview
//! server answers. Here `src/platform/native-art.ts` rewrites that to this
//! scheme and Phaser's loader fetches it directly. Same contract as the dev
//! route: disk first, then MarvelCDB (written through, so a scan seen once is
//! there offline), and a 404 — never an error page — when there is no image,
//! which the client draws as the generated frame.
//!
//! The cache lives in the app's cache directory, never the bundle: the app
//! ships no scans (CLAUDE.md, "Content & IP boundaries").

use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use std::time::Duration;

use tauri::http::{header, Request, Response, StatusCode};
use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_http::reqwest;
use tokio::sync::Semaphore;

pub const SCHEME: &str = "cardart";

/// Where MarvelCDB serves the `ImageRef` paths — `MARVELCDB_IMAGE_BASE` in
/// packages/content/src/schema/images.ts.
const UPSTREAM: &str = "https://marvelcdb.com";

/// Upstream requests in flight at once; a board redraw asks for dozens.
const MAX_CONCURRENT: usize = 6;

/// Waits before each retry of a transient failure (network error, 429, 5xx).
const RETRY_DELAYS: [Duration; 2] = [Duration::from_millis(400), Duration::from_millis(1500)];

pub fn handle<R: Runtime>(app: &AppHandle<R>, request: Request<Vec<u8>>) -> impl std::future::Future<Output = Response<Vec<u8>>> + Send + 'static {
  let cache_root = app.path().app_cache_dir().ok().map(|dir| dir.join("card-art"));
  let path = relative_path(request.uri().path());
  async move {
    let (Some(cache_root), Some(path)) = (cache_root, path) else {
      return respond(StatusCode::BAD_REQUEST, None, b"bad card-art path".to_vec());
    };
    match load(&cache_root, &path).await {
      Some(bytes) => match image_type_of(&bytes) {
        Some(kind) => respond(StatusCode::OK, Some(kind), bytes),
        None => respond(StatusCode::NOT_FOUND, None, b"no art".to_vec()),
      },
      None => respond(StatusCode::NOT_FOUND, None, b"no art".to_vec()),
    }
  }
}

/// The request path as a relative path under the cache root, or None if it
/// could escape it. A path from the page decides a filesystem read, so this
/// check is not optional. `convertFileSrc` percent-encodes the whole path, so
/// it arrives as one segment.
fn relative_path(uri_path: &str) -> Option<String> {
  let decoded = percent_encoding::percent_decode_str(uri_path.trim_start_matches('/')).decode_utf8().ok()?;
  let path = decoded.trim_start_matches('/').to_string();
  let safe = !path.is_empty()
    && path.split('/').all(|part| !part.is_empty() && part != "." && part != "..")
    && path.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '/' | '.' | '-' | '_'));
  safe.then_some(path)
}

async fn load(cache_root: &Path, path: &str) -> Option<Vec<u8>> {
  let file: PathBuf = cache_root.join(path);
  if let Ok(bytes) = tokio::fs::read(&file).await {
    return Some(bytes);
  }
  let bytes = fetch_upstream(path).await?;
  // Write through, so the next launch is offline-capable for this scan.
  if let Some(dir) = file.parent() {
    let _ = tokio::fs::create_dir_all(dir).await;
  }
  let _ = tokio::fs::write(&file, &bytes).await;
  Some(bytes)
}

async fn fetch_upstream(path: &str) -> Option<Vec<u8>> {
  static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
  static SLOTS: Semaphore = Semaphore::const_new(MAX_CONCURRENT);
  let client = CLIENT.get_or_init(reqwest::Client::new);
  let url = format!("{UPSTREAM}/{path}");

  let mut delays = RETRY_DELAYS.iter();
  loop {
    let outcome = {
      let _slot = SLOTS.acquire().await.ok()?;
      attempt(client, &url).await
    };
    match outcome {
      Attempt::Image(bytes) => return Some(bytes),
      Attempt::Missing => return None,
      Attempt::Retry => tokio::time::sleep(*delays.next()?).await,
    }
  }
}

enum Attempt {
  Image(Vec<u8>),
  Missing,
  Retry,
}

async fn attempt(client: &reqwest::Client, url: &str) -> Attempt {
  let Ok(response) = client.get(url).send().await else {
    return Attempt::Retry;
  };
  let status = response.status();
  if status == StatusCode::TOO_MANY_REQUESTS || status.is_server_error() {
    return Attempt::Retry;
  }
  // Refuse anything that isn't an image: an upstream error page drawn as a
  // card would be worse than the generated frame.
  let is_image = response
    .headers()
    .get(header::CONTENT_TYPE)
    .and_then(|value| value.to_str().ok())
    .is_some_and(|value| value.starts_with("image/"));
  if !status.is_success() || !is_image {
    return Attempt::Missing;
  }
  match response.bytes().await {
    Ok(bytes) => Attempt::Image(bytes.to_vec()),
    Err(_) => Attempt::Retry,
  }
}

/// Sniffed from the bytes, not the extension: MarvelCDB serves JPEGs under
/// `.png` paths. None for anything that isn't an image at all.
fn image_type_of(bytes: &[u8]) -> Option<&'static str> {
  match bytes {
    [0xff, 0xd8, 0xff, ..] => Some("image/jpeg"),
    [0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a, ..] => Some("image/png"),
    [b'R', b'I', b'F', b'F', _, _, _, _, b'W', b'E', b'B', b'P', ..] => Some("image/webp"),
    [b'G', b'I', b'F', ..] => Some("image/gif"),
    _ => None,
  }
}

fn respond(status: StatusCode, content_type: Option<&str>, body: Vec<u8>) -> Response<Vec<u8>> {
  let mut response = Response::builder()
    .status(status)
    // The page's origin (tauri://localhost, or http://tauri.localhost on
    // Windows) differs from this scheme's, and Phaser loads by XHR.
    .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*");
  if let Some(kind) = content_type {
    response = response
      .header(header::CONTENT_TYPE, kind)
      // A scan never changes under a given path.
      .header(header::CACHE_CONTROL, "public, max-age=31536000, immutable");
  }
  response.body(body).expect("static headers are valid")
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn decodes_a_convert_file_src_path() {
    assert_eq!(relative_path("/bundles%2Fcards%2F01064.png").as_deref(), Some("bundles/cards/01064.png"));
    assert_eq!(relative_path("/bundles/cards/01064.png").as_deref(), Some("bundles/cards/01064.png"));
  }

  #[test]
  fn refuses_paths_that_escape_the_cache() {
    assert_eq!(relative_path("/..%2Fsecrets"), None);
    assert_eq!(relative_path("/bundles%2F..%2F..%2Fx.png"), None);
    assert_eq!(relative_path("/"), None);
    assert_eq!(relative_path("/a%00b.png"), None);
  }

  #[test]
  fn sniffs_images_and_refuses_the_rest() {
    assert_eq!(image_type_of(&[0xff, 0xd8, 0xff, 0xe0]), Some("image/jpeg"));
    assert_eq!(image_type_of(b"<html>"), None);
  }
}
