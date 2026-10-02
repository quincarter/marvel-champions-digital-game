import { cardId, encounterSetId } from "@mc/content";
import { activeEncounterDeckId, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  endTurn,
  identityOf,
  instancesOf,
  playerOf,
  stackEncounterDeck,
  toHero,
  P1,
} from "../../../testing/harness.js";
import { driveEvents } from "../../../testing/staging.js";
import { startWave5Game, WAVE5_DEPS } from "../../testing.js";
import { ghostSpiderScenario } from "../ghost-spider/support.js";

/**
 * Regression for engine commit 0d89f5ba (a quickstrike granted by a constant ability is read when a minion engages).
 *
 * Symbiotic Berserker (`sm` 27121, MC27): "[star] While a symbiote environment is in play, Symbiotic Berserker gains
 * quickstrike." RRG 1.8 "Quickstrike" (p. 36): after a minion with quickstrike engages a player whose identity is in
 * hero form, that minion attacks that player. Festering Mass (27124) is the set's own [Symbiote] environment.
 */
const SEED = 7;
const venomGoblin = (): GameState =>
  startWave5Game(ghostSpiderScenario("venom-goblin", { seed: SEED, modularSetIds: [encounterSetId("bomb_scare")] }));

/** Festering Mass into play in the villain area (test surgery, the sibling test's own shape). */
function withFesteringMass(state: GameState): GameState {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const id = [...pile.deck, ...pile.discard].find((i) => state.instances[i]?.cardId === cardId("27124"))!;
  return {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [deckId]: { deck: pile.deck.filter((i) => i !== id), discard: pile.discard.filter((i) => i !== id) },
    },
    villainArea: [...state.villainArea, id],
    instances: { ...state.instances, [id]: { ...state.instances[id]!, faceup: true } },
  };
}

/**
 * The Berserker is dealt to P1 as their encounter card (a Standard treachery, 01186, is the villain's boost card
 * ahead of it); returns how many attacks it made and whom it engaged.
 */
function revealBerserker(opts: { environment: boolean; hero: boolean }) {
  let state = venomGoblin();
  if (opts.environment) state = withFesteringMass(state);
  const staged = stackEncounterDeck(state, "01186", "27121");
  const { state: after, events } = driveEvents(WAVE5_DEPS, staged, ...(opts.hero ? [toHero(P1)] : []), endTurn(P1));
  const berserker: InstanceId = instancesOf(after, "27121").find((i) => playerOf(after, P1).playArea.includes(i))!;
  expect(berserker).toBeDefined();
  const attacks = events.filter((e) => e.type === "attackResolved" && e.enemyInstanceId === berserker);
  return { attacks, identity: identityOf(after, P1) };
}

describe("Symbiotic Berserker (27121) granted quickstrike at engagement (RRG 1.8 p. 36)", () => {
  it("with a Symbiote environment in play it attacks the hero it engages exactly once", () => {
    const { attacks, identity } = revealBerserker({ environment: true, hero: true });
    expect(attacks).toHaveLength(1);
    expect(attacks[0]).toMatchObject({ targetInstanceId: identity, baseAtk: 3 });
  });

  it("it does not attack as it engages a player in alter-ego form, environment or not", () => {
    expect(revealBerserker({ environment: true, hero: false }).attacks).toHaveLength(0);
  });

  it("control: without the environment it engages in hero form and does not attack", () => {
    expect(revealBerserker({ environment: false, hero: true }).attacks).toHaveLength(0);
  });
});
