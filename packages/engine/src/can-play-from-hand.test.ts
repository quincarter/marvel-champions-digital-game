/**
 * `Predicate canPlayFromHand`: the player could play a card from hand now, paying its costs, read exactly as
 * `EffectSpec playFromHand` with the same filter and cost reduction would offer it (`playFromHandCandidates`). The gate
 * for Suggestion 61033's option "play a card that has a printed [energy] icon (paying its costs)"
 * (docs/phase7-wave11-hero-packs.md). Synthetic cards only.
 *
 * Also pinned here, the "choose one" initiation gate it feeds (`noOptionAvailable`, `resolve/target-validity.ts`): a
 * player ability that is only a "choose one" cannot be initiated when no option can be chosen and at least one of them
 * for want of a valid target (RRG 1.8 "Initiating Abilities", p. 24, step 2; "Choose (Option)", p. 12). One whose
 * options are all ruled out by their conditions alone still initiates and resolves to nothing: the RRG gates
 * initiation on targets and costs, not on an option's condition, so that case is an open engine reading.
 *
 * Sources: RRG 1.8 "Choose (Option)" (p. 12), "Initiating Abilities" (p. 24).
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "./abilities.js";
import { applyCommand } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import { evaluate } from "./select.js";
import type { EffectSpec, Predicate } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubAlly, stubSupport } from "./testing/fixtures.js";
import { RESOURCE } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const you = { kind: "controller" } as const;
const SPARK = stubAlly({ id: "spark", cost: 1, atk: 1, thw: 1, hp: 2 });
const HEAVY = stubAlly({ id: "heavy", cost: 4, atk: 1, thw: 1, hp: 2 });

const canPlay = (name: string, reduction?: number): Predicate => ({
  kind: "canPlayFromHand",
  player: you,
  filter: { name },
  ...(reduction !== undefined ? { reduction: { kind: "const", value: reduction } } : {}),
});
const playIt = (name: string): EffectSpec => ({ kind: "playFromHand", player: you, filter: { name }, optional: true });
const threatOnAScheme: readonly EffectSpec[] = [
  { kind: "chooseTarget", slot: "scheme", query: { categories: ["scheme"] }, chooser: you },
  { kind: "removeThreat", target: { kind: "slot", slot: "scheme" }, amount: { kind: "const", value: 2 } },
];
const support = (id: string, options: Extract<EffectSpec, { kind: "chooseOne" }>["options"]) => {
  const ability = stubAbility(`${id}.action`, {
    trigger: { kind: "action" },
    cost: { exhaustSelf: true },
    effects: [{ kind: "chooseOne", chooser: you, options }],
  } satisfies AbilityDefinition);
  return { card: stubSupport({ id, cost: 0, abilities: [ability.ref] }), ability };
};
/** "Exhaust → choose one: play the spark from your hand (paying its costs) / remove 2 threat from a scheme." */
const EITHER = support("either", [
  { label: "Play the spark", condition: canPlay("spark"), effects: [playIt("spark")] },
  { label: "Remove 2 threat from a scheme", effects: threatOnAScheme },
]);
/** "Exhaust → choose one: play the spark / play the heavy", each gated on being playable. */
const CONDITIONS_ONLY = support("conditions-only", [
  { label: "Play the spark", condition: canPlay("spark"), effects: [playIt("spark")] },
  { label: "Play the heavy", condition: canPlay("heavy"), effects: [playIt("heavy")] },
]);
const deps = depsOf(EITHER.ability, CONDITIONS_ONLY.ability);

/** The first turn, P1's hand exactly `hand` (by card id, taken from the deck), the main scheme at `threat`. */
function table(hand: readonly string[], threat = 0): GameState {
  let state = gameAtFirstTurn({
    cards: [SPARK, HEAVY, EITHER.card, CONDITIONS_ONLY.card],
    deps,
    deck: [SPARK.id, HEAVY.id, EITHER.card.id, CONDITIONS_ONLY.card.id],
  });
  const seat = mustPlayer(state, P1);
  const pool = [...seat.hand, ...seat.deck];
  const picked: InstanceId[] = [];
  for (const cardId of hand) {
    const id = pool.find((x) => state.instances[x]?.cardId === cardId && !picked.includes(x));
    if (!id) throw new Error(`no ${cardId}`);
    picked.push(id);
  }
  state = {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1 ? { ...p, hand: picked, deck: pool.filter((x) => !picked.includes(x)) } : p,
    ),
  };
  const main = state.mainScheme.instanceId;
  return { ...state, instances: { ...state.instances, [main]: { ...mustInstance(state, main), threat } } };
}

const holds = (state: GameState, predicate: Predicate) =>
  evaluate(state, predicate, { selfInstanceId: null, controllerId: P1, event: null, bindings: {}, deps });

function use(state: GameState, card: typeof EITHER) {
  const placed = playerCardIntoPlay(state, card.card.id);
  return applyCommand(
    placed.state,
    { type: "useAbility", playerId: P1, cardInstanceId: placed.id, abilityId: card.ability.ref.id, payment: [] },
    deps,
  );
}

describe("`Predicate canPlayFromHand`", () => {
  it("holds for a matching card the player can pay for", () => {
    expect(holds(table([SPARK.id, RESOURCE.id]), canPlay("spark"))).toBe(true);
  });

  it("control: not for a card they cannot pay for, nor for one the filter leaves out", () => {
    expect(holds(table([SPARK.id]), canPlay("spark"))).toBe(false);
    expect(holds(table([HEAVY.id, RESOURCE.id]), canPlay("heavy"))).toBe(false);
    expect(holds(table([HEAVY.id, RESOURCE.id]), canPlay("spark"))).toBe(false);
  });

  it("counts its cost reduction", () => {
    expect(holds(table([HEAVY.id, RESOURCE.id]), canPlay("heavy", 3))).toBe(true);
  });
});

describe("a player ability that is only a 'choose one'", () => {
  it("is refused when no option can be chosen and one of them lacks a valid target", () => {
    expect(use(table([SPARK.id], 0), EITHER).ok).toBe(false);
  });

  it("control: initiates with a playable card, or with threat to remove", () => {
    expect(use(table([SPARK.id, RESOURCE.id], 0), EITHER).ok).toBe(true);
    expect(use(table([SPARK.id], 3), EITHER).ok).toBe(true);
  });

  it("open reading: options ruled out by their conditions alone still let it initiate, resolving to nothing", () => {
    const result = use(table([SPARK.id, HEAVY.id], 0), CONDITIONS_ONLY);
    expect(result.ok).toBe(true);
  });
});
