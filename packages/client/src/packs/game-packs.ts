import type { SessionConfig } from "../engine/host.js";
import { loadedPacks } from "./pack-registry.js";
import { packsUsedBySeats } from "./pack-runtime.js";

/**
 * `config` with the loaded packs its seats draw on attached (`SessionConfig.packs`), which is how a pack reaches the
 * engine worker. A config that already names packs (a replay, a "play again") is left alone, and so is one that uses
 * none, so a base-game game's config and saves are exactly what they were.
 */
export function withLoadedPacks(config: SessionConfig): SessionConfig {
  if (config.packs) return config;
  const used = packsUsedBySeats(config.players, loadedPacks());
  return used.length > 0 ? { ...config, packs: used } : config;
}
