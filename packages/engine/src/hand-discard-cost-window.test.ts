/**
 * A "discard N cards from your hand →" cost (`AbilityCost.discardFromHand`) on an interrupt or response, paid inside
 * a timing window. Synthetic cards: "Interrupt: When your turn would end, discard 1 card from your hand → deal 1
 * damage to the villain."
 *
 * Sources: RRG 1.8 "Cost" (p. 13), an ability whose cost cannot be paid cannot be triggered, and multiple costs "must
 * be paid simultaneously" (a card cannot pay two parts of one cost); "Initiating Abilities" (p. 24), step 3 determines
 * the cost before step 5 pays it.
 */
import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "./abilities.js";
import { startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubUpgrade } from "./testing/fixtures.js";
import { defaultPick } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const hitVillain = { kind: "dealDamage", target: { kind: "villain" }, amount: { kind: "const", value: 1 } } as const;
const turnEnding = { kind: "interrupt", forced: false, on: { on: "turnEnding", playerIs: "controller" } } as const;

const TOLL_INTERRUPT = stubAbility(
  "toll.interrupt",
  def({ trigger: turnEnding, cost: { discardFromHand: { min: 1, max: 1 } }, effects: [hitVillain] }),
);
const TOLL = stubUpgrade({ id: "toll", cost: 0, abilities: [TOLL_INTERRUPT.ref] });

/** The same with a resource to spend as well: the discarded card cannot also pay it. */
const LEVY_INTERRUPT = stubAbility(
  "levy.interrupt",
  def({ trigger: turnEnding, cost: { resources: 1, discardFromHand: { min: 1, max: 1 } }, effects: [hitVillain] }),
);
const LEVY = stubUpgrade({ id: "levy", cost: 0, abilities: [LEVY_INTERRUPT.ref] });

const deps = depsOf(TOLL_INTERRUPT, LEVY_INTERRUPT);
const start = (): GameState => gameAtFirstTurn({ cards: [TOLL, LEVY], deps, deck: [TOLL.id, LEVY.id] });
const villainDamage = (state: GameState): number => mustInstance(state, state.activeVillainId).damage;
const hand = (state: GameState): readonly InstanceId[] => mustPlayer(state, P1).hand;
/** P1's hand cut down to its first `size` cards (the rest to the bottom of the deck). */
function withHandOf(state: GameState, size: number): GameState {
  const seat = mustPlayer(state, P1);
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1 ? { ...p, hand: seat.hand.slice(0, size), deck: [...p.deck, ...seat.hand.slice(size)] } : p,
    ),
  };
}

interface Seen {
  readonly prompts: string[];
  readonly triggers: string[];
  readonly costOptions: string[][];
  readonly payOptions: string[][];
}
/** Ends P1's turn, taking every trigger offered; `discard` answers the hand-discard prompt, `pay` the payment. */
function endTurn(
  state: GameState,
  discard: (options: readonly string[]) => readonly string[],
  pay: (options: readonly string[]) => readonly string[] = (options) => options.slice(0, 1),
) {
  const seen: Seen = { prompts: [], triggers: [], costOptions: [], payOptions: [] };
  const pick = (current: GameState): readonly string[] => {
    const choice = current.pendingChoice;
    if (!choice) return [];
    const ids = choice.options.map((o) => o.optionId);
    seen.prompts.push(choice.prompt.kind);
    if (choice.prompt.kind === "chooseTriggers") {
      seen.triggers.push(...ids);
      return ids;
    }
    if (choice.prompt.kind === "chooseCostCards") {
      expect(choice.prompt.mode).toBe("discardFromHand");
      expect(choice.prompt.slot).toBe("discard");
      seen.costOptions.push(ids);
      return discard(ids);
    }
    if (choice.prompt.kind === "payForAbility") {
      seen.payOptions.push(ids);
      return pay(ids);
    }
    // Keep the hand as the interrupt left it: discard nothing at the end of the turn.
    if (choice.prompt.kind === "discardDownToHandSize") return ids.slice(0, choice.minSelections);
    return defaultPick(current);
  };
  const driven = driveSession(startSession(state), deps, [{ type: "endTurn", playerId: P1 }], pick);
  return { ...driven, seen, state: driven.session.state };
}
const discardPile = (state: GameState): readonly InstanceId[] => mustPlayer(state, P1).discard;

describe("a hand-discard cost on an interrupt, inside its timing window", () => {
  it("is offered, asks which card, discards the one picked and resolves", () => {
    const toll = playerCardIntoPlay(start(), TOLL.id);
    const before = withHandOf(toll.state, 3);
    const [, second] = hand(before);
    const { state, seen } = endTurn(before, (options) => options.slice(1, 2));
    expect(seen.triggers.some((id) => id.startsWith(toll.id))).toBe(true);
    expect(seen.costOptions).toEqual([hand(before)]);
    expect(discardPile(state)).toContain(second);
    expect(discardPile(state)).toHaveLength(discardPile(before).length + 1);
    expect(villainDamage(state)).toBe(villainDamage(before) + 1);
  });

  it("picking no card backs out: nothing is discarded and nothing resolves", () => {
    const toll = playerCardIntoPlay(start(), TOLL.id);
    const before = withHandOf(toll.state, 3);
    const { state, seen } = endTurn(before, () => []);
    expect(seen.prompts).toContain("chooseCostCards");
    expect(discardPile(state)).toEqual(discardPile(before));
    expect(villainDamage(state)).toBe(villainDamage(before));
  });

  it("with an empty hand the cost cannot be paid: the interrupt is not offered (RRG p. 13)", () => {
    const toll = playerCardIntoPlay(start(), TOLL.id);
    const before = withHandOf(toll.state, 0);
    const { state, seen } = endTurn(before, (options) => options.slice(0, 1));
    expect(seen.triggers.some((id) => id.startsWith(toll.id))).toBe(false);
    expect(seen.prompts).not.toContain("chooseCostCards");
    expect(villainDamage(state)).toBe(villainDamage(before));
  });

  it("the card picked for the discard is left out of the payment options, and a payment that names it is a decline", () => {
    const levy = playerCardIntoPlay(start(), LEVY.id);
    const before = withHandOf(levy.state, 2);
    const [first, second] = hand(before);
    const paid = endTurn(before, (options) => options.slice(0, 1));
    expect(paid.seen.payOptions).toEqual([[`hand:${second}`]]);
    expect(discardPile(paid.state)).toEqual(expect.arrayContaining([first, second]));
    expect(villainDamage(paid.state)).toBe(villainDamage(before) + 1);
    // Declining the payment leaves the hand as it was: the discard is part of the same cost, paid together or not at all.
    const declined = endTurn(
      before,
      (options) => options.slice(0, 1),
      () => [],
    );
    expect(discardPile(declined.state)).toEqual(discardPile(before));
    expect(villainDamage(declined.state)).toBe(villainDamage(before));
  });
});
