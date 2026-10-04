/**
 * Test support for the modular-set x scenario matrix (docs/phase7-wave6-qa-modular-matrix.md, owner decision of
 * 2026-10-04: Table setup offers every modular encounter set of an unlocked pack for any scenario).
 *
 * Derives from content data, with no hand-kept id list:
 * - the playable encounter sets and scenarios (every scripted wave plus Core);
 * - which of those sets are modular, by the FAQ definition (RRG 1.8 "Modular Encounter Sets" FAQ, Galaxy's Most
 *   Wanted entry, mc_rulesreference_v18_compressed.md: "If an encounter set is not scenario-specific ... or
 *   campaign-specific ..., then it is modular") together with "Standard Set" (p. 40) / "Expert Set" (p. 19), the
 *   nemesis sets (a hero's own set, not modular) and the one-card "extra" sets (MojoMania insert p. 2);
 * - for a scenario and a set, the options that build that pairing, or why the pairing is restricted.
 *
 * Classification is data-driven: a set holding a villain or main scheme card is that scenario's own set (the FAQ's
 * "contains the name of that scenario"); the printed flags (`nemesisOfIdentityId`, `campaignSpecific`,
 * `classification`, `competitiveOnly`, `extraModular`) do the rest. There are no per-set overrides: a
 * classification the data gets wrong is fixed in the curation layer.
 */
import {
  CORE_SCENARIOS,
  PLAYABLE_CARDS,
  WAVE1_SCENARIOS,
  WAVE2_SCENARIOS,
  WAVE3_SCENARIOS,
  WAVE4_SCENARIOS,
  WAVE5_SCENARIOS,
  WAVE6_SCENARIOS,
  setAsideModularSetCountFor,
  type AnyCard,
  type EncounterSet,
  type Scenario,
} from "@mc/content";
import {
  activeEncounterDeckId,
  createGame,
  type EngineDeps,
  type GameEvent,
  type GameSetupConfig,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { PLAYABLE_ENCOUNTER_SETS } from "../modular-pool.js";
import { PLAYABLE_DEPS, playableScenario } from "../playable/index.js";
import { applyOk, firstLegal, P1, settle, type Picker } from "./harness.js";
import { withForm } from "./staging.js";
import type { CorePlayer } from "../core/setup.js";

export { PLAYABLE_ENCOUNTER_SETS };

/** Every playable scenario, each once, in wave order. */
export const PLAYABLE_SCENARIOS: readonly Scenario[] = [
  ...new Map(
    [
      ...CORE_SCENARIOS,
      ...WAVE1_SCENARIOS,
      ...WAVE2_SCENARIOS,
      ...WAVE3_SCENARIOS,
      ...WAVE4_SCENARIOS,
      ...WAVE5_SCENARIOS,
      ...WAVE6_SCENARIOS,
    ].map((scenario) => [scenario.id as string, scenario] as const),
  ).values(),
];

/** The cards of an encounter set (every printed face the pool lists for it). */
export function cardsOfSet(setId: string, pool: readonly AnyCard[] = PLAYABLE_CARDS): readonly AnyCard[] {
  return pool.filter(
    (card) => "encounterSetIds" in card && (card.encounterSetIds as readonly string[]).includes(setId),
  );
}

/**
 * Cards a modular set puts in the encounter deck, with copies: `quantityInSet` each, except the back face of a
 * double-sided card whose front is in the same set (it enters play by flipping, `wave6/setup.ts` `withoutBackFaces`).
 */
export function dealtCopiesOfSet(setId: string, pool: readonly AnyCard[] = PLAYABLE_CARDS): Map<string, number> {
  const cards = cardsOfSet(setId, pool);
  const ids = new Set<string>(cards.map((card) => card.id));
  const copies = new Map<string, number>();
  for (const card of cards) {
    if (card.type === "villain" || card.type === "main_scheme") continue;
    const other = card.otherFaceId;
    if (other !== undefined && ids.has(other) && String(card.id) > String(other)) continue;
    copies.set(card.id, (copies.get(card.id) ?? 0) + card.quantityInSet);
  }
  return copies;
}

/**
 * Cards that belong to a set through `specificTo: { kind: "scenario" }` instead of `encounterSetIds` and are not
 * dealt into the encounter deck: the Milano (16142, "Permanent. Setup.", Ship Command). RRG 1.8 "Setup (Keyword)"
 * (p. 40): such a card "begins the game in play", wherever its set is used. Longshot's one-card extra set is left out
 * (it is an encounter-backed card the deck does carry).
 */
export function scenarioCardsOfSet(setId: string, pool: readonly AnyCard[] = PLAYABLE_CARDS): readonly AnyCard[] {
  return pool.filter(
    (card) =>
      "specificTo" in card &&
      card.specificTo?.kind === "scenario" &&
      card.specificTo.encounterSetId === setId &&
      !("encounterSetIds" in card && (card.encounterSetIds as readonly string[]).includes(setId)) &&
      (card as { cardBack?: string }).cardBack !== "encounter",
  );
}

/** Every card of the set with the setup keyword, whether dealt into the encounter deck or specific to the scenario. */
export function setupKeywordCardsOfSet(setId: string, pool: readonly AnyCard[] = PLAYABLE_CARDS): readonly AnyCard[] {
  return [...cardsOfSet(setId, pool), ...scenarioCardsOfSet(setId, pool)].filter((card) =>
    ("keywords" in card ? (card.keywords as readonly { readonly name: string }[]) : []).some(
      (keyword) => keyword.name === "setup",
    ),
  );
}

export type SetClass =
  | { readonly kind: "modular" }
  | { readonly kind: "extra" }
  | { readonly kind: "excluded"; readonly reason: string };

/** Classifies one set by the FAQ's definition, from the data. */
export function classifySet(set: EncounterSet, pool: readonly AnyCard[] = PLAYABLE_CARDS): SetClass {
  if (set.extraModular) return { kind: "extra" };
  if (set.classification) return { kind: "excluded", reason: `${set.classification} set` };
  // Core's Standard and Expert sets carry no `classification` flag; a scenario naming them as its difficulty set does.
  for (const scenario of PLAYABLE_SCENARIOS) {
    if ((scenario.standardEncounterSetIds as readonly string[]).includes(set.id))
      return { kind: "excluded", reason: "standard set (RRG 1.8 p. 40)" };
    if ((scenario.expertEncounterSetIds as readonly string[]).includes(set.id))
      return { kind: "excluded", reason: "expert set (RRG 1.8 p. 19)" };
  }
  if (set.nemesisOfIdentityId) return { kind: "excluded", reason: "nemesis set" };
  if (set.campaignSpecific) return { kind: "excluded", reason: "campaign-specific" };
  if (set.competitiveOnly) return { kind: "excluded", reason: "competitive only" };
  const cards = cardsOfSet(set.id, pool);
  if (cards.some((card) => card.type === "villain" || card.type === "main_scheme"))
    return { kind: "excluded", reason: "scenario-specific (holds a villain or main scheme)" };
  if (cards.length === 0) return { kind: "excluded", reason: "no cards in the playable pool" };
  return { kind: "modular" };
}

export const MODULAR_SETS: readonly EncounterSet[] = PLAYABLE_ENCOUNTER_SETS.filter(
  (set) => classifySet(set).kind === "modular",
);
export const EXTRA_SETS: readonly EncounterSet[] = PLAYABLE_ENCOUNTER_SETS.filter(
  (set) => classifySet(set).kind === "extra",
);

/** The set id a scenario's own required companion (`encounterSetIds`) names: never also picked as modular. */
export type Pairing =
  | {
      readonly kind: "build";
      readonly modularSetIds: readonly string[];
      readonly setAsideModularSetIds?: readonly string[];
      /** Sets picked alongside the one under test to meet the scenario's count (empty when it asks for one). */
      readonly fillers: readonly string[];
    }
  | { readonly kind: "required"; readonly reason: string }
  | { readonly kind: "restricted"; readonly reason: string };

/** Core's five general-purpose modular sets, the filler of last resort (the picker offers these everywhere today). */
const FILLERS = ["bomb_scare", "legions_of_hydra", "masters_of_evil", "the_doomsday_chair", "under_attack"];

/**
 * How set `setId` is picked for `scenario` at `playerCount` seats, or why it cannot be. A set the scenario already
 * lists in `encounterSetIds` is "required" (shuffling it in twice is not a choice). A scenario that takes no modular
 * sets (count 0: Breakout, The Hood, Sinister Six), a restricted pool and `singleVillainOnly` (MC21 p. 16) are
 * "restricted". A scenario that wants several sets gets the set under test plus its own recommended sets (then Core's
 * five) as fillers.
 */
export function pairingFor(setId: string, scenario: Scenario, playerCount = 1): Pairing {
  const set = PLAYABLE_ENCOUNTER_SETS.find((candidate) => candidate.id === setId);
  if (!set) throw new Error(`no encounter set ${setId}`);
  if ((scenario.encounterSetIds as readonly string[]).includes(setId))
    return { kind: "required", reason: `${scenario.id} already requires ${setId}` };
  if (set.singleVillainOnly && scenario.multipleVillains)
    return { kind: "restricted", reason: "singleVillainOnly (MC21 p. 16): the set needs exactly one villain" };
  const pool = scenario.modularSetPool;
  if (pool?.restricted && !(pool.setIds as readonly string[]).includes(setId))
    return { kind: "restricted", reason: `${scenario.id} draws modular sets only from its own pool (Q44)` };
  const aside = setAsideModularSetCountFor(scenario, playerCount);
  const count = scenario.modularSetCount ?? 1;
  if (count === 0 && aside > 0 && !pool)
    return {
      kind: "restricted",
      reason: `${scenario.id} sets aside its own ${aside} modular sets (docs/phase7-wave4.md 2.3)`,
    };
  if (count === 0 && aside === 0 && !pool)
    return { kind: "restricted", reason: `${scenario.id} uses no modular encounter sets` };
  const poolIds = (pool?.setIds ?? []) as readonly string[];
  const candidates = [
    ...(pool ? poolIds : (scenario.recommendedModularSetIds as readonly string[])),
    ...(pool ? [] : FILLERS),
  ].filter((id) => id !== setId && !(scenario.encounterSetIds as readonly string[]).includes(id));
  const unique = [...new Set(candidates)];
  if (aside > 0) {
    // Mojo: the genre sets are set aside, none shuffled in.
    const fillers = unique.slice(0, aside - 1);
    return { kind: "build", modularSetIds: [], setAsideModularSetIds: [setId, ...fillers], fillers };
  }
  const fillers = unique.slice(0, count - 1);
  return { kind: "build", modularSetIds: [setId, ...fillers], fillers };
}

export interface PairingBuild {
  readonly pairing: Pairing;
  /** What `playableScenario` built, when it built. */
  readonly config?: GameSetupConfig;
  /** What it threw, when it threw. */
  readonly error?: string;
}

export interface PairingBuildOptions {
  readonly seed: number;
  readonly players: readonly CorePlayer[];
  readonly expert?: boolean;
}

/** Builds (or explains why it cannot) set `setId` as the modular set of `scenario`, through `playableScenario`. */
export function buildPairing(setId: string, scenario: Scenario, options: PairingBuildOptions): PairingBuild {
  const pairing = pairingFor(setId, scenario, options.players.length);
  if (pairing.kind !== "build") return { pairing };
  const base = {
    seed: options.seed,
    players: options.players,
    ...(options.expert ? { difficulty: "expert" as const } : {}),
  };
  const attempt = (modularSetIds: readonly string[]): GameSetupConfig =>
    playableScenario(scenario.id, {
      ...base,
      modularSetIds,
      ...(pairing.setAsideModularSetIds ? { setAsideModularSetIds: pairing.setAsideModularSetIds } : {}),
    });
  try {
    return { pairing, config: attempt(pairing.modularSetIds) };
  } catch (error) {
    return { pairing, error: (error as Error).message };
  }
}

/** Hero precons the matrix rotates through: Core and one or two per wave, so a set meets many identity sets. */
export const MATRIX_HEROES: readonly string[] = [
  "core-spider-man-justice",
  "core-captain-marvel-leadership",
  "core-she-hulk-aggression",
  "core-iron-man-aggression",
  "core-black-panther-protection",
  "cap-leadership",
  "thor-aggression",
  "hawkeye-leadership",
  "ant-leadership",
  "star-lord-leadership",
  "rocket-raccoon-aggression",
  "vision-protection",
  "nova-aggression",
  "colossus-protection",
  "cyclops-leadership",
  "wolverine-aggression",
  "storm-leadership",
  "gambit-justice",
  "rogue-protection",
];

/** A built pairing as a game past setup, in the player phase (hero form when `hero`), or why it did not build. */
export function startPairing(
  setId: string,
  scenarioId: string,
  options: {
    readonly hero?: string;
    readonly seed?: number;
    readonly heroForm?: boolean;
    readonly expert?: boolean;
  } = {},
): GameState {
  const scenario = PLAYABLE_SCENARIOS.find((candidate) => candidate.id === scenarioId);
  if (!scenario) throw new Error(`no scenario ${scenarioId}`);
  const built = buildPairing(setId, scenario, {
    seed: options.seed ?? 11,
    players: [{ starterDeckId: options.hero ?? "core-she-hulk-aggression" }],
    ...(options.expert ? { expert: true } : {}),
  });
  const config = built.config;
  if (!config) throw new Error(`${setId} in ${scenarioId} does not build: ${built.error ?? built.pairing.kind}`);
  const created = createGame(config, PLAYABLE_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const settled = settle(created.state, firstLegal, (s) => s.step.phase === "player", PLAYABLE_DEPS);
  return options.heroForm ? withForm(settled, { heroForm: 0 }) : settled;
}

/**
 * Moves instance `id` to just behind `fillers` boost cards on top of the active encounter deck (the villain draws its
 * boost card before the player is dealt, `stackSetAsideBehindBoost`'s trap), or null when it is not in that deck or its
 * discard pile.
 */
export function stackBehindBoost(state: GameState, id: InstanceId, fillers: number): GameState | null {
  const deckId = activeEncounterDeckId(state);
  const piles = state.encounterDecks[deckId]!;
  if (!piles.deck.includes(id) && !piles.discard.includes(id)) return null;
  const printed = state.instances[id]!.cardId;
  const rest = piles.deck.filter((other) => other !== id);
  const boost = rest.filter((other) => state.instances[other]!.cardId !== printed).slice(0, fillers);
  return {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [deckId]: {
        deck: [...boost, id, ...rest.filter((other) => !boost.includes(other))],
        discard: piles.discard.filter((other) => other !== id),
      },
    },
  };
}

export interface RevealRun {
  readonly events: readonly GameEvent[];
  readonly state: GameState;
  /** The card was dealt and revealed (the game may have ended afterwards). */
  readonly revealed: boolean;
}

/**
 * Ends P1's turn with instance `id` stacked to be the card the villain phase deals, answering every choice with `pick`
 * (default: the fewest selections, declining optional things). Retries with more boost fillers when the card was not the
 * one dealt (Tower Defense activates several villains; a villain whose own text mills the deck eats it).
 */
export function revealOnTurnEnd(
  base: GameState,
  id: InstanceId,
  options: { readonly form?: "hero" | "alterEgo"; readonly pick?: Picker; readonly deps?: EngineDeps } = {},
): RevealRun {
  const deps = options.deps ?? PLAYABLE_DEPS;
  const pick = options.pick ?? firstLegal;
  const posed = options.form ? withForm(base, options.form === "hero" ? { heroForm: 0 } : "alterEgo") : base;
  let last: RevealRun | null = null;
  for (let fillers = 1; fillers <= 6; fillers++) {
    const staged = stackBehindBoost(posed, id, fillers);
    if (!staged) throw new Error(`instance ${id} is not in the encounter deck or discard pile`);
    const events: GameEvent[] = [];
    let current = staged;
    let result = applyOk(current, { type: "endTurn", playerId: P1 }, deps);
    events.push(...result.events);
    current = result.state;
    for (let guard = 0; current.pendingChoice && !current.outcome; guard++) {
      if (guard > 300) throw new Error(`choices did not settle (stuck on ${current.pendingChoice.prompt.kind})`);
      const choice = current.pendingChoice;
      result = applyOk(
        current,
        {
          type: "resolveChoice",
          playerId: choice.playerId,
          choiceId: choice.choiceId,
          selectedOptionIds: pick(current),
        },
        deps,
      );
      events.push(...result.events);
      current = result.state;
    }
    const revealed = events.some((event) => event.type === "encounterCardRevealed" && event.instanceId === id);
    last = { events, state: current, revealed };
    if (revealed || current.outcome) return last;
  }
  return last!;
}

/** Instances of printed card `code` that are encounter cards (no owner) anywhere in the game. */
export function encounterInstancesOf(state: GameState, code: string): InstanceId[] {
  return Object.values(state.instances)
    .filter((instance) => instance.ownerId === null && instance.cardId === code)
    .map((instance) => instance.instanceId);
}
