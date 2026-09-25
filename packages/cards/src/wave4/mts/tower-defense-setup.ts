/**
 * The Tower Defense scenario's own `GameSetupConfig` builder (docs/phase7-wave4.md §2.2, §3.2, §5's own note that
 * "the wave 4 builder (`wave1/setup.ts` `buildMultiVillain`) knows only per-villain decks" — this scenario needs
 * `MultipleVillains.encounterDecks: "shared"` (`GameSetupConfig.sharedEncounterDeck`), two paired main schemes
 * (`putMainSchemeStageIntoPlay`, wired by `21098a.setup`), and Proxima Midnight/Corvus Glaive's own three-stage
 * `VillainCard`s (`@mc/content`'s `MTS_CARDS`, 21092/21095 — docs/phase7-wave4.md §1.6).
 */
import {
  cardId,
  CORE_STARTER_DECKS,
  difficultyEncounterSetIds,
  difficultyOf,
  MTS_SCENARIOS,
  MTS_STARTER_DECKS,
  NEBU_STARTER_DECKS,
  VISION_STARTER_DECKS,
  WARM_STARTER_DECKS,
  type AnyCard,
  type CardId,
  type DifficultySetChoice,
  type VillainCard,
} from "@mc/content";
import type { GameSetupConfig, PlayerSetup, VillainSetup } from "@mc/engine";
import { resolveModes, type CoreDifficulty, type CorePlayer } from "../../core/setup.js";
import { checkWave4DifficultySets, WAVE4_CARDS } from "../cards.js";

/** Villain cards set aside at setup, found by name via the main scheme's own "Setup"/"When Revealed" abilities
 * (MC21 p. 10-11): the environment and the Focused Defense attachment are scenario furniture, not shuffled into
 * the encounter deck like an ordinary treachery/minion, even though both carry `encounterSetIds: [tower_defense]`. */
const TOWER_DEFENSE_SET_ASIDE_IDS: readonly CardId[] = [cardId("21100a"), cardId("21101")];
const SET_ASIDE = new Set<string>(TOWER_DEFENSE_SET_ASIDE_IDS);

function villainCardOf(id: CardId): VillainCard {
  const card = WAVE4_CARDS.find((c) => c.id === id);
  if (!card || card.type !== "villain") throw new Error(`${id} is not a villain card`);
  return card;
}

/** Proxima Midnight I/II/III, one three-stage `VillainCard` (docs/phase7-wave4.md §1.6). */
const PROXIMA_MIDNIGHT = villainCardOf(cardId("21092"));
/** Corvus Glaive I/II/III, the same shape. */
const CORVUS_GLAIVE = villainCardOf(cardId("21095"));

/** A wave 4 or Core starter deck as a player seat (quantities expanded) — copied from `../setup.js`'s
 * `wave4StarterDeckSetup` rather than imported, so this module (which `../setup.js` will come to route
 * "tower-defense" through) doesn't import back from it. */
function starterDeckSetup(starterDeckId: string): PlayerSetup {
  const starter =
    NEBU_STARTER_DECKS.find((d) => d.id === starterDeckId) ??
    WARM_STARTER_DECKS.find((d) => d.id === starterDeckId) ??
    VISION_STARTER_DECKS.find((d) => d.id === starterDeckId) ??
    MTS_STARTER_DECKS.find((d) => d.id === starterDeckId) ??
    CORE_STARTER_DECKS.find((d) => d.id === starterDeckId);
  if (!starter) throw new Error(`no wave 4 or Core starter deck ${starterDeckId}`);
  return {
    identityCardId: starter.identityCardId as PlayerSetup["identityCardId"],
    aspects: starter.aspects,
    deck: starter.cards.flatMap(({ cardId, quantity }) => Array.from({ length: quantity }, () => cardId as CardId)),
  };
}

function seatsOf(players: readonly CorePlayer[]): PlayerSetup[] {
  return players.map((seat) => {
    if ("starterDeckId" in seat) return starterDeckSetup(seat.starterDeckId);
    return {
      identityCardId: seat.identityCardId as PlayerSetup["identityCardId"],
      deck: seat.deck as PlayerSetup["deck"],
      ...(seat.aspects ? { aspects: seat.aspects } : {}),
    };
  });
}

const SCENARIO = MTS_SCENARIOS.find((s) => s.id === "tower-defense");
if (!SCENARIO || !SCENARIO.multipleVillains) throw new Error("no tower-defense multipleVillains scenario record");

export type TowerDefenseDifficulty = CoreDifficulty;

export interface TowerDefenseOptions {
  readonly seed: number;
  readonly players: readonly CorePlayer[];
  readonly difficulty?: TowerDefenseDifficulty;
  readonly modularSetIds?: readonly string[];
  readonly firstPlayerIndex?: number;
  /** Standard II / Expert II instead of the printed sets (docs/phase7-wave4.md §4 Q5); absent is the printed sets. */
  readonly difficultySets?: DifficultySetChoice;
}

/** Every card in these encounter sets, read from `WAVE4_CARDS`, except the ones `TOWER_DEFENSE_SET_ASIDE_IDS`
 * already places in `GameSetupConfig.setAside` — Avengers Tower and Focused Defense are members of the
 * `tower_defense` set (MC21 p. 10-11's own "Setup"/"When Revealed" find them by name) but must not also be
 * shuffled into the deck, or they'd exist as two instances apiece. */
function towerDefenseEncounterCardsOf(setIds: readonly string[]): CardId[] {
  const deck: CardId[] = [];
  for (const setId of setIds) {
    const members = WAVE4_CARDS.filter(
      (card: AnyCard) =>
        "encounterSetIds" in card &&
        (card.encounterSetIds as readonly string[]).includes(setId) &&
        card.type !== "villain" &&
        card.type !== "main_scheme" &&
        !SET_ASIDE.has(card.id),
    );
    if (members.length === 0) throw new Error(`encounter set ${setId} has no Tower Defense card`);
    for (const card of members) for (let copy = 0; copy < card.quantityInSet; copy++) deck.push(card.id);
  }
  return deck;
}

const stageIndexOf = (stageNumber: number): number => {
  const index = PROXIMA_MIDNIGHT.sides[0].stages.findIndex((stage) => stage.stageNumber === stageNumber);
  if (index < 0) throw new Error(`Proxima Midnight has no stage ${stageNumber}`);
  return index;
};

/** Tower Defense: two villains sharing one encounter deck, two main schemes, Focused Defense (§3.2-§3.5). */
export function towerDefenseScenario(options: TowerDefenseOptions): GameSetupConfig {
  const scenario = SCENARIO!;
  checkWave4DifficultySets(options.difficultySets);
  const difficulty = difficultyOf(resolveModes(options.difficulty, undefined));
  const [firstStage, lastStage] = scenario.villainStages[difficulty];
  const startStageIndex = stageIndexOf(firstStage);
  const lastStageIndex = stageIndexOf(lastStage);
  const sets = [
    ...scenario.encounterSetIds,
    ...(options.modularSetIds ?? scenario.recommendedModularSetIds),
    ...difficultyEncounterSetIds(scenario, difficulty, options.difficultySets),
  ];
  if (options.players.length < 1 || options.players.length > 4) throw new Error("a game has 1-4 players");
  const villains: readonly VillainSetup[] = [
    { villainCardId: PROXIMA_MIDNIGHT.id, encounterDeck: [], startStageIndex, lastStageIndex },
    { villainCardId: CORVUS_GLAIVE.id, encounterDeck: [], startStageIndex, lastStageIndex },
  ];
  return {
    seed: options.seed,
    cards: WAVE4_CARDS,
    villainCardId: PROXIMA_MIDNIGHT.id,
    villains,
    sharedEncounterDeck: true,
    encounterDeck: towerDefenseEncounterCardsOf(sets),
    mainSchemeCardId: scenario.mainSchemeCardId,
    setAside: TOWER_DEFENSE_SET_ASIDE_IDS,
    players: seatsOf(options.players),
    requireIdentitySets: true,
    requireLegalDecks: true,
    // Expert mode reaches the engine for "Standard/Expert Mode Only" faces (Formidable Foe, Standard II; §3.18).
    ...(difficulty === "expert" ? { difficulty: "expert" as const } : {}),
    ...(options.firstPlayerIndex !== undefined ? { firstPlayerIndex: options.firstPlayerIndex } : {}),
  };
}
