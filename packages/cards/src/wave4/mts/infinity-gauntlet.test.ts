import { activeVillain, cardsInPlay, type GameState, type InstanceId } from "@mc/engine";
import { cardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  patchInstance,
  settle,
  P1,
} from "../../testing/harness.js";
import { WAVE4_DEPS } from "../index.js";
import { runWave4, startWave4Game } from "../testing.js";
import { spectrumScenario } from "./support.js";

/**
 * Real-game tests for the Infinity Gauntlet modular set's own scripted refs (`infinity-gauntlet.ts`), driven the
 * only way any of them ever resolves in a real game: through the Infinity Gauntlet's own Forced Response
 * (`21129.infinity-gauntlet-forced-response`), which calls `resolveSpecials` — a `special`-kind ability has no
 * trigger of its own and never resolves except when another ability names it.
 */

const STONE_CODES = ["21130", "21131", "21132", "21133", "21134", "21135"] as const;

const thanosGame = (seed: number) => startWave4Game(spectrumScenario("thanos", { seed }));

/** Moves every Infinity Stone out of play (into the Infinity Stone deck's own discard pile, its home) except
 * `keep`, which is placed into play instead — so ending the turn resolves *that one* stone's own Special, and only
 * it, when the Infinity Gauntlet's Forced Response finds it "in play". */
function onlyStoneInPlay(state: GameState, keep?: string): { readonly state: GameState; readonly id?: InstanceId } {
  const inPlay = STONE_CODES.flatMap((code) => instancesOf(state, code)).filter((id) =>
    cardsInPlay(state).includes(id),
  );
  const deckState = state.scenarioDecks["Infinity Stone"]!;
  let next: GameState = {
    ...state,
    villainArea: state.villainArea.filter((id) => !inPlay.includes(id)),
    scenarioDecks: {
      ...state.scenarioDecks,
      "Infinity Stone": { ...deckState, discard: [...deckState.discard, ...inPlay] },
    },
  };
  if (!keep) return { state: next };
  const wanted = cardId(keep);
  const found = (id: InstanceId) => next.instances[id]?.cardId === wanted;
  const stoneDeck = next.scenarioDecks["Infinity Stone"]!;
  const id = stoneDeck.deck.find(found) ?? stoneDeck.discard.find(found) ?? inPlay.find(found);
  if (!id) throw new Error(`no ${keep} anywhere in the Infinity Stone deck`);
  next = {
    ...next,
    villainArea: [...next.villainArea, id],
    scenarioDecks: {
      ...next.scenarioDecks,
      "Infinity Stone": {
        ...stoneDeck,
        deck: stoneDeck.deck.filter((i) => i !== id),
        discard: stoneDeck.discard.filter((i) => i !== id),
      },
    },
    instances: { ...next.instances, [id]: { ...next.instances[id]!, faceup: true } },
  };
  return { state: next, id };
}

const villainOf = (state: GameState): InstanceId => activeVillain(state)!.instanceId;

/**
 * Ends the turn and settles the whole round. Found while writing these tests: `endTurn` resolves an entire round in
 * one command (there's no pending choice to stop `settle` at in between), and several `thanos`/`standard`
 * treacheries (Avatar of Death's own alter-ego branch among them) themselves make the villain scheme *again* once
 * revealed later the same round — a second, real activation that re-fires the Infinity Gauntlet's Forced Response.
 * Correct, composing behavior, not a bug — so assertions below check the *direction* a specific mechanism moved
 * things (a stone deck can only shrink further from a second activation, never grow back), not an exact one-
 * activation delta a real seeded round can't guarantee.
 */
const settleOneActivation = (state: GameState): GameState =>
  settle(runWave4(state, endTurn()), firstLegal, undefined, WAVE4_DEPS);

describe("Infinity Gauntlet (21129)", () => {
  it("21129.infinity-gauntlet-forced-response: with a stone in play, resolves its Special instead of drawing another", () => {
    const { state } = onlyStoneInPlay(thanosGame(2), "21131"); // Power Stone
    const deckBefore = state.scenarioDecks["Infinity Stone"]!.deck.length;
    const identity = identityOf(state, P1);
    const settled = settleOneActivation(state);
    // Power Stone's own Special ran (stunned the player) rather than the "otherwise" branch drawing a new stone —
    // the deck can only have shrunk from some *other*, later activation this round, never regrown.
    expect(inst(settled, identity).statuses.stunned ?? 0).toBeGreaterThan(0);
    expect(settled.scenarioDecks["Infinity Stone"]!.deck.length).toBeLessThanOrEqual(deckBefore);
    expect(cardsInPlay(settled)).not.toContain(instancesOf(state, "21131")[0]);
  });

  it("21129.infinity-gauntlet-forced-response: with no stone in play, puts the top card of the infinity stone deck into play", () => {
    const { state } = onlyStoneInPlay(thanosGame(2));
    const deckBefore = state.scenarioDecks["Infinity Stone"]!.deck.length;
    const settled = settleOneActivation(state);
    expect(settled.scenarioDecks["Infinity Stone"]!.deck.length).toBeLessThan(deckBefore);
  });
});

describe("Mind Stone (21130)", () => {
  it("21130.mind-stone-special: confuses you, or discards a random hand card if already confused", () => {
    const { state } = onlyStoneInPlay(thanosGame(3), "21130");
    const identity = identityOf(state, P1);
    const settled = settleOneActivation(state);
    expect(inst(settled, identity).statuses.confused ?? 0).toBeGreaterThan(0);
  });

  it("21130.mind-stone-special: already confused, discards 1 card at random from hand instead", () => {
    const staged = onlyStoneInPlay(thanosGame(3), "21130").state;
    const identity = identityOf(staged, P1);
    const confused = patchInstance(staged, identity, { statuses: { ...inst(staged, identity).statuses, confused: 1 } });
    const handBefore = confused.players[0]!.hand.length;
    const settled = settleOneActivation(confused);
    expect(settled.players[0]!.hand.length).toBeLessThan(handBefore);
  });
});

describe("Power Stone (21131)", () => {
  it("21131.power-stone-special: already stunned, takes 3 damage instead", () => {
    const staged = onlyStoneInPlay(thanosGame(2), "21131").state;
    const identity = identityOf(staged, P1);
    const stunned = patchInstance(staged, identity, { statuses: { ...inst(staged, identity).statuses, stunned: 1 } });
    const before = inst(stunned, identity).damage;
    const settled = settleOneActivation(stunned);
    expect(inst(settled, identity).damage).toBe(before + 3);
  });
});

describe("Reality Stone (21132)", () => {
  it("21132.reality-stone-special: discards an ally, upgrade, or support you control", () => {
    const state = thanosGame(2);
    const { state: withCap, id: cap } = (() => {
      const owner = state.players[0]!;
      const wanted = cardId("21011");
      const found = (id: InstanceId) => state.instances[id]?.cardId === wanted;
      const id = owner.hand.find(found) ?? owner.deck.find(found) ?? owner.discard.find(found)!;
      return {
        id,
        state: {
          ...state,
          players: state.players.map((p) =>
            p.playerId === P1
              ? {
                  ...p,
                  deck: p.deck.filter((i) => i !== id),
                  hand: p.hand.filter((i) => i !== id),
                  playArea: [...p.playArea, id],
                }
              : p,
          ),
          instances: { ...state.instances, [id]: { ...state.instances[id]!, faceup: true, controllerId: P1 } },
        },
      };
    })();
    const { state: staged } = onlyStoneInPlay(withCap, "21132");
    expect(cardsInPlay(staged)).toContain(cap);
    // Spectrum's own kit already has upgrades in play at setup (her three facedown energy-form upgrades), so the
    // ability's own choice may discard any of the eligible cards rather than specifically Captain America — this
    // checks that *one of* the eligible cards was discarded, not which one.
    const eligibleBefore = ["21011", "21002", "21003", "21004"].flatMap((code) => instancesOf(staged, code));
    const settled = settleOneActivation(staged);
    const eligibleAfter = eligibleBefore.filter((id) => cardsInPlay(settled).includes(id));
    expect(eligibleAfter.length).toBeLessThan(eligibleBefore.length);
  });
});

describe("Soul Stone (21133)", () => {
  it("21133.soul-stone-special: heals 3 damage from the villain and gives it a facedown boost card", () => {
    const state = thanosGame(4);
    const villain = villainOf(state);
    const damaged = patchInstance(state, villain, { damage: 5 });
    const { state: staged } = onlyStoneInPlay(damaged, "21133");
    const boostBefore = inst(staged, villain).boostCards.length;
    const settled = settleOneActivation(staged);
    expect(inst(settled, villain).damage).toBe(2); // 5 - 3
    expect(inst(settled, villain).boostCards.length).toBeGreaterThan(boostBefore);
  });
});

describe("Space Stone (21134)", () => {
  it("21134.space-stone-special: discards cards from the encounter deck until a minion is discarded, then puts it into play engaged with you", () => {
    const { state } = onlyStoneInPlay(thanosGame(6), "21134");
    const settled = settleOneActivation(state);
    const minionsInPlay = Object.values(settled.instances).filter((i) => i.engagedWith === P1 && "cardId" in i);
    expect(minionsInPlay.length).toBeGreaterThan(0);
  });
});

describe("Time Stone (21135)", () => {
  it("21135.time-stone-special: discards the top 4 cards of your deck, placing threat per different card type discarded", () => {
    const { state } = onlyStoneInPlay(thanosGame(1), "21135");
    const mainScheme = state.mainScheme.instanceId;
    const threatBefore = inst(state, mainScheme).threat;
    const deckBefore = state.players[0]!.deck.length;
    const settled = settleOneActivation(state);
    expect(settled.players[0]!.deck.length).toBeLessThanOrEqual(deckBefore - 4);
    expect(inst(settled, mainScheme).threat).toBeGreaterThan(threatBefore);
  });
});
