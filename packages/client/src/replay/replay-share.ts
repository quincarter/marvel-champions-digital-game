/**
 * Sharing a replay as a link (issue #693), for every screen that offers it: the replay transport over the board and the
 * Past games catalog (#706). The upload and the link are `replay-link.ts`'s; this hands the link out (the system share
 * sheet where there is one, else the clipboard) and words what went wrong.
 */
import type { MessageKey } from "../i18n/translate.js";
import { replayLinkOf, uploadReplay, type ReplayLinkDeps, type ReplayLinkFailure } from "./replay-link.js";

/** Whether `cause` is the player closing a dialog or a share sheet: never a failure to report. */
export function isAbort(cause: unknown): boolean {
  return typeof cause === "object" && cause !== null && (cause as { name?: unknown }).name === "AbortError";
}

/** The message that says why a share made no link. */
export function shareFailureKey(failure: ReplayLinkFailure): MessageKey {
  switch (failure) {
    case "full":
      return "replay.link.full";
    case "rate-limited":
      return "replay.link.rateLimited";
    case "too-large":
      return "replay.link.tooLarge";
    case "not-found":
      return "replay.link.gone";
    case "unavailable":
      return "replay.link.offline";
  }
}

export type ShareLinkResult =
  | { readonly ok: true; readonly url: string }
  | { readonly ok: false; readonly failure: ReplayLinkFailure };

/**
 * Uploads a replay file's bytes and answers the link that opens it. `native`: the desktop and phone apps, whose links
 * go to the web version.
 */
export async function shareLinkOf(bytes: Uint8Array, native: boolean, deps?: ReplayLinkDeps): Promise<ShareLinkResult> {
  const uploaded = await uploadReplay(bytes, deps);
  if (!uploaded.ok) return uploaded;
  return { ok: true, url: replayLinkOf(uploaded.value, native) };
}

/** How a link was handed out: the share sheet took it (or was closed), it was copied, or nothing would take it. */
export type LinkDelivery = "shared" | "copied" | "manual";

export interface LinkOutlets {
  readonly share?: (data: ShareData) => Promise<void>;
  readonly copy: (text: string) => Promise<void>;
}

const browserOutlets = (): LinkOutlets => ({
  ...(typeof navigator.share === "function" ? { share: (data: ShareData) => navigator.share(data) } : {}),
  copy: (text) => navigator.clipboard.writeText(text),
});

/**
 * Hands a link out: the share sheet where there is one (closing it counts as handled), else the clipboard. A browser
 * that refuses both (iOS, once the press is too old after the upload) answers "manual": the screen shows the link to
 * read, and pressing Share again tries again with it.
 */
export async function deliverReplayLink(
  url: string,
  title: string,
  outlets: LinkOutlets = browserOutlets(),
): Promise<LinkDelivery> {
  if (outlets.share) {
    try {
      await outlets.share({ url, title });
      return "shared";
    } catch (cause) {
      if (isAbort(cause)) return "shared";
    }
  }
  try {
    await outlets.copy(url);
    return "copied";
  } catch {
    return "manual";
  }
}
