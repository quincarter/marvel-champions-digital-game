import { describe, expect, it } from "vitest";
import { SILK_CARDS } from "@mc/content";
import { activeEncounterDeckId, applyCommand, legalActions, type GameState, type InstanceId } from "@mc/engine";
import {
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  P1,
  patchInstance,
  play,
  playerOf,
  runWith,
  settle,
  toHero,
  type Picker,
} from "../../testing/harness.js";
import { encounterCardInVillainArea } from "../../testing/staging.js";
import { WAVE5_CARDS } from "../cards.js";
import { runWave5, startWave5Game, WAVE5_DEPS } from "../testing.js";
import { spdrScenarioWithExtras } from "../spdr/support.js";

const QUICK_QUIP = SILK_CARDS.find((card) => card.id === "52034")!;

/** SP//dr (her hero form is a Web-Warrior character) vs Rhino, with Quick Quip added to her deck and the card pool. */
function spdrWithQuickQuip(): GameState {
  const config = spdrScenarioWithExtras("rhino", { seed: 3, extraCodes: ["52034"] });
  return runWave5(startWave5Game({ ...config, cards: [...config.cards, QUICK_QUIP] }), toHero(P1));
}

/** The first minion in the encounter deck, put into play engaged with P1 (surgery: no reveal, no When Revealed). */
function engagedMinion(state: GameState): { readonly state: GameState; readonly id: InstanceId } {
  const types = new Map(WAVE5_CARDS.map((card) => [card.id as string, card.type]));
  const pile = state.encounterDecks[activeEncounterDeckId(state)]!;
  const code = pile.deck.map((id) => inst(state, id).cardId as string).find((c) => types.get(c) === "minion");
  if (!code) throw new Error("no minion in the encounter deck");
  const placed = encounterCardInVillainArea(state, code);
  return { state: patchInstance(placed.state, placed.id, { engagedWith: P1, controllerId: null }), id: placed.id };
}

/** Quick Quip in hand, and its payment: 2 other hand cards, one of them Thwip Thwip! for Requirement ([mental]). */
function inHandWithPayment(state: GameState): {
  readonly state: GameState;
  readonly id: InstanceId;
  readonly pay: readonly InstanceId[];
} {
  const given = moveToHand(state, P1, "52034", "31017");
  const [id, mental] = given.ids as [InstanceId, InstanceId];
  const other = playerOf(given.state, P1).hand.find((card) => card !== id && card !== mental)!;
  return { state: given.state, id, pay: [mental, other] };
}

describe("Quick Quip (silk 52034), scripted in wave 5 beside Thwip Thwip!", () => {
  it("52034.quick-quip-action: deals exactly 1 damage to SP//dr, then places 1 confused card on each of two enemies", () => {
    const { state: table, id: minion } = engagedMinion(spdrWithQuickQuip());
    const identity = identityOf(table, P1);
    const villain = table.villains[0]!.instanceId;
    const { state: given, id, pay } = inHandWithPayment(table);
    const before = inst(given, identity).damage;
    let offered: readonly string[] = [];
    const pick: Picker = (s) => {
      if (s.pendingChoice?.prompt.kind !== "divide") return firstLegal(s);
      offered = s.pendingChoice.options.map((o) => o.optionId);
      return [`${villain}#1`, `${minion}#1`];
    };
    const state = settle(runWith(WAVE5_DEPS, given, play(P1, id, pay)), pick, undefined, WAVE5_DEPS);
    expect(inst(state, identity).damage).toBe(before + 1);
    expect(inst(state, villain).statuses.confused).toBe(1);
    expect(inst(state, minion).statuses.confused).toBe(1);
    expect(inst(state, villain).statuses.stunned).toBe(0);
    expect(offered).toEqual([`${villain}#1`, `${minion}#1`]); // one confused card each, at most
  });

  it("52034.quick-quip-action: not offered, and refused, while SP//dr holds a tough status card (no one can take the damage)", () => {
    const hero = spdrWithQuickQuip();
    const identity = identityOf(hero, P1);
    const tough = patchInstance(hero, identity, { statuses: { ...inst(hero, identity).statuses, tough: 1 } });
    const { state: given, id, pay } = inHandWithPayment(tough);
    const refused = applyCommand(given, play(P1, id, pay), WAVE5_DEPS);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error.message).toMatch(/cannot take all of this cost's damage/); // the cost, not the payment
    const actions = legalActions(given, P1, WAVE5_DEPS);
    if (actions.kind !== "turn") throw new Error(`expected a turn, got ${actions.kind}`);
    expect(actions.legal.some((a) => a.action.kind === "playCard" && a.action.instanceId === id)).toBe(false);
  });
});
