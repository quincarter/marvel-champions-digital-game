/**
 * Opening a live game from its watch link (issue #876): the room joined and its game opened into a `ReplayHost` that
 * follows it, or the line that says why it could not be. Boot shows the same loading screen as for a shared replay
 * while this runs (`ui/replay-link-loading.ts`), so a link never lands on the title menu first.
 */
import type { MessageKey } from "../i18n/translate.js";
import { loadedPacks } from "../packs/pack-registry.js";
import { startupPacksLoaded, startupPacksPending } from "../packs/startup-packs.js";
import { ReplayOpenError } from "../replay/replay-core.js";
import { parseWatchTarget } from "./watch-link.js";
import { replayErrorKey } from "../replay/replay-files.js";
import { ReplayHost, WorkerReplayBackend } from "../replay/replay-host.js";
import type { SharedReplayResult } from "../replay/shared-replay.js";
import { FIRST_TABLE } from "@mc/sync-worker/room-protocol";
import { syncServiceUrl } from "../save-data/transfer-config.js";
import { appSession } from "../session.js";

export interface WatchOpenDeps {
  /** The sync service's address, null when this build has none. */
  readonly syncUrl: string | null;
  /** `table`: the table the link names (#1021); the first table when absent. */
  readonly open: (roomId: string, syncUrl: string, table?: string) => Promise<ReplayHost>;
  readonly packsPending: () => boolean;
  readonly packsLoaded: () => Promise<void>;
}

const defaultDeps: WatchOpenDeps = {
  syncUrl: syncServiceUrl(),
  open: async (roomId, syncUrl, table) => {
    const host = new ReplayHost(new WorkerReplayBackend());
    try {
      // The viewer's online name, so a room game's lobby lists them by it (#1021); none set, the room gives a stand-in.
      const name = appSession().settings.onlineName.trim();
      await host.watch(roomId, syncUrl, loadedPacks(), undefined, false, undefined, {
        ...(name ? { name } : {}),
        ...(table ? { table } : {}),
      });
      return host;
    } catch (cause) {
      host.dispose();
      throw cause;
    }
  },
  packsPending: startupPacksPending,
  packsLoaded: startupPacksLoaded,
};

/** What to tell the player when a live game could not be opened. */
export function watchFailureKey(cause: unknown): MessageKey {
  if (cause instanceof ReplayOpenError && cause.code === "missing") return "watch.link.gone";
  if (cause instanceof ReplayOpenError && cause.code === "full") return "watch.link.full";
  return replayErrorKey(cause);
}

/**
 * Joins room `id` (`"invalid"`: the link named none; `<roomId>.<table>` names an Epic room's table) and opens its game. Never throws. The game's packs are the
 * viewer's installed ones, so the installed packs are waited for first (`onLoadingMods` says the screen is waiting).
 */
export async function loadLiveWatch(
  id: string | "invalid",
  deps: WatchOpenDeps = defaultDeps,
  onLoadingMods: () => void = () => undefined,
): Promise<SharedReplayResult> {
  const target = id === "invalid" ? null : parseWatchTarget(id);
  if (!target) return { ok: false, message: "replay.link.invalid" };
  if (!deps.syncUrl) return { ok: false, message: "replay.link.offline" };
  if (deps.packsPending()) {
    onLoadingMods();
    await deps.packsLoaded();
  }
  try {
    const table = target.table === FIRST_TABLE ? undefined : target.table;
    return { ok: true, host: await deps.open(target.roomId, deps.syncUrl, table) };
  } catch (cause) {
    return { ok: false, message: watchFailureKey(cause) };
  }
}
