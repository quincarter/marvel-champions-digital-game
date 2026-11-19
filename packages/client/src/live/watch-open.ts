/**
 * Opening a live game from its watch link (issue #876): the room joined and its game opened into a `ReplayHost` that
 * follows it, or the line that says why it could not be. Boot shows the same loading screen as for a shared replay
 * while this runs (`ui/replay-link-loading.ts`), so a link never lands on the title menu first.
 */
import type { MessageKey } from "../i18n/translate.js";
import { loadedPacks } from "../packs/pack-registry.js";
import { startupPacksLoaded, startupPacksPending } from "../packs/startup-packs.js";
import { ReplayOpenError } from "../replay/replay-core.js";
import { replayErrorKey } from "../replay/replay-files.js";
import { ReplayHost, WorkerReplayBackend } from "../replay/replay-host.js";
import type { SharedReplayResult } from "../replay/shared-replay.js";
import { syncServiceUrl } from "../save-data/transfer-config.js";

export interface WatchOpenDeps {
  /** The sync service's address, null when this build has none. */
  readonly syncUrl: string | null;
  readonly open: (roomId: string, syncUrl: string) => Promise<ReplayHost>;
  readonly packsPending: () => boolean;
  readonly packsLoaded: () => Promise<void>;
}

const defaultDeps: WatchOpenDeps = {
  syncUrl: syncServiceUrl(),
  open: async (roomId, syncUrl) => {
    const host = new ReplayHost(new WorkerReplayBackend());
    try {
      await host.watch(roomId, syncUrl, loadedPacks());
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
  return cause instanceof ReplayOpenError && cause.code === "missing" ? "watch.link.gone" : replayErrorKey(cause);
}

/**
 * Joins room `id` (`"invalid"`: the link named none) and opens its game. Never throws. The game's packs are the
 * viewer's installed ones, so the installed packs are waited for first (`onLoadingMods` says the screen is waiting).
 */
export async function loadLiveWatch(
  id: string | "invalid",
  deps: WatchOpenDeps = defaultDeps,
  onLoadingMods: () => void = () => undefined,
): Promise<SharedReplayResult> {
  if (id === "invalid") return { ok: false, message: "replay.link.invalid" };
  if (!deps.syncUrl) return { ok: false, message: "replay.link.offline" };
  if (deps.packsPending()) {
    onLoadingMods();
    await deps.packsLoaded();
  }
  try {
    return { ok: true, host: await deps.open(id, deps.syncUrl) };
  } catch (cause) {
    return { ok: false, message: watchFailureKey(cause) };
  }
}
