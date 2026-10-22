/**
 * Getting a save-data file out of the game and back in, through the DOM's own file plumbing (Phaser has none).
 *
 * Out: a browser downloads it through a throwaway `<a download>`. The desktop app (Tauri) asks the system's own Save
 * dialog, opened in Downloads with the file name filled in (`src-tauri/src/save_file.rs`): a desktop webview doesn't
 * download, and macOS's share sheet offers AirDrop and Mail rather than a folder. The phone apps (Capacitor) go to the
 * share sheet (Files, AirDrop, Drive) when the webview can share files, and fall back to the same link otherwise.
 * In: a throwaway `<input type="file">`, which every shell routes to its own picker.
 */
import { detectPlatform, type Platform } from "../platform/platform.js";
import { parseSaveFile, saveFileNameOf, type ParseResult, type SaveFile } from "./save-file.js";

export type ExportRoute = "save-dialog" | "share" | "download";

export function exportRouteFor(platform: Platform, canShareFiles: boolean): ExportRoute {
  if (platform === "tauri") return "save-dialog";
  if (platform === "capacitor" && canShareFiles) return "share";
  return "download";
}

/** Closing the Save dialog reads as closing the share sheet: an AbortError, which the overlay shows no status for. */
const cancelled = (): Error => new DOMException("The save dialog was closed.", "AbortError");

export async function deliverSaveFile(file: SaveFile): Promise<void> {
  const name = saveFileNameOf(file.exportedAt);
  const json = JSON.stringify(file);
  const blob = new Blob([json], { type: "application/json" });
  const shared = new File([blob], name, { type: "application/json" });
  const nav = globalThis.navigator;
  const canShareFiles = typeof nav?.share === "function" && nav.canShare?.({ files: [shared] }) === true;

  switch (exportRouteFor(detectPlatform(), canShareFiles)) {
    case "save-dialog": {
      const { invoke } = await import("@tauri-apps/api/core");
      const saved = await invoke<string | null>("save_text_file", { fileName: name, contents: json });
      if (saved === null) throw cancelled();
      return;
    }
    case "share":
      await nav.share({ files: [shared], title: name });
      return;
    case "download":
      break;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.style.display = "none";
  document.body.append(link);
  link.click();
  link.remove();
  // Revoked on the next turn rather than at once: some browsers start the download after `click()` returns.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Opens the file picker and parses what comes back. Resolves `null` when the player closes the picker without
 * choosing, so the caller can tell that apart from a bad file.
 */
export function pickSaveFile(): Promise<ParseResult | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.style.display = "none";
    let settled = false;
    const finish = (result: ParseResult | null): void => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(result);
    };
    input.addEventListener("change", () => {
      const chosen = input.files?.[0];
      if (!chosen) return finish(null);
      chosen.text().then(
        (text) => finish(parseSaveFile(text)),
        () => finish({ ok: false, error: "That file couldn't be read." }),
      );
    });
    input.addEventListener("cancel", () => finish(null));
    document.body.append(input);
    input.click();
  });
}
