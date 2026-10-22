/**
 * Settings ▸ Save data ▸ Send to / Receive from another device: the pure decisions behind the two screens in
 * `scenes/save-data.ts` — the wording of every failure, the code's countdown, the link a QR code carries and what a
 * typed code is checked against. The requests themselves are `save-data/transfer-client.ts`.
 */
import { formatTransferCode, parseTransferCode, receiveFragmentOf, type TransferCode } from "@mc/sync-worker/protocol";
import type { TransferFailure } from "../save-data/transfer-client.js";

export const SEND_ROW_TITLE = "Send to another device";
export const SEND_ROW_DETAIL =
  "Get a short code (and a QR code) that another device can use, within 15 minutes, to receive your save.";
export const RECEIVE_ROW_TITLE = "Receive from another device";
export const RECEIVE_ROW_DETAIL =
  "Type the code shown on the other device (or scan its QR code). It replaces what's on this device, after you confirm.";

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

export const UNAVAILABLE_TEXT = "Online transfer is unavailable right now. You can still export a save file.";

/** The sentence for a failed send or receive; always read with the word "Problem:" in front by the scene. */
export function transferFailureStatusOf(failure: TransferFailure): TransferStatus {
  switch (failure.kind) {
    case "unavailable":
      return { tone: "error", text: UNAVAILABLE_TEXT, offerExport: true };
    case "unsupported":
      return { tone: "error", text: "This browser can't send saves online. Use Export instead.", offerExport: true };
    case "not-found":
      return {
        tone: "error",
        text: "That code didn't work. It may be mistyped, already used, or expired (codes last 15 minutes).",
        offerExport: false,
      };
    case "rate-limited":
      return {
        tone: "error",
        text: "Too many tries from this device just now. Wait a minute, then try again.",
        offerExport: false,
      };
    case "blocked":
      return {
        tone: "error",
        text: "Too many wrong codes from this device. Online transfer is paused here for a while; try again later.",
        offerExport: false,
      };
    case "too-large":
      return {
        tone: "error",
        text: "This save is too big to send online. You can still export a save file.",
        offerExport: true,
      };
    case "damaged":
      return {
        tone: "error",
        text: `The save arrived damaged and couldn't be read (${failure.detail}). Ask the other device for a new code.`,
        offerExport: false,
      };
  }
}

export const INVALID_CODE_STATUS: TransferStatus = {
  tone: "error",
  text: "That isn't a transfer code. It has 12 letters and numbers, like ABCD-EFGH-JKMN.",
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

/** "Expires in 14:32" while the code is good, then "This code has expired". Rounds up, so 0:00 is never shown live. */
export function countdownOf(expiresAt: number, now: number): Countdown {
  const left = expiresAt - now;
  if (left <= 0) return { text: "This code has expired", expired: true };
  const seconds = Math.ceil(left / 1000);
  const mm = Math.floor(seconds / 60);
  const ss = String(seconds % 60).padStart(2, "0");
  return { text: `Expires in ${mm}:${ss}`, expired: false };
}

export const COPIED_STATUS: TransferStatus = { tone: "ok", text: "Code copied.", offerExport: false };
export const COPY_FAILED_STATUS: TransferStatus = {
  tone: "error",
  text: "Couldn't copy to the clipboard. Read the code off the screen instead.",
  offerExport: false,
};

/** The save couldn't even be read off this device to send. */
export function sendFailedStatusOf(error: unknown): TransferStatus {
  const detail = error instanceof Error && error.message ? error.message : String(error);
  return { tone: "error", text: `Couldn't send: ${detail}`, offerExport: false };
}
