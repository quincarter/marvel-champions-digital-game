/**
 * Device sync's screens, as plain decisions (issue #276, step 2): which step Save data ▸ Sync across devices is on, the
 * wording of every outcome and failure, the recovery code as shown, the link a QR code carries, and the conflict
 * prompt's text and buttons. `scenes/sync-data.ts` and `scenes/sync-conflict.ts` draw these; `sync/sync-service.ts`
 * does the work.
 */
import { t } from "../i18n/translate.js";
import { formatRecoveryCode, parseRecoveryCode } from "@mc/sync-worker/sync-protocol";
import type { TransferFailure } from "../save-data/transfer-client.js";
import { linkFragmentOf, type SyncLinkAddress } from "../sync/sync-link.js";
import type { SyncServiceFailure } from "../sync/sync-service.js";
import { agoText, statusLine, type SyncStatus } from "../sync/sync-status.js";
import type { ConflictChoice, GameConflict } from "../sync/sync-types.js";
import { NO_STATUS, type SaveDataStatus } from "./save-data-model.js";

/** Emitted on the game's event bus when the conflict prompt closes, so the watcher can open the next game's. */
export const CONFLICT_CLOSED = "mc-sync-conflict-closed";

export const syncRowTitle = (): string => t("sync.syncRowTitle");
export const syncRowDetail = (): string => t("sync.syncRowDetail");

/** The sync screen's steps. `home` is the status and the actions (which ones depend on whether sync is on). */
export type SyncStep =
  | { readonly kind: "home" }
  /** "creating" while the space is made; then the code, until the player says they have saved it. */
  | {
      readonly kind: "setup";
      /** `copied`: Copy code worked, which counts as saving it (the ✕ and Escape unlock). */
      readonly phase: "creating" | { readonly code: string; readonly copied?: boolean };
    }
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

/**
 * A step Escape or the ✕ may not leave: the recovery code was shown once and the player has neither said they saved it
 * nor copied it. `setupLockNotice()` says so on the screen.
 */
export function syncStepMustAcknowledge(step: SyncStep): boolean {
  return step.kind === "setup" && typeof step.phase === "object" && step.phase.copied !== true;
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

export const unavailableText = (): string => t("sync.unavailableText");

export const syncOffIntro = (): string => t("sync.syncOffIntro");
export const syncOnIntro = (): string => t("sync.syncOnIntro");
export const setupHelp = (): string => t("sync.setupHelp");
/** Under the new recovery code while the ✕ is locked, so the screen doesn't read as one that can't be closed. */
export const setupLockNotice = (): string => t("sync.setupLockNotice");
export const showCodeHelp = (): string => t("sync.showCodeHelp");
export const linkHelp = (): string => t("sync.linkHelp");
export const linkTypeHelp = (): string => t("sync.linkTypeHelp");
export const joinHelp = (): string => t("sync.joinHelp");
export const joinLinkTitle = (): string => t("sync.joinLinkTitle");
export const joinLinkBody = (): string => t("sync.joinLinkBody");
export const joinLinkSwitchBody = (): string => t("sync.joinLinkSwitchBody");
export const unlinkTitle = (): string => t("sync.unlinkTitle");
export const unlinkBody = (): string => t("sync.unlinkBody");

/** The status line as shown on both Save data and the sync screen: a linked device is starting, not off, before its first run. */
export function syncStatusDisplay(linked: boolean, status: SyncStatus, now: number): string {
  return linked && status.state === "off" ? t("sync.starting") : syncStatusText(status, now);
}

export const deleteTitle = (): string => t("sync.deleteTitle");
export const deleteBody = (): string => t("sync.deleteBody");

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
      return t("sync.link.notFound");
    case "unavailable":
      return unavailableText();
    case "unsupported":
      return t("sync.unsupported");
    case "rate-limited":
      return t("sync.rateLimited");
    case "blocked":
      return t("sync.link.blocked");
    case "too-large":
      return t("sync.link.tooLarge");
    case "damaged":
      return t("sync.link.damaged", { detail: failure.detail });
  }
}

/** The sentence for a failed sync action; always read with the word "Problem:" in front by the scene. */
export function syncFailureStatusOf(failure: SyncServiceFailure): SaveDataStatus {
  const error = (text: string): SaveDataStatus => ({ tone: "error", text });
  switch (failure.kind) {
    case "unavailable":
      return error(unavailableText());
    case "unsupported":
      return error(t("sync.unsupported"));
    case "wrong-code":
    case "not-found":
      return error(t("sync.wrongCode"));
    case "invalid-code":
      return error(t("sync.invalidCode"));
    case "rate-limited":
      return error(t("sync.rateLimited"));
    case "blocked":
      return error(t("sync.blocked"));
    case "space-full":
      return error(t("sync.spaceFull"));
    case "too-large":
      return error(t("sync.tooLarge"));
    case "storage":
      return error(t("sync.storage"));
    case "link":
      return error(linkFailureText(failure.failure));
    case "not-on":
      return error(t("sync.notOn"));
    case "error":
      // The detail is for the log, never for the player.
      console.warn("device sync:", failure.message);
      return error(t("sync.error"));
  }
}

export const COPIED_STATUS: SaveDataStatus = {
  tone: "ok",
  get text() {
    return t("sync.copied");
  },
};
export const COPY_FAILED_STATUS: SaveDataStatus = {
  tone: "error",
  get text() {
    return t("sync.copyFailed");
  },
};
export const JOINED_STATUS: SaveDataStatus = {
  tone: "ok",
  get text() {
    return t("sync.joined");
  },
};
export const UNLINKED_STATUS: SaveDataStatus = {
  tone: "ok",
  get text() {
    return t("sync.unlinked");
  },
};
export const DELETED_STATUS: SaveDataStatus = {
  tone: "ok",
  get text() {
    return t("sync.deleted");
  },
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
  const played =
    side.updatedAt > 0 ? t("sync.conflict.played", { ago: agoText(side.updatedAt, now) }) : t("sync.conflict.unknown");
  return { heading, line: t("sync.conflict.line", { round: side.round, played }), newer };
}

/** What the prompt for one conflicted game says and offers. */
export function conflictPromptOf(conflict: GameConflict, now: number): ConflictPrompt {
  const localNewer = conflict.local.updatedAt > conflict.remote.updatedAt;
  const remoteNewer = conflict.remote.updatedAt > conflict.local.updatedAt;
  const buttons: ConflictButton[] = [
    { choice: "keep-local", label: t("sync.conflict.keepLocal"), detail: t("sync.conflict.keepLocalDetail") },
    { choice: "keep-remote", label: t("sync.conflict.keepRemote"), detail: t("sync.conflict.keepRemoteDetail") },
  ];
  if (!conflict.campaign) {
    buttons.push({
      choice: "keep-both",
      label: t("sync.conflict.keepBoth"),
      detail: t("sync.conflict.keepBothDetail"),
    });
  }
  return {
    title: t("sync.conflict.title"),
    body: t("sync.conflict.body", { label: conflict.label }),
    local: sideOf(t("sync.conflict.thisDevice"), conflict.local, localNewer, now),
    remote: sideOf(t("sync.conflict.otherDevice"), conflict.remote, remoteNewer, now),
    buttons,
    defaultChoice: conflict.campaign ? "keep-local" : "keep-both",
    campaignNote: conflict.campaign ? t("sync.conflict.campaignNote") : null,
  };
}
