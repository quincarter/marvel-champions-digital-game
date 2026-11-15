/**
 * Past games' Share, Export and Log (issue #706), apart from the scene so their order of steps can be tested. Each one
 * opens the stored game in a replay worker of its own, writes what it needs and closes it again.
 *
 * `current` says whether the screen that started the action is still the one showing. It is asked after every wait,
 * before anything that leaves the screen: an upload, the system's save dialog or share sheet. An action whose screen
 * has gone (the player pressed Back while the worker was opening) closes its worker and does nothing more.
 */
import { partialLogStop } from "../view/past-games-model.js";
import type { ReplayHost } from "./replay-host.js";
import type { ShareLinkResult } from "./replay-share.js";

export interface PastGameActionDeps {
  readonly open: (gameId: string) => Promise<ReplayHost>;
  readonly current: () => boolean;
  readonly deliverFile: (bytes: Uint8Array, name: string) => Promise<void>;
  readonly deliverLog: (text: string, name: string) => Promise<void>;
  readonly shareLink: (bytes: Uint8Array) => Promise<ShareLinkResult>;
}

/** How an Export or Log went: handed out (a log noting where it stops short), or dropped because the screen moved on. */
export type ExportOutcome =
  | { readonly kind: "delivered"; readonly stopsAt: number | null }
  | { readonly kind: "stale" };

export async function exportPastGame(
  gameId: string,
  what: "export" | "log",
  deps: PastGameActionDeps,
): Promise<ExportOutcome> {
  let host: ReplayHost | null = null;
  try {
    host = await deps.open(gameId);
    if (!deps.current()) return { kind: "stale" };
    if (what === "export") {
      const { bytes, name } = await host.exportFile();
      host.dispose();
      host = null;
      if (!deps.current()) return { kind: "stale" };
      await deps.deliverFile(bytes, name);
      return { kind: "delivered", stopsAt: null };
    }
    const { text, name } = await host.exportLog();
    // A game this build can't play to its end writes a log that stops where it does: the screen says so.
    const stopsAt = partialLogStop(host.info);
    host.dispose();
    host = null;
    if (!deps.current()) return { kind: "stale" };
    await deps.deliverLog(text, name);
    return { kind: "delivered", stopsAt };
  } finally {
    host?.dispose();
  }
}

/** How a Share went: a link to hand out, a refusal from the replay service, or dropped because the screen moved on. */
export type ShareOutcome = ShareLinkResult | { readonly ok: "stale" };

export async function sharePastGame(gameId: string, deps: PastGameActionDeps): Promise<ShareOutcome> {
  let host: ReplayHost | null = null;
  try {
    host = await deps.open(gameId);
    if (!deps.current()) return { ok: "stale" };
    const { bytes } = await host.exportFile();
    host.dispose();
    host = null;
    if (!deps.current()) return { ok: "stale" };
    return await deps.shareLink(bytes);
  } finally {
    host?.dispose();
  }
}
