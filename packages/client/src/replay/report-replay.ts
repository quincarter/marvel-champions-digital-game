/**
 * A bug report's replay link (issue #693): the game on the table, shared as a replay (`replay-link.ts`), so whoever
 * reads the report can watch exactly what the reporter saw. The Report panel asks for it as it opens, and the link goes
 * into the copied and downloaded log and into the new issue's Game details.
 *
 * One upload per game position: asking again with nothing played since gives the same link, so opening the panel twice
 * spends one of the day's shared replays, not two. A failure (no service, the day's cap reached) gives null, and the
 * report goes on without a link.
 */
import type { SessionStore } from "../store/session-store.js";
import { detectPlatform } from "../platform/platform.js";
import type { GameState } from "@mc/engine";
import { openReplay } from "./replay-files.js";
import { replayLinkOf, uploadReplay } from "./replay-link.js";

let cached: { readonly key: string; readonly link: Promise<string | null> } | null = null;

/** How long a report waits for its link before going on without one. */
export const REPORT_LINK_WAIT_MS = 10_000;

/** The shared replay link of the game `store` holds, or null when there is no game or it could not be shared. */
export function reportReplayLink(store: SessionStore): Promise<string | null> {
  const { game, config, version, gameId } = store.state;
  if (!game || !config) return Promise.resolve(null);
  const key = `${gameId ?? config.seed}:${version}`;
  if (cached?.key === key) return cached.link;
  const link = shareGame(store, game.outcome ?? null, game.round).catch(() => null);
  cached = { key, link };
  return link;
}

async function shareGame(
  store: SessionStore,
  outcome: GameState["outcome"] | null,
  round: number,
): Promise<string | null> {
  const config = store.state.config;
  if (!config) return null;
  const { initialState, commands } = await store.save();
  const { cardPool: _pool, ...baseline } = initialState as GameState;
  const host = await openReplay({
    kind: "log",
    log: { config, initialState: baseline, commands, createdAt: Date.now(), outcome: outcome ?? null, round },
  });
  try {
    const { bytes } = await host.exportFile();
    const uploaded = await uploadReplay(bytes);
    return uploaded.ok ? replayLinkOf(uploaded.value, detectPlatform() !== "web") : null;
  } finally {
    host.dispose();
  }
}

/** `link`, or null once `ms` has passed without it. */
export function withinTime<T>(link: Promise<T | null>, ms: number = REPORT_LINK_WAIT_MS): Promise<T | null> {
  return Promise.race([link, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);
}
