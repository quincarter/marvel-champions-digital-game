/**
 * Which modular encounter sets a scenario's setup uses (docs/phase7-wave6.md §3.63): the sets shuffled in, the sets
 * set aside, and the extra sets the players add on top. Generic over `Scenario.modularSetPool`,
 * `Scenario.setAsideModularSetCount` and `EncounterSet.extraModular`; a scenario builder calls it and turns the ids into
 * `GameSetupConfig.encounterDeck` / `setAsideModularSets`.
 *
 * - A restricted pool (Spiral 39015a, Mojo 39025a; §4 Q44): every pick, the players' or a random one, comes from it.
 * - An unrestricted pool (MaGog 39002a's italic "1 random modular set from the MojoMania scenario pack"): the players
 *   may name any modular set; a random pick draws from the pool.
 * - Without a pool the scenario keeps its old default, `recommendedModularSetIds`.
 * - An extra modular set (Longshot; §4 Q43, MojoMania insert p. 2: "Longshot does not count as one of those sets") is
 *   added only when the players ask for it, never counted, never a random pick and never set aside.
 *
 * Random picks use their own stream seeded from the game's seed, so the same seed always builds the same game and the
 * engine's own RNG (`GameState.rng`, started from the same seed) is untouched.
 */
import { setAsideModularSetCountFor, type AnyCard, type CardId, type EncounterSet, type Scenario } from "@mc/content";
import { createRng, shuffle, type RngState } from "@mc/engine";

export interface ModularSetChoiceOptions {
  readonly playerCount: number;
  readonly seed: number;
  /** The players' modular sets. Absent: random picks from the pool, or the recommendation when there is none. */
  readonly modularSetIds?: readonly string[];
  /** The players' set-aside modular sets. Absent: random picks from the pool. */
  readonly setAsideModularSetIds?: readonly string[];
  /** Extra modular sets to shuffle in on top (`EncounterSet.extraModular`). Absent: none. */
  readonly extraModularSetIds?: readonly string[];
}

export interface ModularSetChoice {
  /** Shuffled into the encounter deck; exactly `modularSetCount` of them when the scenario has a pool. */
  readonly modularSetIds: readonly string[];
  /** Set aside (`GameSetupConfig.setAsideModularSets`); `setAsideModularSetCountFor(scenario, playerCount)` of them. */
  readonly setAsideModularSetIds: readonly string[];
  /** Shuffled into the encounter deck, never counted. */
  readonly extraModularSetIds: readonly string[];
}

/**
 * A set the players may choose as a modular set: not the scenario's own, a Standard/Expert (by classification or as the
 * scenario's difficulty set; RRG 1.8 "Standard Set", p. 40), nemesis, campaign, competitive or extra set.
 */
export function isModularChoice(set: EncounterSet, scenario: Scenario): boolean {
  return (
    set.classification === undefined &&
    !scenario.standardEncounterSetIds.includes(set.id) &&
    !scenario.expertEncounterSetIds.includes(set.id) &&
    set.nemesisOfIdentityId === undefined &&
    !set.competitiveOnly &&
    !set.campaignSpecific &&
    !set.extraModular &&
    !scenario.encounterSetIds.includes(set.id)
  );
}

function randomPicks(from: readonly string[], count: number, rng: RngState): readonly [string[], RngState] {
  const [shuffled, next] = shuffle(from, rng);
  return [shuffled.slice(0, count), next];
}

/** The modular, set-aside and extra sets for one game of `scenario`. Throws on a choice the scenario forbids. */
export function chooseModularSets(
  scenario: Scenario,
  encounterSets: readonly EncounterSet[],
  options: ModularSetChoiceOptions,
): ModularSetChoice {
  const label = scenario.name;
  const byId = new Map<string, EncounterSet>(encounterSets.map((set) => [set.id, set]));
  const pool = scenario.modularSetPool;
  const poolIds: readonly string[] = pool?.setIds ?? [];
  const checkPicks = (ids: readonly string[], what: string): void => {
    if (new Set(ids).size !== ids.length) throw new Error(`${label}: a ${what} set is chosen twice`);
    for (const id of ids) {
      const set = byId.get(id);
      if (set?.extraModular) throw new Error(`${label}: ${id} is an extra modular set and never counts as one (Q43)`);
      if (pool?.restricted) {
        if (!poolIds.includes(id)) throw new Error(`${label}: ${id} is not in the scenario's modular set pool (Q44)`);
      } else if (!set || !isModularChoice(set, scenario)) throw new Error(`${label}: ${id} is not a modular set`);
    }
  };

  let rng = createRng(options.seed);
  let modularSetIds: readonly string[];
  if (!pool) modularSetIds = options.modularSetIds ?? scenario.recommendedModularSetIds;
  else {
    const count = scenario.modularSetCount ?? 1;
    if (options.modularSetIds) {
      if (options.modularSetIds.length !== count)
        throw new Error(`${label} uses ${count} modular set(s), got ${options.modularSetIds.length}`);
      checkPicks(options.modularSetIds, "modular");
      modularSetIds = options.modularSetIds;
    } else [modularSetIds, rng] = randomPicks(poolIds, count, rng);
  }

  const setAsideCount = setAsideModularSetCountFor(scenario, options.playerCount);
  let setAsideModularSetIds: readonly string[] = [];
  if (options.setAsideModularSetIds || setAsideCount > 0) {
    if (options.setAsideModularSetIds) {
      if (options.setAsideModularSetIds.length !== setAsideCount)
        throw new Error(`${label}: expected ${setAsideCount} set-aside modular sets`);
      checkPicks(options.setAsideModularSetIds, "set-aside");
      setAsideModularSetIds = options.setAsideModularSetIds;
    } else {
      if (!pool) throw new Error(`${label}: choose its ${setAsideCount} set-aside modular sets`);
      [setAsideModularSetIds] = randomPicks(
        poolIds.filter((id) => !modularSetIds.includes(id)),
        setAsideCount,
        rng,
      );
    }
    const both = setAsideModularSetIds.filter((id) => modularSetIds.includes(id));
    if (both.length > 0) throw new Error(`${label}: ${both.join(", ")} is both shuffled in and set aside`);
  }

  const extraModularSetIds = options.extraModularSetIds ?? [];
  if (new Set(extraModularSetIds).size !== extraModularSetIds.length)
    throw new Error(`${label}: an extra modular set is added twice`);
  for (const id of extraModularSetIds)
    if (!byId.get(id)?.extraModular) throw new Error(`${label}: ${id} is not an extra modular set`);

  return { modularSetIds, setAsideModularSetIds, extraModularSetIds };
}

/**
 * The cards an extra modular set shuffles in. Longshot's set is one player-type ally with an encounter card back
 * (39071, MojoMania insert p. 2: "has an encounter card back and forms its own one-card modular encounter set"), so
 * its card names the set through `specificTo` rather than `encounterSetIds`; either link counts.
 */
export function extraModularCardIds(setIds: readonly string[], pool: readonly AnyCard[]): CardId[] {
  const deck: CardId[] = [];
  for (const setId of setIds) {
    const members = pool.filter(
      (card) =>
        ("encounterSetIds" in card && (card.encounterSetIds as readonly string[]).includes(setId)) ||
        ("specificTo" in card &&
          card.specificTo?.kind === "scenario" &&
          card.specificTo.encounterSetId === setId &&
          card.cardBack === "encounter"),
    );
    if (members.length === 0) throw new Error(`extra modular set ${setId} has no cards in this pool`);
    for (const card of members) for (let copy = 0; copy < card.quantityInSet; copy++) deck.push(card.id);
  }
  return deck;
}
