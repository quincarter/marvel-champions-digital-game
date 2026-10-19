/**
 * docs/phase7-wave11-scenarios.md §S3.7 (engine task E7): villainous on Black Cat (`fne` 60169) while she is an ally,
 * in Core's Rhino scenario. MC60 p. 26 FAQ: "Does Black Cat retain the villainous keyword while she is an ally? Yes.
 * The rules for villainous have been revised to function for allies (and heroes) who have it." RRG 1.8 "Villainous"
 * (p. 47): when she uses a basic power she is given a facedown boost card from the top of the encounter deck, turned
 * faceup as the power resolves, its icons added to the stat used for this use, then discarded. Amplify adds nothing
 * (RRG 1.8 "Amplify Icon", p. 7; §S4.0). The scripts are this test's own, as in `wave11-treat-self-as-ally.test.ts`.
 */

import { CORE_CARDS, PLAYABLE_CARDS, cardId } from "@mc/content";
import {
  activeEncounterDeck,
  activeEncounterDeckId,
  characterProfile,
  createGame,
  type EngineDeps,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import {
  constant,
  heroAction,
  ifThen,
  placeThreat,
  self,
  spend,
  takeControl,
  threatOn,
  treatSelfAsAlly,
  valueEquals,
} from "./index.js";
import { coreScenario } from "../core/setup.js";
import { P1, firstLegal, inst, patchInstance, settle, use } from "../testing/harness.js";
import { driveEventsPicking, withForm } from "../testing/staging.js";
import { engageMinion, handWith } from "../wave6/mut_gen/project-wideawake-testing.js";
import { WAVE11_ABILITIES } from "../wave11/index.js";
import { WAVE4_ABILITIES } from "../wave4/index.js";
import { WAVE7_ABILITIES } from "../wave7/index.js";
import { conjure, intoPlay } from "../testing/qa-bench.js";

vi.setConfig({ testTimeout: 120_000 });

const BLACK_CAT = "60169";
const CONSTANT = "60169.black-cat-constant";
const ACTION = "60169.black-cat-action";
/** Defiance (26018): "When a boost card on an enemy attacking you would be turned faceup, discard it instead." */
const DEFIANCE = "26018.defiance-interrupt";
/** Lucky and Good (40047): an interrupt to a boost card turned faceup during an attack against you. */
const LUCKY = "40047.lucky-and-good-interrupt";
const DEPS: EngineDeps = {
  abilities: {
    ...WAVE11_ABILITIES,
    [DEFIANCE]: WAVE4_ABILITIES[DEFIANCE]!,
    [LUCKY]: WAVE7_ABILITIES[LUCKY]!,
    [CONSTANT]: constant(treatSelfAsAlly(valueEquals(threatOn(self), 4), 2)),
    [ACTION]: heroAction(
      { cost: spend({ mental: 1 }) },
      placeThreat(1, self),
      ifThen(valueEquals(threatOn(self), 4), takeControl(self)),
    ),
  },
};

/** Rhino against Spider-Man in hero form, Black Cat P1's ally at 4 threat, ready. */
function catAsAlly(): { state: GameState; cat: InstanceId } {
  const base = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: [...CORE_CARDS, ...PLAYABLE_CARDS.filter((c) => [BLACK_CAT, "26018", "40047"].includes(c.id as string))],
  } as never);
  const created = createGame({ ...base, encounterDeck: [...base.encounterDeck, cardId(BLACK_CAT)] }, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  let s = settle(created.state, firstLegal, (st) => st.step.phase === "player", DEPS);
  s = withForm(s, { heroForm: 0 }, P1);
  const placed = engageMinion(s, BLACK_CAT, P1);
  const given = handWith(patchInstance(placed.state, placed.id, { threat: 3 }), P1, "mental", 1);
  const run = driveEventsPicking(
    DEPS,
    given.state,
    firstLegal,
    use(P1, placed.id, ACTION, [{ fromHand: given.ids[0]! }]),
  );
  expect(inst(run.state, placed.id).treatedAs).toMatchObject({ kind: "ally", controller: P1 });
  return { state: patchInstance(run.state, placed.id, { exhausted: false }), cat: placed.id };
}

const iconsOf = (state: GameState, id: InstanceId): number =>
  (state.cardPool[inst(state, id).cardId] as { boostIcons?: number }).boostIcons ?? 0;

/** The first encounter card with 2 or more boost icons moved to the top of the deck (surgery), and its icons. */
function withBoostOnTop(state: GameState): { state: GameState; id: InstanceId; icons: number } {
  const deckId = activeEncounterDeckId(state);
  const piles = state.encounterDecks[deckId]!;
  const id = piles.deck.find((i) => iconsOf(state, i) >= 2)!;
  const deck = [id, ...piles.deck.filter((i) => i !== id)];
  return {
    state: { ...state, encounterDecks: { ...state.encounterDecks, [deckId]: { ...piles, deck } } },
    id,
    icons: iconsOf(state, id),
  };
}

describe("Black Cat keeps villainous as an ally (MC60 p. 26 FAQ; RRG 1.8 'Villainous', p. 47)", () => {
  it("her basic attack is given the encounter deck's top card as a boost card, its icons added to her ATK", () => {
    const ally = catAsAlly();
    const cat = ally.cat;
    const { state, ...boost } = withBoostOnTop(ally.state);
    expect(boost.icons).toBeGreaterThanOrEqual(2);
    const villain = state.activeVillainId!;
    const before = inst(state, villain).damage;
    const run = driveEventsPicking(DEPS, state, firstLegal, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: cat,
      targetInstanceId: villain,
    });
    expect(run.events).toContainEqual(
      expect.objectContaining({ type: "boostCardDealt", enemyInstanceId: cat, instanceId: boost.id }),
    );
    expect(run.events).toContainEqual(
      expect.objectContaining({ type: "characterBoostCardFlipped", characterInstanceId: cat, instanceId: boost.id }),
    );
    // ATK 1 plus the card's icons.
    expect(inst(run.state, villain).damage).toBe(before + 1 + boost.icons);
    expect(activeEncounterDeck(run.state).discard).toContain(boost.id);
    expect(inst(run.state, cat).boostCards).toEqual([]);
    expect(characterProfile(run.state, cat, DEPS)?.atk).toBe(1);
  });
});

/**
 * Enemy-qualified boost-card interrupts do not hear her own card: Defiance's "a boost card on an enemy attacking you"
 * and Lucky and Good's "during an attack against you" name an enemy's boost card (`sourceIs` enemy). The control is
 * Rhino's own attack, where both are still offered.
 */
describe("enemy-qualified boost-card interrupts do not hear her own boost card", () => {
  /** Defiance in P1's hand, Lucky and Good in P1's play area. */
  function staged() {
    const ally = catAsAlly();
    const withDefiance = conjure(ally.state, "26018");
    const withLucky = intoPlay(withDefiance.state, "40047", {}, 3);
    return { state: withBoostOnTop(withLucky.state).state, cat: ally.cat };
  }
  /** Picks the first legal option, noting which of `ids` were offered. */
  function noting(ids: readonly string[]) {
    const offered = new Set<string>();
    const pick = (state: GameState): readonly string[] => {
      for (const option of state.pendingChoice?.options ?? []) {
        for (const id of ids) if (option.optionId.endsWith(id)) offered.add(id);
      }
      return state.pendingChoice?.prompt.kind === "declareDefender" ? ["decline"] : firstLegal(state);
    };
    return { offered, pick };
  }

  it("her basic attack: neither Defiance nor Lucky and Good is offered", () => {
    const { state, cat } = staged();
    const { offered, pick } = noting([DEFIANCE, LUCKY]);
    const run = driveEventsPicking(DEPS, state, pick, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: cat,
      targetInstanceId: state.activeVillainId!,
    });
    expect(run.events.some((e) => e.type === "characterBoostCardFlipped")).toBe(true);
    expect([...offered]).toEqual([]);
  });

  it("control: Rhino's attack against you offers both", () => {
    const { state } = staged();
    const { offered, pick } = noting([DEFIANCE, LUCKY]);
    driveEventsPicking(DEPS, state, pick, { type: "endTurn", playerId: P1 });
    expect([...offered].sort()).toEqual([DEFIANCE, LUCKY].sort());
  });
});
