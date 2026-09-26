/**
 * Core cards whose printed "Then" waits on something other than a required choice (docs/then-sweep.md, RRG 1.8
 * "'Then'", p. 44): the Legions of Hydra / Doomsday Chair / Masters of Mayhem searches, Black Widow's cancel and the
 * Armored Rhino Suit's threshold.
 */

import { activeEncounterDeck, activeEncounterDeckId, cardsInPlay, type GameEvent, type GameState } from "@mc/engine";
import type { InstanceId } from "@mc/engine";
import { CORE_DEPS } from "./index.js";
import { coreScenario } from "./setup.js";
import {
  applyOk,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  P1,
  patchInstance,
  playerOf,
  run,
  settle,
  stackEncounterDeck,
  startCoreGame,
  toHero,
  type Picker,
} from "../testing/harness.js";
import { driveEvents, driveEventsPicking } from "../testing/staging.js";

const vsKlaw = (modularSetIds?: readonly string[]) =>
  startCoreGame(
    coreScenario("klaw", {
      ...(modularSetIds ? { modularSetIds } : {}),
      players: [{ starterDeckId: "core-she-hulk-aggression" }],
      seed: 5,
    }),
  );

const skipped = (events: readonly GameEvent[]) => events.some((e) => e.type === "thenSkipped");
const causes = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "preThenUnresolved" ? [e.cause] : []));
const encounterShuffles = (events: readonly GameEvent[]) =>
  events.filter((e) => e.type === "deckShuffled" && e.zone.kind === "encounterDeck").length;

/** Takes every copy of `codes` out of the encounter deck and discard pile (test surgery: they are simply gone). */
function withoutEncounterCards(state: GameState, ...codes: readonly string[]): GameState {
  const gone = new Set(codes.flatMap((code) => instancesOf(state, code)));
  const deckId = activeEncounterDeckId(state);
  const piles = activeEncounterDeck(state);
  return {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [deckId]: {
        deck: piles.deck.filter((id) => !gone.has(id)),
        discard: piles.discard.filter((id) => !gone.has(id)),
      },
    },
  };
}

/** Reveals `code` from the top of the encounter deck in the next villain phase (behind a 0-icon boost card). */
const revealNext = (state: GameState, code: string) =>
  driveEvents(CORE_DEPS, stackEncounterDeck(state, "01186", code), endTurn());

describe("a search that finds nothing: the shuffle is the Search rule's and happens anyway (RRG 1.8 p. 39)", () => {
  it("Legions of Hydra (01180) with no Madame Hydra to find: nothing enters play, the deck is still shuffled", () => {
    const state = withoutEncounterCards(vsKlaw(["legions_of_hydra"]), "01181");
    const { state: after, events } = revealNext(state, "01180");
    expect(causes(events)).toContain("searchFoundNothing");
    expect(instancesOf(after, "01181").some((id) => cardsInPlay(after).includes(id))).toBe(false);
    expect(encounterShuffles(events)).toBeGreaterThanOrEqual(1);
  });

  it("…with Madame Hydra to find, she enters play engaged with you and the deck is shuffled", () => {
    const { state: after, events } = revealNext(vsKlaw(["legions_of_hydra"]), "01180");
    expect(causes(events)).not.toContain("searchFoundNothing");
    const [madame] = instancesOf(after, "01181") as [InstanceId];
    expect(inst(after, madame).engagedWith).toBe(P1);
    expect(encounterShuffles(events)).toBeGreaterThanOrEqual(1);
  });

  it("The Doomsday Chair (01183) with no M.O.D.O.K. to find: nothing enters play, the deck is still shuffled", () => {
    const state = withoutEncounterCards(vsKlaw(["the_doomsday_chair"]), "01184");
    const { state: after, events } = revealNext(state, "01183");
    expect(causes(events)).toContain("searchFoundNothing");
    expect(instancesOf(after, "01184").some((id) => cardsInPlay(after).includes(id))).toBe(false);
    expect(encounterShuffles(events)).toBeGreaterThanOrEqual(1);
    const found = revealNext(vsKlaw(["the_doomsday_chair"]), "01183");
    const [modok] = instancesOf(found.state, "01184") as [InstanceId];
    expect(inst(found.state, modok).engagedWith).toBe(P1);
  });

  describe("Masters of Mayhem (01133), with no Masters of Evil minion in play so no attacks are made", () => {
    const MASTERS_OF_EVIL = ["01129", "01130", "01131", "01132"];
    /** Every Masters of Evil minion in play taken out of it (surgery), so "each … attacks" makes no attack. */
    const noneInPlay = (state: GameState): GameState => {
      const isMoe = (id: InstanceId) => MASTERS_OF_EVIL.some((code) => instancesOf(state, code).includes(id));
      return {
        ...state,
        players: state.players.map((p) => ({ ...p, playArea: p.playArea.filter((id) => !isMoe(id)) })),
      };
    };

    it("none left to find either: the search finds nothing and the deck is still shuffled", () => {
      const state = withoutEncounterCards(noneInPlay(vsKlaw()), ...MASTERS_OF_EVIL);
      const { state: after, events } = revealNext(state, "01133");
      expect(causes(events)).toContain("searchFoundNothing");
      const moe = MASTERS_OF_EVIL.flatMap((code) => instancesOf(after, code));
      expect(moe.some((id) => playerOf(after, P1).playArea.includes(id))).toBe(false);
      expect(encounterShuffles(events)).toBeGreaterThanOrEqual(1);
    });

    it("one to find: it enters play engaged with you and the deck is shuffled", () => {
      const { state: after, events } = revealNext(noneInPlay(vsKlaw()), "01133");
      expect(causes(events)).not.toContain("searchFoundNothing");
      const moe = MASTERS_OF_EVIL.flatMap((code) => instancesOf(after, code));
      expect(moe.some((id) => playerOf(after, P1).playArea.includes(id))).toBe(true);
      expect(encounterShuffles(events)).toBeGreaterThanOrEqual(1);
    });
  });
});

describe("Black Widow (01075): 'Then, reveal another card' waits on the cancel", () => {
  const rhinoVsBlackPanther = () =>
    startCoreGame(coreScenario("rhino", { players: [{ starterDeckId: "core-black-panther-protection" }], seed: 11 }));

  /** Black Widow in play (surgery) with Genius (01089, a [mental] resource) in hand to pay for her. */
  function withBlackWidow(): { state: GameState; widow: InstanceId; genius: InstanceId } {
    const given = moveToHand(rhinoVsBlackPanther(), P1, "01075", "01089");
    const [widow, genius] = given.ids as [InstanceId, InstanceId];
    const state: GameState = {
      ...given.state,
      players: given.state.players.map((p) =>
        p.playerId === P1 ? { ...p, hand: p.hand.filter((id) => id !== widow), playArea: [...p.playArea, widow] } : p,
      ),
      instances: { ...given.state.instances, [widow]: { ...inst(given.state, widow), controllerId: P1, faceup: true } },
    };
    return { state, widow, genius };
  }

  /** Accepts her interrupt and pays with Genius; `beforeAccepting` may change the state at the moment she's offered. */
  const pickerFor =
    (widow: InstanceId, genius: InstanceId): Picker =>
    (s) => {
      const choice = s.pendingChoice;
      if (!choice) return [];
      const hers = choice.options.find((o) => o.optionId === `${widow}:01075.black-widow-interrupt`);
      if (hers) return [hers.optionId];
      if (choice.prompt.kind === "payForAbility" || choice.prompt.kind === "spendResources") {
        const pay = choice.options.find((o) => o.optionId.includes(genius));
        if (pay) return [pay.optionId];
      }
      return firstLegal(s);
    };

  it("the cancel resolves, so another card is revealed", () => {
    const { state, widow, genius } = withBlackWidow();
    const stacked = stackEncounterDeck(run(state, toHero()), "01186", "01104", "01105");
    const { events } = driveEventsPicking(CORE_DEPS, stacked, pickerFor(widow, genius), endTurn());
    expect(events.some((e) => e.type === "revealCancelled")).toBe(true);
    expect(skipped(events)).toBe(false);
    // "01105", next on the deck, is the card her "then" revealed.
    const next = instancesOf(stacked, "01105").find((id) => activeEncounterDeck(stacked).deck[2] === id);
    expect(events.some((e) => e.type === "encounterCardRevealed" && e.instanceId === next)).toBe(true);
  });

  it("a card already cancelled when she resolves has nothing left to cancel, so no card is revealed", () => {
    const { state, widow, genius } = withBlackWidow();
    const stacked = stackEncounterDeck(run(state, toHero()), "01186", "01104", "01105");
    const pick = pickerFor(widow, genius);
    // Play to her offer, then mark the reveal as already cancelled (as if another cancel had resolved first).
    let current = run(stacked, endTurn());
    const events: GameEvent[] = [];
    for (let guard = 0; current.pendingChoice; guard++) {
      if (guard > 200) throw new Error("stuck");
      const choice = current.pendingChoice;
      if (choice.options.some((o) => o.optionId.startsWith(`${widow}:`))) {
        current = {
          ...current,
          stack: current.stack.map((f) => (f.kind === "reveal" ? { ...f, effectsCancelled: true } : f)),
        };
      }
      const step = applyOk(
        current,
        {
          type: "resolveChoice",
          playerId: choice.playerId,
          choiceId: choice.choiceId,
          selectedOptionIds: pick(current),
        },
        CORE_DEPS,
      );
      events.push(...step.events);
      current = step.state;
    }
    expect(causes(events)).toContain("nothingToCancel");
    expect(skipped(events)).toBe(true);
    // "01105" was never revealed by her: it is still on top of the encounter deck.
    expect(instancesOf(current, "01105").some((id) => activeEncounterDeck(current).deck[0] === id)).toBe(true);
  });
});

describe("Armored Rhino Suit (01098): the threshold 'if' is post-'then' text and gates itself", () => {
  const rhinoWithSuit = () => {
    const start = startCoreGame(
      coreScenario("rhino", { players: [{ starterDeckId: "core-spider-man-justice" }], seed: 2026 }),
    );
    const revealed = settle(
      run(stackEncounterDeck(start, "01186", "01098"), endTurn()),
      firstLegal,
      undefined,
      CORE_DEPS,
    );
    const [suit] = instancesOf(revealed, "01098").filter((id) => cardsInPlay(revealed).includes(id)) as [InstanceId];
    return { state: settle(run(revealed, toHero()), firstLegal, undefined, CORE_DEPS), suit };
  };
  const hitRhino = (state: GameState) =>
    driveEvents(CORE_DEPS, state, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(state),
      targetInstanceId: state.activeVillainId,
    });

  it("below 5 damage the suit stays; at 5 or more it is discarded; either way the 'then' runs", () => {
    const { state, suit } = rhinoWithSuit();
    const light = hitRhino(state);
    expect(skipped(light.events)).toBe(false);
    expect(cardsInPlay(light.state)).toContain(suit);
    expect(inst(light.state, state.activeVillainId).damage).toBe(inst(state, state.activeVillainId).damage);
    const heavy = hitRhino(patchInstance(state, suit, { damage: 4 }));
    expect(skipped(heavy.events)).toBe(false);
    expect(cardsInPlay(heavy.state)).not.toContain(suit);
  });
});
