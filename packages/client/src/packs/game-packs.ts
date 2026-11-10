import type { SessionConfig } from "../engine/host.js";
import { loadedPacks } from "./pack-registry.js";
import { packsUsedBySeats, withRequiredPacks } from "./pack-runtime.js";

/**
 * `config` with the loaded packs its seats draw on, and every pack those need (`requires.packs`), attached as
 * `SessionConfig.packs`: how a pack reaches the engine worker. Whatever `packs` the config carried is dropped and
 * re-attached from what is loaded now, so Play Again and any other new game get the installed version, not the old
 * game's copy (`resume` and `rewindTo` never come through here: they keep the stored packs). A config that uses no pack
 * carries none, so a base-game game's config and saves are exactly what they were.
 */
export function withLoadedPacks(config: SessionConfig): SessionConfig {
  const { packs: _old, ...rest } = config;
  const loaded = loadedPacks();
  const used = withRequiredPacks(packsUsedBySeats(config.players, loaded), loaded);
  return used.length > 0 ? { ...rest, packs: used } : rest;
}
