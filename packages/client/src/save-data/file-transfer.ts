/**
 * Getting a save-data file out of the game and back in, through the DOM's own file plumbing (Phaser has none).
 *
 * Out: a browser downloads it through a throwaway `<a download>`. A native shell's webview doesn't download, so
 * there it goes to the system share sheet (Files, AirDrop, Drive) when the webview can share files, and falls back
 * to the same link otherwise. In: a throwaway `<input type="file">`, which every shell routes to its own picker.
 */
import { detectPlatform, isNativeShell } from "../platform/platform.js";
import { parseSaveFile, saveFileNameOf, type ParseResult, type SaveFile } from "./save-file.js";

export async function deliverSaveFile(file: SaveFile): Promise<void> {
  const name = saveFileNameOf(file.exportedAt);
  const json = JSON.stringify(file);
  const blob = new Blob([json], { type: "application/json" });

  const share = globalThis.navigator?.share?.bind(globalThis.navigator);
  if (isNativeShell(detectPlatform()) && share) {
    const shared = new File([blob], name, { type: "application/json" });
    if (globalThis.navigator.canShare?.({ files: [shared] }) === true) {
      await share({ files: [shared], title: name });
      return;
    }
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
