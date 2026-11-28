/** Where each scenario is shelved and which shelves a search, a chip and the player's folds leave showing. */
import type { Scenario } from "@mc/content";
import { CUSTOM_SHELF_ID, POOL_PACKS, currentScenarios, isPackScenario, packNameOf } from "../../content/pool.js";
import { t } from "../../i18n/translate.js";
import { placeScenarioShelves } from "../../packs/custom-placement.js";
import { customContentPrefsNow } from "../../packs/custom-content-prefs.js";
import { loadedPacks } from "../../packs/pack-registry.js";
import { shelvesWithBuilderTile, type RosterEntry } from "../../view/civil-war-entry.js";
import { rankShelvesByScore } from "../../view/deck-search.js";
import { scenarioProductsOf, withSelectionPinned } from "../../view/roster-filter.js";
import { shelvesOf, type Shelf, type ShelfCandidate } from "../../view/roster-shelves.js";
import { foldShelves } from "../../view/shelf-folds.js";
import type { ScenarioChip } from "../../components/scenario-select/mc-scenario-chips/mc-scenario-chips.types.js";

/**
 * Where each scenario is shelved: installed packs' scenarios on a "custom packs" shelf first or last, or beside the wave
 * the pack names (issue #734). The product chips are these shelves too (issue #966).
 */
export function placementOf(): { readonly order: readonly string[]; readonly shelfOf: (scenario: Scenario) => string } {
  const placed = placeScenarioShelves(
    POOL_PACKS.map((p) => ({ code: p.code as string, cycleId: p.cycleId as string })),
    customContentPrefsNow().placement,
  );
  const packWaves = new Map(
    loadedPacks().flatMap((pack) => (pack.scenarios ?? []).map((one) => [one.id as string, pack.wave] as const)),
  );
  return {
    order: placed.order,
    shelfOf: (scenario) =>
      isPackScenario(scenario.id as string)
        ? placed.shelfOf(packWaves.get(scenario.id as string))
        : (scenario.packCode as string),
  };
}

export interface RosterInput {
  /** The text search's last answer (id to score), or null when no search is active. */
  readonly ranking: ReadonlyMap<string, number> | null;
  /** The chosen product chip's pack code, or null. */
  readonly product: string | null;
  /** The picked scenario's id (kept in the list even when a filter would hide it), or null. */
  readonly pickedId: string | null;
  readonly folded: ReadonlySet<string>;
}

export function rosterShelvesOf(input: RosterInput): readonly Shelf<RosterEntry>[] {
  const { ranking, product, pickedId, folded } = input;
  const placed = placementOf();
  const candidates: ShelfCandidate<Scenario>[] = withSelectionPinned(
    currentScenarios(),
    () => true,
    (s) => pickedId === (s.id as string),
  ).map((s) => {
    const shelf = placed.shelfOf(s);
    return {
      item: s,
      packCode: shelf,
      searchHaystacks: [],
      passesChips: (!product || shelf === product) && (ranking === null || ranking.has(s.id as string)),
    };
  });
  const shelves = shelvesOf(
    candidates,
    placed.order,
    (code) => (code === CUSTOM_SHELF_ID ? t("scenario.customPacks") : packNameOf(code)),
    "",
  );
  // A search puts the best match first, within each shelf and among the shelves.
  const ordered = shelvesWithBuilderTile(
    ranking ? rankShelvesByScore(shelves, (s) => ranking.get(s.id as string) ?? 0) : shelves,
  );
  // The shelves the player folded show as their header alone (#753), unless a search or chip is narrowing the list.
  return foldShelves(ordered, folded, ranking !== null || !!product);
}

/** The product chips: one per pack (and the custom packs), a chosen one leading with a check. */
export function chipsOf(product: string | null): readonly ScenarioChip[] {
  const placed = placementOf();
  return scenarioProductsOf(currentScenarios(), placed.shelfOf, placed.order).map((code) => ({
    id: `product:${code}`,
    label: code === CUSTOM_SHELF_ID ? t("scenario.customPacks") : packNameOf(code),
    selected: product === code,
  }));
}
