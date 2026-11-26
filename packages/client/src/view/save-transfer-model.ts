/**
 * Settings ▸ Save data ▸ Send to / Receive from another device: the pure decisions behind the two screens in
 * `scenes/save-data.ts` — the wording of every failure, the code's countdown, the link a QR code carries and what a
 * typed code is checked against. The requests themselves are `save-data/transfer-client.ts`.
 */
import { t } from "../i18n/translate.js";
import { formatTransferCode, parseTransferCode, receiveFragmentOf, type TransferCode } from "@mc/sync-worker/protocol";
import type { TransferFailure } from "../save-data/transfer-client.js";

export const sendRowTitle = (): string => t("saveData.sendRowTitle");
export const sendRowDetail = (): string => t("saveData.sendRowDetail");
export const receiveRowTitle = (): string => t("saveData.receiveRowTitle");
export const receiveRowDetail = (): string => t("saveData.receiveRowDetail");

/** The two screens' own steps, carried by `SaveDataStep` in `save-data-model.ts`. */
export type SendPhase =
  | { readonly kind: "uploading" }
  | { readonly kind: "showing"; readonly code: TransferCode; readonly expiresAt: number };

export type TransferStep =
  | { readonly kind: "send"; readonly phase: SendPhase }
  | { readonly kind: "receive"; readonly phase: "typing" | "fetching"; readonly input: string };

/** A line of status; `offerExport` adds an Export button beside it (the offline way to move a save). */
export interface TransferStatus {
  readonly tone: "none" | "ok" | "error";
  readonly text: string;
  readonly offerExport: boolean;
}

export const unavailableText = (): string => t("saveData.transfer.unavailableText");

/** The sentence for a failed send or receive; always read with the word "Problem:" in front by the scene. */
export function transferFailureStatusOf(failure: TransferFailure): TransferStatus {
  switch (failure.kind) {
    case "unavailable":
      return { tone: "error", text: unavailableText(), offerExport: true };
    case "unsupported":
      return { tone: "error", text: t("saveData.transfer.unsupported"), offerExport: true };
    case "not-found":
      return {
        tone: "error",
        text: t("saveData.transfer.notFound"),
        offerExport: false,
      };
    case "rate-limited":
      return {
        tone: "error",
        text: t("saveData.transfer.rateLimited"),
        offerExport: false,
      };
    case "blocked":
      return {
        tone: "error",
        text: t("saveData.transfer.blocked"),
        offerExport: false,
      };
    case "too-large":
      return {
        tone: "error",
        text: t("saveData.transfer.tooLarge"),
        offerExport: true,
      };
    case "damaged":
      return {
        tone: "error",
        text: t("saveData.transfer.damaged", { detail: failure.detail }),
        offerExport: false,
      };
  }
}

export const INVALID_CODE_STATUS: TransferStatus = {
  tone: "error",
  get text() {
    return t("saveData.transfer.invalid");
  },
  offerExport: false,
};

/** What a typed code means: the parsed code, or the status to show instead of asking the service. */
export function typedCodeOf(input: string): { readonly code: TransferCode } | { readonly status: TransferStatus } {
  const code = parseTransferCode(input);
  return code ? { code } : { status: INVALID_CODE_STATUS };
}

/** The code as shown, read aloud and copied. */
export const codeTextOf = formatTransferCode;

/** The link a QR code carries; the fragment never reaches a server. */
export function receiveLinkOf(
  code: TransferCode,
  location: { readonly origin: string; readonly pathname: string },
): string {
  return `${location.origin}${location.pathname}#${receiveFragmentOf(code)}`;
}

export interface Countdown {
  readonly text: string;
  readonly expired: boolean;
}

/** "Expires in 14:32" while the code is good, then t("saveData.transfer.expired"). Rounds up, so 0:00 is never shown live. */
export function countdownOf(expiresAt: number, now: number): Countdown {
  const left = expiresAt - now;
  if (left <= 0) return { text: t("saveData.transfer.expired"), expired: true };
  const seconds = Math.ceil(left / 1000);
  const mm = Math.floor(seconds / 60);
  const ss = String(seconds % 60).padStart(2, "0");
  return { text: t("saveData.transfer.expires", { time: `${mm}:${ss}` }), expired: false };
}

export const COPIED_STATUS: TransferStatus = {
  tone: "ok",
  get text() {
    return t("saveData.transfer.copied");
  },
  offerExport: false,
};
export const COPY_FAILED_STATUS: TransferStatus = {
  tone: "error",
  get text() {
    return t("saveData.transfer.copyFailed");
  },
  offerExport: false,
};

/** The save couldn't even be read off this device to send. */
export function sendFailedStatusOf(error: unknown): TransferStatus {
  const detail = error instanceof Error && error.message ? error.message : String(error);
  return { tone: "error", text: t("saveData.transfer.sendFailed", { detail }), offerExport: false };
}
