import type { SessionConfig } from "../engine/host.js";
import type { SetupHouseRule } from "../view/setup-options.js";
import { loadedPacks } from "./pack-registry.js";
import {
  packEnablingMode,
  packsOwningContent,
  packsUsedBySeats,
  setupHouseRules,
  withRequiredPacks,
} from "./pack-runtime.js";

/**
 * `config` with the loaded packs its seats draw on, and every pack those need (`requires.packs`), attached as
 * `SessionConfig.packs`: how a pack reaches the engine worker. Whatever `packs` the config carried is dropped and
 * re-attached from what is loaded now, so Play Again and any other new game get the installed version, not the old
 * game's copy (`resume` and `rewindTo` never come through here: they keep the stored packs). The exception is a
 * campaign node: its config carries the run's own embedded packs (`CampaignService.launchConfig`), and those win, so an
 * update or removal of the pack never changes a run. A config that uses no pack carries none, so a base-game game's
 * config and saves are exactly what they were.
 *
 * The house rules the setup switched on (`SessionConfig.houseRules`, docs/custom-content-packs.md §11.11) ride the same
 * way: each one still installed and loaded is embedded, and `houseRules` keeps only those, so the save says what the
 * game was played with and a resume needs nothing installed.
 */
export function withLoadedPacks(config: SessionConfig): SessionConfig {
  // A campaign node keeps the packs its run carries.
  if (config.campaign && (config.packs?.length ?? 0) > 0) return config;
  const { packs: _old, houseRules: chosen, ...rest } = config;
  const loaded = loadedPacks();
  const rules = setupHouseRules(loaded).filter((pack) => chosen?.includes(pack.id));
  // The seats' packs, and the packs that own the chosen scenario or any chosen modular set (a base scenario with a
  // pack's modular set carries that pack too), so a save, a rewind and a replay need nothing installed.
  const owners = packsOwningContent(
    config.scenarioId,
    [...(config.modularSetIds ?? []), ...(config.extraModularSetIds ?? [])],
    loaded,
  );
  const wanted = new Set([...packsUsedBySeats(config.players, loaded), ...owners]);
  for (const rule of rules) wanted.add(rule);
  const used = withRequiredPacks(
    loaded.filter((pack) => wanted.has(pack)),
    loaded,
  );
  const withRules = rules.length > 0 ? { ...rest, houseRules: rules.map((pack) => pack.id) } : rest;
  return used.length > 0 ? { ...withRules, packs: used } : withRules;
}

/** The installed house rules Table setup offers as toggles (`setupHouseRules`): loaded packs that add traits. */
export function installedSetupHouseRules(): readonly SetupHouseRule[] {
  return setupHouseRules(loadedPacks()).map((pack) => ({
    id: pack.id,
    name: pack.name,
    description: pack.houseRule?.description ?? "",
  }));
}

/** Whether a house-rule pack that enables the Balanced campaign option (GMW Fixes) is installed and loaded. */
export function balancedModInstalled(): boolean {
  return packEnablingMode(loadedPacks(), "balanced") !== undefined;
}
