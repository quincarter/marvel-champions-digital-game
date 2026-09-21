/**
 * The scenario's card list (docs/phase4-screen-gaps.md §3 "W4"): every
 * encounter-side card in the live game, grouped by the encounter set it
 * belongs to.
 *
 * Read straight off `game.cardPool` — the exact card pool `createGame` already
 * assembled for this scenario, this difficulty, these modular sets, and these
 * heroes' obligations and nemesis sets (RRG 1.8 Appendix II) — rather than
 * re-deriving anything from `Scenario` data. `view/encounter-preview.ts` (S3)
 * does the equivalent job for a *not-yet-started* setup, where there is no
 * `GameState` yet to read; once a game exists, its own `cardPool` is more
 * honest than re-running that preview, because it already reflects whichever
 * heroes and modular sets actually got chosen.
 */
import type { EncounterSet } from "@mc/content";
import type { GameState } from "@mc/engine";

export interface ScenarioCardListGroup {
  readonly setId: string;
  readonly setName: string;
  /** Unique card names in this set, alphabetical — not a multiplicity count: this is a reference list, not a decklist. */
  readonly cardNames: readonly string[];
}

export function scenarioCardListOf(
  game: GameState,
  encounterSets: readonly EncounterSet[],
): readonly ScenarioCardListGroup[] {
  const setNames = new Map(encounterSets.map((set) => [set.id as string, set.name]));
  const namesBySet = new Map<string, Set<string>>();
  for (const card of Object.values(game.cardPool)) {
    if (!("encounterSetIds" in card)) continue;
    for (const setId of card.encounterSetIds as readonly string[]) {
      const names = namesBySet.get(setId) ?? new Set<string>();
      names.add(card.name);
      namesBySet.set(setId, names);
    }
  }
  return [...namesBySet.entries()]
    .map(([setId, names]) => ({ setId, setName: setNames.get(setId) ?? setId, cardNames: [...names].sort() }))
    .sort((a, b) => a.setName.localeCompare(b.setName));
}
