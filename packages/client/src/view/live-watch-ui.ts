/**
 * What the player sees of a live room (issue #876): the watcher badge on the board's top bar and "Copy watch link" in
 * the pause menu. Plain functions over the live-room worker's status (`live/live-publisher.ts`'s `LiveStatus`), so the
 * scenes only draw what these say.
 */
import { t } from "../i18n/translate.js";
import type { LiveStatus } from "../live/live-publisher.js";

export interface WatchBadge {
  readonly count: number;
  /** The words for the badge's accessible name and tooltip: "3 watching". */
  readonly label: string;
}

/**
 * The top bar's watch control: there whenever a watch link exists (an eye, so it can be pressed to share the link), with
 * the number beside it once anyone is watching. The eye and the number are drawn; no colour carries it.
 */
export function watchBadgeOf(status: LiveStatus): WatchBadge | null {
  if (!status.watchUrl) return null;
  return {
    count: status.watchers,
    label: status.watchers > 0 ? t("live.badge", { count: status.watchers }) : t("live.watchBadge"),
  };
}

/** What the control said after a press: the line for the toast, or null when the share sheet took it. */
export type WatchShareOutcome = "shared" | "copied" | "manual";

export function watchToastOf(outcome: WatchShareOutcome, url: string): string | null {
  if (outcome === "shared") return null;
  return outcome === "copied" ? t("live.toastCopied") : `${t("replay.link.manual")} ${url}`;
}

/** The watch link to offer in the pause menu while the room is open, else null (the item is not drawn). */
export function pauseWatchLinkOf(status: LiveStatus): string | null {
  return status.watchUrl;
}

/** The pause item's words: its own, or "Link copied" for a moment after a copy. `short` is for a phone's compact cell. */
export function watchLinkLabelOf(copied: boolean, short: boolean): string {
  if (copied) return t("live.linkCopied");
  return t(short ? "live.copyLinkShort" : "live.copyLink");
}

/** Copies `url`; false when the browser refuses (the pause menu then has nothing to say it copied). */
export async function copyWatchLink(
  url: string,
  copy: (text: string) => Promise<void> = (text) => navigator.clipboard.writeText(text),
): Promise<boolean> {
  try {
    await copy(url);
    return true;
  } catch {
    return false;
  }
}
