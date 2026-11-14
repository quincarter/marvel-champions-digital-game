import { activeEncounterDeck, type GameEvent, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { validateDefinition } from "../../dsl/validate.js";
import { P1, applyOk, endTurn, identityOf, inst, patchInstance } from "../../testing/harness.js";
import { ELEKTRA_JUSTICE as REGISTRY, ELEKTRA_JUSTICE_SKIPPED as SKIPPED } from "./justice.js";
import { WAVE11_DEPS as DEPS } from "../index.js";
import { ADVANCE, SPIDER_MAN_JUSTICE, accepting, drive, elektraAspectGame } from "./aspect-testing.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Wave 11 `elektra/justice`: the Linked treacheries Backstab 63035, Misdirect 63036 and Sabotage 63037 (Double-Cross
 * 63034 is skipped: it needs an engine primitive). Played against Core's Rhino: the card is a Core treachery retagged
 * (surgery) and stacked, once as the card revealed in the villain phase and once as Rhino's boost card.
 */
const BACKSTAB = "63035";
const MISDIRECT = "63036";
const SABOTAGE = "63037";

const base = (): GameState => elektraAspectGame("01088", SPIDER_MAN_JUSTICE);
const villainOf = (s: GameState): InstanceId => s.villains[0]!.instanceId;
/** The villain phase with the encounter deck's top cards retagged as `top` (the first is Rhino's boost card). */
function villainPhase(state: GameState, ...top: readonly string[]): GameState {
  const deck = activeEncounterDeck(state).deck;
  const retagged = top.reduce((s, code, i) => patchInstance(s, deck[i]!, { cardId: code as never }), state);
  return drive(retagged, accepting(), endTurn(P1));
}
/** Every event of the same villain phase, answering optional triggers yes and everything else with the first choice. */
function villainPhaseEvents(state: GameState, ...top: readonly string[]): readonly GameEvent[] {
  const deck = activeEncounterDeck(state).deck;
  const retagged = top.reduce((s, code, i) => patchInstance(s, deck[i]!, { cardId: code as never }), state);
  let result = applyOk(retagged, endTurn(P1), DEPS);
  const events = [...result.events];
  while (result.state.pendingChoice) {
    const choice = result.state.pendingChoice;
    const selected =
      choice.prompt.kind === "chooseTriggers" ? choice.options.map((o) => o.optionId) : accepting()(result.state);
    result = applyOk(
      result.state,
      {
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: selected,
      } as never,
      DEPS,
    );
    events.push(...result.events);
  }
  return events;
}
const deckSize = (s: GameState) => activeEncounterDeck(s).deck.length;

describe("registry", () => {
  it("registers the three treacheries, skips only Double-Cross, and each validates", () => {
    expect(Object.keys(SKIPPED)).toEqual(["63034.when-defeated"]);
    expect(SKIPPED["63034.when-defeated"]).toContain("needs engine primitive");
    expect(Object.keys(REGISTRY).sort()).toEqual(
      [
        "63035.when-revealed",
        "63035.boost",
        "63036.when-revealed",
        "63036.boost",
        "63037.when-revealed",
        "63037.boost",
      ].sort(),
    );
    for (const id of Object.keys(REGISTRY)) expect(validateDefinition(REGISTRY[id]!), id).toEqual([]);
  });
});

describe("63035 Backstab", () => {
  it("When Revealed: deals 4 damage to the villain and gains surge (one more card is revealed)", () => {
    const state = base();
    const plain = villainPhase(state, ADVANCE, ADVANCE, ADVANCE);
    const after = villainPhase(state, ADVANCE, BACKSTAB, ADVANCE);
    expect(inst(after, villainOf(after)).damage - inst(plain, villainOf(plain)).damage).toBe(4);
    expect(deckSize(plain) - deckSize(after)).toBe(1); // surge revealed one more card
  });

  it("Boost, with the villain attacking: deals 2 damage to the activating enemy", () => {
    const state = base();
    const plain = villainPhase(state, ADVANCE, ADVANCE, ADVANCE);
    const after = villainPhase(state, BACKSTAB, ADVANCE, ADVANCE);
    expect(inst(after, villainOf(after)).damage - inst(plain, villainOf(plain)).damage).toBe(2);
  });

  it("Boost: with no enemy activating it gains two boost icons instead (the ability reads the activation)", () => {
    const text = JSON.stringify(REGISTRY["63035.boost"]);
    expect(text).toContain("adjustBoostCount");
    expect(text).toContain("activatingEnemy");
  });
});

describe("63036 Misdirect", () => {
  it("When Revealed: heals 4 damage from an identity and gains surge", () => {
    const state = base();
    const hero = identityOf(state);
    const hurt = patchInstance(state, hero, { damage: 6 });
    const plain = villainPhase(hurt, ADVANCE, ADVANCE, ADVANCE);
    const after = villainPhase(hurt, ADVANCE, MISDIRECT, ADVANCE);
    expect(inst(plain, hero).damage - inst(after, hero).damage).toBe(4);
  });

  it("Boost: stuns an enemy", () => {
    const state = base();
    const events = villainPhaseEvents(state, MISDIRECT, ADVANCE, ADVANCE);
    expect(events).toContainEqual(
      expect.objectContaining({ type: "statusGiven", instanceId: villainOf(state), status: "stunned" }),
    );
  });
});

describe("63037 Sabotage", () => {
  it("When Revealed: removes 3 threat from the main scheme and gains surge", () => {
    const state = patchInstance(base(), base().mainScheme.instanceId, { threat: 5 });
    const events = villainPhaseEvents(state, ADVANCE, SABOTAGE, ADVANCE);
    expect(events).toContainEqual(
      expect.objectContaining({ type: "threatRemoved", schemeInstanceId: state.mainScheme.instanceId, amount: 3 }),
    );
    expect(events.filter((e) => e.type === "surgeTriggered")).toHaveLength(1);
  });

  it("Boost: confuses an enemy", () => {
    const state = base();
    const events = villainPhaseEvents(state, SABOTAGE, ADVANCE, ADVANCE);
    expect(events).toContainEqual(
      expect.objectContaining({ type: "statusGiven", instanceId: villainOf(state), status: "confused" }),
    );
  });
});
