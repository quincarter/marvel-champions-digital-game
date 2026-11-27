/**
 * Settings ▸ Save data: the pure decisions behind `scenes/save-data.ts` — which step is showing, the status line
 * after each outcome, and the wording of the replace confirm. The scene draws these and does the I/O.
 */
import { describeSaveFileSummary, saveFileSummaryOf, type SaveFile } from "../save-data/save-file.js";
import type { TransferStep } from "./save-transfer-model.js";
import { t } from "../i18n/translate.js";

/** Settings' Save data row, read when drawn so a language switch shows at once. */
export const saveDataRowTitle = (): string => t("settings.saveData.title");
export const saveDataRowDetail = (): string => t("settings.saveData.detail");
export const exportRowTitle = (): string => t("saveData.exportRowTitle");
export const exportRowDetail = (): string => t("saveData.exportRowDetail");
export const importRowTitle = (): string => t("saveData.importRowTitle");
export const importRowDetail = (): string => t("saveData.importRowDetail");

/** A step is the file waiting for the player's yes/no, the send or receive screen, or nothing (the action rows). */
export type SaveDataStep =
  | { readonly kind: "menu" }
  | { readonly kind: "confirm"; readonly file: SaveFile }
  | { readonly kind: "busy" }
  | TransferStep;

/** One line under the buttons: what just happened. `error` is drawn with a "Problem:" word as well as color. */
export interface SaveDataStatus {
  readonly tone: "none" | "ok" | "error";
  readonly text: string;
  /** Adds an Export button beside the line: the offline way to move a save when online transfer can't. */
  readonly offerExport?: boolean;
}

export const NO_STATUS: SaveDataStatus = { tone: "none", text: "" };

/** A rejected share named "AbortError" is the player closing the share sheet, not a failure. */
export function isCancelledShare(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { name?: unknown }).name === "AbortError";
}

const messageOf = (error: unknown): string => (error instanceof Error && error.message ? error.message : String(error));

/** Status after an export attempt; `undefined` error means it went out. */
export function exportStatusOf(error?: unknown): SaveDataStatus {
  if (error === undefined) return { tone: "ok", text: t("saveData.exported") };
  if (isCancelledShare(error)) return NO_STATUS;
  return { tone: "error", text: t("saveData.exportFailed", { detail: messageOf(error) }) };
}

export function importFailedStatusOf(error: unknown): SaveDataStatus {
  return { tone: "error", text: t("saveData.importFailed", { detail: messageOf(error) }) };
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

/** `syncOn`: this device is linked for device sync, whose other devices are not touched by a replace. */
export function replaceConfirmOf(file: SaveFile, syncOn = false): ReplaceConfirm {
  return {
    title: t("saveData.replace.title"),
    body:
      t("saveData.replace.fileHas", { what: describeSaveFileSummary(saveFileSummaryOf(file)) }) +
      " " +
      t("saveData.replace.overwritten") +
      (syncOn ? " " + t("saveData.replace.syncOn") : ""),
    confirmLabel: t("saveData.replace.confirm"),
    cancelLabel: t("saveData.cancel"),
  };
}
