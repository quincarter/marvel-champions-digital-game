/**
 * Opening a shared replay's link (issue #858): the `#replay=<id>` read at startup, fetched and opened into a
 * `ReplayHost`, or the line that says why it couldn't be. Boot shows the loading screen while this runs
 * (`ui/replay-link-loading.ts`), so a link never lands on the title menu first.
 */
import type { MessageKey } from "../i18n/translate.js";
import { fetchReplay, type ReplayLinkFailure, type ReplayLinkResult } from "./replay-link.js";
import { openReplay, replayErrorKey } from "./replay-files.js";
import type { ReplayHost } from "./replay-host.js";
import { startupPacksLoaded, startupPacksPending } from "../packs/startup-packs.js";

export type SharedReplayResult =
  | { readonly ok: true; readonly host: ReplayHost }
  | { readonly ok: false; readonly message: MessageKey };

export interface SharedReplayDeps {
  readonly fetch: (id: string) => Promise<ReplayLinkResult<Uint8Array>>;
  readonly open: (bytes: Uint8Array) => Promise<ReplayHost>;
  /** True while the installed packs are still loading. */
  readonly packsPending: () => boolean;
  /** Settles once they have loaded: a replay that uses one is refused as missing it until then. */
  readonly packsLoaded: () => Promise<void>;
}

const defaultDeps: SharedReplayDeps = {
  fetch: (id) => fetchReplay(id),
  open: (bytes) => openReplay({ kind: "file", bytes }),
  packsPending: startupPacksPending,
  packsLoaded: startupPacksLoaded,
};

/** What to tell the player when a shared replay couldn't be fetched. */
export function replayLinkFailureKey(failure: ReplayLinkFailure): MessageKey {
  return failure === "not-found" ? "replay.link.gone" : "replay.link.offline";
}

/**
 * Fetches and opens the shared replay `id` (`"invalid"`: the link named none). Never throws. `onLoadingMods` is called
 * when the file is in but the installed mod packs are still loading, so the screen can say what it is waiting for.
 */
export async function loadSharedReplay(
  id: string | "invalid",
  deps: SharedReplayDeps = defaultDeps,
  onLoadingMods: () => void = () => undefined,
): Promise<SharedReplayResult> {
  if (id === "invalid") return { ok: false, message: "replay.link.invalid" };
  let fetched: ReplayLinkResult<Uint8Array>;
  try {
    fetched = await deps.fetch(id);
  } catch {
    fetched = { ok: false, failure: "unavailable" };
  }
  if (!fetched.ok) return { ok: false, message: replayLinkFailureKey(fetched.failure) };
  if (deps.packsPending()) {
    onLoadingMods();
    await deps.packsLoaded();
  }
  try {
    return { ok: true, host: await deps.open(fetched.value) };
  } catch (cause) {
    return { ok: false, message: replayErrorKey(cause) };
  }
}
