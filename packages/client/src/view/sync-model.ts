/**
 * Device sync's screens, as plain decisions (issue #276, step 2): which step Save data ▸ Sync across devices is on, the
 * wording of every outcome and failure, the recovery code as shown, the link a QR code carries, and the conflict
 * prompt's text and buttons. `scenes/sync-data.ts` and `scenes/sync-conflict.ts` draw these; `sync/sync-service.ts`
 * does the work.
 */
import { formatRecoveryCode, parseRecoveryCode } from "@mc/sync-worker/sync-protocol";
import type { TransferFailure } from "../save-data/transfer-client.js";
import { linkFragmentOf, type SyncLinkAddress } from "../sync/sync-link.js";
import type { SyncServiceFailure } from "../sync/sync-service.js";
import { agoText, statusLine, type SyncStatus } from "../sync/sync-status.js";
import type { ConflictChoice, GameConflict } from "../sync/sync-types.js";
import { NO_STATUS, type SaveDataStatus } from "./save-data-model.js";

/** Emitted on the game's event bus when the conflict prompt closes, so the watcher can open the next game's. */
export const CONFLICT_CLOSED = "mc-sync-conflict-closed";

export const SYNC_ROW_TITLE = "Sync across devices";
export const SYNC_ROW_DETAIL = "Keep your saved games, decks and campaigns in step on every device you play on.";

/** The sync screen's steps. `home` is the status and the actions (which ones depend on whether sync is on). */
export type SyncStep =
  | { readonly kind: "home" }
  /** "creating" while the space is made; then the code, until the player says they have saved it. */
  | { readonly kind: "setup"; readonly phase: "creating" | { readonly code: string } }
  | { readonly kind: "show-code"; readonly code: string }
  | { readonly kind: "join"; readonly phase: "typing" | "working"; readonly input: string }
  | {
      readonly kind: "link";
      readonly phase:
        | "uploading"
        | { readonly link: SyncLinkAddress; readonly expiresAt: number; readonly typed: string };
    }
  | { readonly kind: "join-link"; readonly link: SyncLinkAddress; readonly phase: "asking" | "working" }
  | { readonly kind: "delete"; readonly phase: "asking" | "working" }
  /** Unlink asks first: the recovery code is the way back, so it suggests looking at it. */
  | { readonly kind: "unlink" };

/** A step that is waiting on the network: nothing can be pressed until it answers. */
export function syncStepWorking(step: SyncStep): boolean {
  switch (step.kind) {
    case "setup":
      return step.phase === "creating";
    case "join":
      return step.phase === "working";
    case "link":
      return step.phase === "uploading";
    case "join-link":
    case "delete":
      return step.phase === "working";
    default:
      return false;
  }
}

/** A step Escape or the ✕ may not leave: the recovery code was shown once and the player has not said they saved it. */
export function syncStepMustAcknowledge(step: SyncStep): boolean {
  return step.kind === "setup" && step.phase !== "creating";
}

// ---- the recovery code ---------------------------------------------------------------------------------------------

/** "ABCDE-FGHJK-MNPQR-STUVW-XYZ23"; a code that isn't a code is returned as it is. */
export function recoveryCodeText(code: string): string {
  const parsed = parseRecoveryCode(code);
  return parsed ? formatRecoveryCode(parsed) : code;
}

/** What the typed field shows: the characters grouped in fives as they are typed (letters upper case). */
export function groupedInputOf(input: string): string {
  const letters = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return letters.match(/.{1,5}/g)?.join("-") ?? "";
}

export const RECOVERY_PLACEHOLDER = "ABCDE-FGHJK-MNPQR-STUVW-XYZ23";

// ---- the link ------------------------------------------------------------------------------------------------------

/** The link a QR code carries; the fragment never reaches a server. */
export function syncLinkUrlOf(
  link: SyncLinkAddress,
  location: { readonly origin: string; readonly pathname: string },
): string {
  return `${location.origin}${location.pathname}#${linkFragmentOf(link)}`;
}

// ---- wording -------------------------------------------------------------------------------------------------------

export const UNAVAILABLE_TEXT = "Online sync is unavailable right now. Your saves stay on this device.";

export const SYNC_OFF_INTRO =
  "Sync copies your saves to a private space online, scrambled so only your devices can read them, and keeps every device up to date. Your saves always stay on this device too.";
export const SYNC_ON_INTRO =
  "This device is synced. Your saves are copied to a private space online, scrambled so only your devices can read them.";
export const SETUP_HELP =
  "This is your recovery code. It is the only key to your synced saves: nobody, including us, can get it back for you. Write it down or save it somewhere safe. You will need it to sync another device.";
export const SHOW_CODE_HELP =
  "Type this code on another device (Save data, Sync across devices, Join with a recovery code) to bring your saves to it. Keep it private: anyone with this code can read and change your synced saves.";
export const LINK_HELP =
  "On the other device, scan this QR code with its camera. The link works once and expires in 15 minutes.";
export const LINK_TYPE_HELP = "Or type this code on the other device. Your recovery code works there too.";
export const JOIN_HELP =
  "Type the link code or the 25-character recovery code shown on a device that is already synced. This device's saves and that device's saves are merged; nothing is deleted.";
export const JOIN_LINK_TITLE = "Join this device to your synced saves?";
export const JOIN_LINK_BODY =
  "This device was linked from another one. Joining merges the saves on both; nothing is deleted. A game both devices changed will ask you which copy to keep.";
export const JOIN_LINK_SWITCH_BODY =
  "This device is already synced to another space. Joining switches it to the one this link belongs to and forgets the old recovery code (write it down first if you want to come back). The saves on this device are kept and merged; nothing is deleted. A game both devices changed will ask you which copy to keep.";
export const UNLINK_TITLE = "Unlink this device?";
export const UNLINK_BODY =
  "This device stops syncing. Its saves stay on it, and your cloud copy stays for your other devices. To sync it again you will need your recovery code, so look at it first if you have not written it down.";

/** The status line as shown on both Save data and the sync screen: a linked device is starting, not off, before its first run. */
export function syncStatusDisplay(linked: boolean, status: SyncStatus, now: number): string {
  return linked && status.state === "off" ? "Starting…" : syncStatusText(status, now);
}

export const DELETE_TITLE = "Delete your cloud data?";
export const DELETE_BODY =
  "This deletes the synced copy of your saves online, for every device. Saves already on each device stay, but they will stop syncing. This can't be undone.";

/** The status line under the section title: "Synced 2 min ago", "Offline, changes waiting", "Off". */
export function syncStatusText(status: SyncStatus, now: number): string {
  return statusLine(status, now);
}

/** A caution mark in words, never color alone: states a player should look at are prefixed. */
export function syncStatusNeedsAttention(status: SyncStatus): boolean {
  return status.state === "error" || status.state === "offline";
}

function linkFailureText(failure: TransferFailure): string {
  switch (failure.kind) {
    case "not-found":
      return "That link has expired or was already used. Make a new one on the other device.";
    case "unavailable":
      return UNAVAILABLE_TEXT;
    case "unsupported":
      return "This browser can't sync saves online. Your saves stay on this device.";
    case "rate-limited":
      return "Too many tries from this device just now. Wait a minute, then try again.";
    case "blocked":
      return "Too many wrong tries from this device. Online sync is paused here for a while; try again later.";
    case "too-large":
      return "That link is too large to read. Make a new one on the other device.";
    case "damaged":
      return `The link couldn't be read (${failure.detail}). Make a new one on the other device.`;
  }
}

/** The sentence for a failed sync action; always read with the word "Problem:" in front by the scene. */
export function syncFailureStatusOf(failure: SyncServiceFailure): SaveDataStatus {
  const error = (text: string): SaveDataStatus => ({ tone: "error", text });
  switch (failure.kind) {
    case "unavailable":
      return error(UNAVAILABLE_TEXT);
    case "unsupported":
      return error("This browser can't sync saves online. Your saves stay on this device.");
    case "wrong-code":
    case "not-found":
      return error("That recovery code didn't match any synced saves. Check it and try again.");
    case "invalid-code":
      return error("That isn't a recovery code. It has 25 letters and numbers, like ABCDE-FGHJK-MNPQR-STUVW-XYZ23.");
    case "rate-limited":
      return error("Too many tries from this device just now. Wait a minute, then try again.");
    case "blocked":
      return error("Too many wrong codes from this device. Online sync is paused here for a while; try again later.");
    case "space-full":
      return error(
        "Your cloud space is full (10 MB). Removing decks you no longer use frees space; finished games stay in it.",
      );
    case "too-large":
      return error("A save is too large to sync.");
    case "storage":
      return error("This browser wouldn't keep the recovery code, so sync could not be turned on here.");
    case "link":
      return error(linkFailureText(failure.failure));
    case "not-on":
      return error("Sync is off on this device.");
    case "error":
      // The detail is for the log, never for the player.
      console.warn("device sync:", failure.message);
      return error("Sync hit a problem. Try again in a moment.");
  }
}

export const COPIED_STATUS: SaveDataStatus = { tone: "ok", text: "Code copied." };
export const COPY_FAILED_STATUS: SaveDataStatus = {
  tone: "error",
  text: "Couldn't copy to the clipboard. Read the code off the screen instead.",
};
export const JOINED_STATUS: SaveDataStatus = { tone: "ok", text: "Joined. Bringing your saves over…" };
export const UNLINKED_STATUS: SaveDataStatus = {
  tone: "ok",
  text: "This device no longer syncs. Its saves are untouched.",
};
export const DELETED_STATUS: SaveDataStatus = {
  tone: "ok",
  text: "Your cloud data is deleted and this device no longer syncs. Its saves are untouched.",
};

export { NO_STATUS };

// ---- the conflict prompt ---------------------------------------------------------------------------------------------

export interface ConflictSide {
  readonly heading: string;
  /** "Round 4, played 2 min ago" */
  readonly line: string;
  /** True for the side played more recently, said in words as well as drawn. */
  readonly newer: boolean;
}

export interface ConflictButton {
  readonly choice: ConflictChoice;
  readonly label: string;
  readonly detail: string;
}

export interface ConflictPrompt {
  readonly title: string;
  readonly body: string;
  readonly local: ConflictSide;
  readonly remote: ConflictSide;
  readonly buttons: readonly ConflictButton[];
  /** The button that has focus when the prompt opens: the one that loses nothing. */
  readonly defaultChoice: ConflictChoice;
  /** Why Keep both is missing, for a campaign game; null otherwise. */
  readonly campaignNote: string | null;
}

function sideOf(heading: string, side: GameConflict["local"], newer: boolean, now: number): ConflictSide {
  const played = side.updatedAt > 0 ? `played ${agoText(side.updatedAt, now)}` : "play time unknown";
  return { heading, line: `Round ${side.round}, ${played}`, newer };
}

/** What the prompt for one conflicted game says and offers. */
export function conflictPromptOf(conflict: GameConflict, now: number): ConflictPrompt {
  const localNewer = conflict.local.updatedAt > conflict.remote.updatedAt;
  const remoteNewer = conflict.remote.updatedAt > conflict.local.updatedAt;
  const buttons: ConflictButton[] = [
    { choice: "keep-local", label: "Keep this device", detail: "The other device's copy is replaced." },
    { choice: "keep-remote", label: "Keep the other device", detail: "This device's copy is replaced." },
  ];
  if (!conflict.campaign) {
    buttons.push({ choice: "keep-both", label: "Keep both", detail: "Both copies stay, as two saved games." });
  }
  return {
    title: "Which copy do you want to keep?",
    body: `${conflict.label} was played on two devices since they last synced, and the two games went different ways.`,
    local: sideOf("This device", conflict.local, localNewer, now),
    remote: sideOf("The other device", conflict.remote, remoteNewer, now),
    buttons,
    defaultChoice: conflict.campaign ? "keep-local" : "keep-both",
    campaignNote: conflict.campaign
      ? "Keep both isn't offered for a campaign game: a campaign mission counts one attempt at a time."
      : null,
  };
}
