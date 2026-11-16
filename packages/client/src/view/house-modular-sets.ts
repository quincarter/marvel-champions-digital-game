/**
 * The "Allow extra modular sets" house rule (issue #761): a scenario takes more modular sets than it calls for. The
 * sets beyond its count ride the draft as `houseModularSetIds` and the session config as `houseModularSetIds`; the
 * scenario builders (`@mc/cards`) refuse a pick count other than the scenario's and an `extraModularSetIds` entry that
 * is not an extra set (Longshot), so the builder never sees them: the session adds their cards to the encounter deck
 * after it builds (`engine/session-core.ts`), the way a campaign's composed sets are. The engine shuffles the deck at
 * the deal, so these cards mix in like any others. Off is the default and the printed game.
 */
import type { Scenario } from "@mc/content";
import type { GameSetupConfig } from "@mc/engine";
import { modularPicksAreSetAside } from "./modular-summary.js";
import type { SetupDraft } from "./setup-draft.js";

/**
 * Does the rule apply to this scenario? Not to a scenario that draws its sets from a pool (MojoMania) or sets them aside
 * (Mojo, The Hood), whose picks are not a count of sets shuffled in, nor to a Civil War leader's 3-or-4 range, which has
 * its own builder.
 */
export function houseModularAllowed(scenario: Scenario): boolean {
  return (
    scenario.modularSetPool === undefined &&
    scenario.modularSetCountRange === undefined &&
    !modularPicksAreSetAside(scenario) &&
    scenario.setAsideModularSetCount === undefined
  );
}

/** The draft's sets beyond the scenario's count. */
export const houseModularSetIdsOf = (draft: Pick<SetupDraft, "houseModularSetIds">): readonly string[] =>
  draft.houseModularSetIds ?? [];

/** `draft` with `setId` added to the sets beyond the count, or taken out when it is there. */
export function toggleHouseModularSet(draft: SetupDraft, setId: string): SetupDraft {
  const current = houseModularSetIdsOf(draft);
  const next = current.includes(setId) ? current.filter((id) => id !== setId) : [...current, setId];
  return withHouseModularSetIds(draft, next);
}

/** `draft` with exactly these sets beyond the count; none leaves the field off, so a draft that never had it keeps its shape. */
export function withHouseModularSetIds(draft: SetupDraft, ids: readonly string[]): SetupDraft {
  if (ids.length > 0) return { ...draft, houseModularSetIds: ids };
  const { houseModularSetIds: _none, ...rest } = draft;
  return rest;
}

/**
 * `config` with these sets' contents added (`modularSetContents`, `@mc/cards`): their encounter cards shuffled in on top
 * and their separate decks (the Infinity Stones, set aside facedown) merged into `scenarioDecks`. Where a scenario's
 * villains each carry their own deck, the first villain's takes the cards (as a set an added rule shuffles in does,
 * `table-setup-preview.ts`); otherwise the deck.
 */
export function withHouseModularCards(
  config: GameSetupConfig,
  extra: {
    readonly encounterDeck: readonly GameSetupConfig["encounterDeck"][number][];
    readonly scenarioDecks?: GameSetupConfig["scenarioDecks"];
  },
): GameSetupConfig {
  const cardIds = extra.encounterDeck;
  const decks = extra.scenarioDecks ?? [];
  if (cardIds.length === 0 && decks.length === 0) return config;
  const withDecks: GameSetupConfig =
    decks.length > 0 ? { ...config, scenarioDecks: [...(config.scenarioDecks ?? []), ...decks] } : config;
  if (cardIds.length === 0) return withDecks;
  if (withDecks.villains && withDecks.villains.length > 0 && withDecks.sharedEncounterDeck !== true)
    return {
      ...withDecks,
      villains: withDecks.villains.map((villain, index) =>
        index === 0 ? { ...villain, encounterDeck: [...villain.encounterDeck, ...cardIds] } : villain,
      ),
    };
  return { ...withDecks, encounterDeck: [...withDecks.encounterDeck, ...cardIds] };
}
