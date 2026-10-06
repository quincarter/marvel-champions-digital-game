/**
 * Settings ▸ Save data: the pure decisions behind `scenes/save-data.ts` — which step is showing, the status line
 * after each outcome, and the wording of the replace confirm. The scene draws these and does the I/O.
 */
import { describeSaveFileSummary, saveFileSummaryOf, type SaveFile } from "../save-data/save-file.js";

export const SAVE_DATA_ROW_TITLE = "Save data";
export const SAVE_DATA_ROW_DETAIL = "Export or import your saved games, decks, campaigns, unlocks and settings.";

/** A step is the file waiting for the player's yes/no, or nothing (the two buttons). */
export type SaveDataStep =
  | { readonly kind: "menu" }
  | { readonly kind: "confirm"; readonly file: SaveFile }
  | { readonly kind: "busy" };

/** One line under the buttons: what just happened. `error` is drawn with a "Problem:" word as well as color. */
export interface SaveDataStatus {
  readonly tone: "none" | "ok" | "error";
  readonly text: string;
}

export const NO_STATUS: SaveDataStatus = { tone: "none", text: "" };

/** A rejected share named "AbortError" is the player closing the share sheet, not a failure. */
export function isCancelledShare(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { name?: unknown }).name === "AbortError";
}

const messageOf = (error: unknown): string => (error instanceof Error && error.message ? error.message : String(error));

/** Status after an export attempt; `undefined` error means it went out. */
export function exportStatusOf(error?: unknown): SaveDataStatus {
  if (error === undefined) return { tone: "ok", text: "Exported." };
  if (isCancelledShare(error)) return NO_STATUS;
  return { tone: "error", text: `Couldn't export: ${messageOf(error)}` };
}

export function importFailedStatusOf(error: unknown): SaveDataStatus {
  return { tone: "error", text: `Couldn't import: ${messageOf(error)}` };
}

/** A picked file that didn't parse: its own error text, as written by the parser. */
export function badFileStatusOf(error: string): SaveDataStatus {
  return { tone: "error", text: error };
}

export interface ReplaceConfirm {
  readonly title: string;
  readonly body: string;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
}

export function replaceConfirmOf(file: SaveFile): ReplaceConfirm {
  return {
    title: "Replace everything on this device?",
    body:
      `This file has ${describeSaveFileSummary(saveFileSummaryOf(file))}. ` +
      "Your current saved games, decks, campaigns, unlocks and settings will be overwritten. This can't be undone.",
    confirmLabel: "Replace",
    cancelLabel: "Cancel",
  };
}
