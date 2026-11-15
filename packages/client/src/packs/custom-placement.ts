/**
 * Where installed packs' heroes and scenarios sit among the official ones (issue #734; the player's choice in Settings,
 * `packs/custom-content-prefs.ts`). Pure: `content/pool.ts` and the scenario list call these with what is loaded.
 */
import type { CustomPlacement } from "./custom-content-prefs.js";

/** One release-shelf entry (`view/roster-shelves.ts`'s `ShelfPack`, restated so this stays import-free). */
export interface PlacedShelfPack {
  readonly code: string;
  readonly cycleId: string;
  readonly cycleName: string;
  readonly cycleOrder: number;
  readonly releaseDate?: string;
}

/** The shelf every custom pack shares when it is not mixed in. */
export const CUSTOM_SHELF_ID = "custom-packs";
export const CUSTOM_SHELF_NAME = "Custom packs";

/** A loaded pack as the shelves see it: its id, the pack codes its decks carry and the wave it names, if any. */
export interface ShelvedPack {
  readonly id: string;
  readonly codes: readonly string[];
  readonly wave?: string;
}

/**
 * `official` (one entry per official pack, with its wave) plus an entry for each code of each custom pack: on a shared
 * "Custom packs" shelf after the last wave ("bottom") or before the first ("top"), or ("mixed") on the shelf of the wave
 * the pack names, after that wave's own packs. A pack mixed in that names no wave, or one the game does not know, goes
 * on the bottom shelf.
 */
export function placeHeroShelfPacks(
  official: readonly PlacedShelfPack[],
  packs: readonly ShelvedPack[],
  placement: CustomPlacement,
): readonly PlacedShelfPack[] {
  if (packs.length === 0) return official;
  const orders = official.map((pack) => pack.cycleOrder);
  const last = Math.max(0, ...orders) + 1;
  const first = Math.min(0, ...orders) - 1;
  const ownShelf = (code: string): PlacedShelfPack => ({
    code,
    cycleId: CUSTOM_SHELF_ID,
    cycleName: CUSTOM_SHELF_NAME,
    cycleOrder: placement === "top" ? first : last,
  });
  return [
    ...official,
    ...packs.flatMap((pack) => {
      const wave = placement === "mixed" && pack.wave ? official.find((one) => one.cycleId === pack.wave) : undefined;
      return [...new Set([pack.id, ...pack.codes])].map((code): PlacedShelfPack =>
        wave
          ? // After every official pack of the wave: a release date no official pack has.
            { code, cycleId: wave.cycleId, cycleName: wave.cycleName, cycleOrder: wave.cycleOrder, releaseDate: "9999" }
          : ownShelf(code),
      );
    }),
  ];
}

/**
 * The scenario list's shelves, in order, and which shelf a pack scenario goes on. Scenario shelves are per official
 * product: a pack's scenario mixed in goes on the last product of the wave it names; otherwise on "Custom packs", first
 * or last.
 */
export function placeScenarioShelves(
  officialPacks: readonly { readonly code: string; readonly cycleId: string }[],
  placement: CustomPlacement,
): {
  readonly order: readonly string[];
  readonly shelfOf: (wave: string | undefined) => string;
} {
  const codes = officialPacks.map((pack) => pack.code);
  const order = placement === "top" ? [CUSTOM_SHELF_ID, ...codes] : [...codes, CUSTOM_SHELF_ID];
  const lastOfWave = new Map<string, string>();
  for (const pack of officialPacks) lastOfWave.set(pack.cycleId, pack.code);
  return {
    order,
    shelfOf: (wave) => (placement === "mixed" && wave ? (lastOfWave.get(wave) ?? CUSTOM_SHELF_ID) : CUSTOM_SHELF_ID),
  };
}
