/**
 * Android's own Save dialog, for the files the game hands out (the save-data export, the report log).
 *
 * The Android app's WebView has no Web Share API and drops blob downloads, so a `<a download>` link does nothing
 * there (#534). The app's `SaveFile` plugin (`android/.../SaveFilePlugin.java`) opens the system's create-document
 * picker in Downloads with the name filled in, and writes the text to the file the player picks.
 */
import type { Platform } from "./platform.js";

interface SaveFilePlugin {
  save(options: { fileName: string; contents: string; mimeType: string }): Promise<{ saved: boolean }>;
}

/** True in the Android app, where a file goes out through `saveTextOnAndroid` rather than a download link. */
export function savesThroughAndroidPicker(platform: Platform, userAgent: string): boolean {
  return platform === "capacitor" && /android/i.test(userAgent);
}

// Made once, as `openExternal` does, and boxed: the proxy answers every property, `then` included.
let saveFile: Promise<{ readonly plugin: SaveFilePlugin }> | null = null;

/** Resolves false when the player closes the picker without saving; rejects when the file couldn't be written. */
export async function saveTextOnAndroid(fileName: string, contents: string, mimeType: string): Promise<boolean> {
  saveFile ??= import("@capacitor/core").then(
    ({ registerPlugin }) => ({ plugin: registerPlugin<SaveFilePlugin>("SaveFile") }),
    (error: unknown) => {
      // A failed chunk load is tried again on the next save rather than kept.
      saveFile = null;
      throw error;
    },
  );
  const { plugin } = await saveFile;
  const { saved } = await plugin.save({ fileName, contents, mimeType });
  return saved;
}
