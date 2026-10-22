//! Settings → Save data → Export on the desktop: the system's own Save dialog,
//! opened in Downloads with the dated file name filled in, then the file
//! written where the player chose (src/save-data/file-transfer.ts).
//!
//! The webview's share sheet is the wrong tool on a desktop (macOS offers
//! AirDrop and Mail, not a folder), and a desktop webview doesn't download.
//! The write happens here rather than through the fs plugin so the page gets
//! no file-system access of its own: it can only write the one path the
//! player just picked.

use tauri::Manager;
use tauri_plugin_dialog::DialogExt;

/// Asks where to save `contents` and writes it there. Returns the path written,
/// or `None` when the player closed the dialog without saving.
///
/// Async so it runs off the main thread: a blocking dialog on the main thread
/// would wait on the event loop it is blocking.
#[tauri::command]
pub async fn save_text_file(
  window: tauri::WebviewWindow,
  file_name: String,
  contents: String,
) -> Result<Option<String>, String> {
  let mut dialog = window
    .dialog()
    .file()
    .set_parent(&window)
    .set_title("Export save data")
    .set_file_name(&file_name)
    .add_filter("Save data", &["json"]);
  if let Ok(downloads) = window.path().download_dir() {
    dialog = dialog.set_directory(downloads);
  }
  let Some(chosen) = dialog.blocking_save_file() else {
    return Ok(None);
  };
  let path = chosen.into_path().map_err(|e| e.to_string())?;
  std::fs::write(&path, contents).map_err(|e| e.to_string())?;
  Ok(Some(path.to_string_lossy().into_owned()))
}
