import { encounterSetId } from "@mc/content";
import { activeEncounterDeck, type GameSetupConfig } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  firstLegal,
  instancesOf,
  playerOf,
  settle,
  stackEncounterDeck,
  toHero,
  endTurn,
  P1,
} from "../../../testing/harness.js";
import { startWave5Game, runWave5, WAVE5_DEPS } from "../../testing.js";
import { ghostSpiderScenario } from "../ghost-spider/support.js";

const mysterioGame = (overrides: Partial<GameSetupConfig> = {}, seed = 1) =>
  startWave5Game({
    ...ghostSpiderScenario("mysterio", { seed, modularSetIds: [encounterSetId("bomb_scare")] }),
    ...overrides,
  });

describe("Mysterio (27084-27086): Seeds of Fear / Creeping Fear / Bound by Fear", () => {
  it("27084.mysterio-constant: Mysterio (I) puts an Illusion boost card in your own discard pile, not the encounter discard", () => {
    const state = mysterioGame();
    // Humongous Hallucination (27089, Illusion, no [star] ability of its own) as Mysterio's own boost card.
    const stacked = stackEncounterDeck(state, "27089");
    const after = settle(runWave5(stacked, toHero(P1), endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
    const card = instancesOf(after, "27089")[0]!;
    expect(playerOf(after, P1).discard).toContain(card);
    expect(activeEncounterDeck(after).discard).not.toContain(card);
  });

  it("a boost card without the Illusion trait resolves normally, to the encounter discard pile", () => {
    const state = mysterioGame();
    // Advance (01186, Core Standard, no trait, no [star] ability): the ordinary boost-card destination.
    const stacked = stackEncounterDeck(state, "01186");
    const before = activeEncounterDeck(state).deck.find((id) => state.instances[id]?.cardId === "01186");
    const after = settle(runWave5(stacked, toHero(P1), endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
    expect(before).toBeDefined();
    expect(activeEncounterDeck(after).discard).toContain(before);
    expect(playerOf(after, P1).discard).not.toContain(before);
  });

  it("27085.when-revealed: Mysterio (II) starting stage shuffles the encounter deck's top card into each player's deck", () => {
    const before = mysterioGame();
    const deckBefore = playerOf(before, P1).deck.length;
    const state = mysterioGame({ villainStartStageIndex: 1, villainLastStageIndex: 1 });
    expect(playerOf(state, P1).deck.length).toBe(deckBefore + 1);
  });

  it("27085.mysterio-constant: Mysterio (II) puts an Illusion boost card on the bottom of your deck", () => {
    const state = mysterioGame({ villainStartStageIndex: 1, villainLastStageIndex: 1 });
    // Masterful Mirage prints 2 copies (quantityInSet): the one this activation actually resolves is whichever
    // `stackEncounterDeck` put on top just now, not any copy Mysterio (II)'s own starting-stage When Revealed
    // already shuffled into the deck at setup. The second stacked card (Advance, no ability of its own) is P1's own
    // dealt reveal this round, so nothing else (e.g. Déjà Vu shuffling itself into a deck) reorders the deck between
    // Masterful Mirage resolving and this assertion.
    const stacked = stackEncounterDeck(state, "27090", "01186");
    const boostCard = activeEncounterDeck(stacked).deck[0];
    const after = settle(runWave5(stacked, toHero(P1), endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
    const deck = playerOf(after, P1).deck;
    expect(deck[deck.length - 1]).toBe(boostCard);
  });

  it("27086.when-revealed: Mysterio (III) starting stage discards the top 5 cards of each player's deck", () => {
    const before = mysterioGame();
    const deckBefore = playerOf(before, P1).deck.length;
    const discardBefore = playerOf(before, P1).discard.length;
    const state = mysterioGame({ villainStartStageIndex: 2, villainLastStageIndex: 2 });
    expect(playerOf(state, P1).deck.length).toBe(deckBefore - 5);
    expect(playerOf(state, P1).discard.length).toBe(discardBefore + 5);
  });

  it("27086.mysterio-constant: Mysterio (III) puts an Illusion boost card on top of your deck", () => {
    const state = mysterioGame({ villainStartStageIndex: 2, villainLastStageIndex: 2 });
    const stacked = stackEncounterDeck(state, "27090", "01186");
    const boostCard = activeEncounterDeck(stacked).deck[0];
    const after = settle(runWave5(stacked, toHero(P1), endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
    const deck = playerOf(after, P1).deck;
    expect(deck[0]).toBe(boostCard);
  });
});
