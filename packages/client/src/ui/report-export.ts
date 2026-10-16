/**
 * The report panel's two ways out for the log (#176, `scenes/report-issue.ts`): the clipboard and a saved file.
 * Both are plain DOM, since the canvas has neither.
 */

/** Copies `text`; resolves false when neither the Clipboard API nor the old `execCommand` fallback worked. */
export async function copyText(text: string): Promise<boolean> {
  const clipboard = navigator.clipboard as Clipboard | undefined;
  if (clipboard) {
    try {
      await clipboard.writeText(text);
      return true;
    } catch {
      // A webview without clipboard permission: try the fallback below.
    }
  }
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0;";
  document.body.appendChild(field);
  field.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    field.remove();
  }
}

/** Saves `text` as `fileName` through the browser's download. */
export function downloadText(text: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoked later, not now: some browsers start the download only after this click's task ends.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
