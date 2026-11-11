import type { SessionConfig } from "../engine/host.js";
import { loadedPacks } from "./pack-registry.js";
import { packsOwningContent, packsUsedBySeats, withRequiredPacks } from "./pack-runtime.js";

/**
 * `config` with the loaded packs its seats draw on, and every pack those need (`requires.packs`), attached as
 * `SessionConfig.packs`: how a pack reaches the engine worker. Whatever `packs` the config carried is dropped and
 * re-attached from what is loaded now, so Play Again and any other new game get the installed version, not the old
 * game's copy (`resume` and `rewindTo` never come through here: they keep the stored packs). The exception is a
 * campaign node: its config carries the run's own embedded packs (`CampaignService.launchConfig`), and those win, so an
 * update or removal of the pack never changes a run. A config that uses no pack carries none, so a base-game game's
 * config and saves are exactly what they were.
 */
export function withLoadedPacks(config: SessionConfig): SessionConfig {
  // A campaign node keeps the packs its run carries.
  if (config.campaign && (config.packs?.length ?? 0) > 0) return config;
  const { packs: _old, ...rest } = config;
  const loaded = loadedPacks();
  // The seats' packs, and the packs that own the chosen scenario or any chosen modular set (a base scenario with a
  // pack's modular set carries that pack too), so a save, a rewind and a replay need nothing installed.
  const owners = packsOwningContent(
    config.scenarioId,
    [...(config.modularSetIds ?? []), ...(config.extraModularSetIds ?? [])],
    loaded,
  );
  const wanted = new Set([...packsUsedBySeats(config.players, loaded), ...owners]);
  const used = withRequiredPacks(
    loaded.filter((pack) => wanted.has(pack)),
    loaded,
  );
  return used.length > 0 ? { ...rest, packs: used } : rest;
}
