/**
 * docs/phase7-wave7.md §3.64: a double-sided permanent upgrade its controller flips. `RuleSpec cannotFlip`, the flip
 * cost (`AbilityCost.flipSelf`) and the restricted limit checked after a flip (§4.1 Q38 = A), with "flip each to its
 * [named] side and exhaust it" as a composed effect (§4.1 Q43 = A).
 *
 * Synthetic cards: a double-sided upgrade whose other face ("Edge") is restricted, in a permanent and an ordinary
 * printing; an ordinary restricted upgrade; supports carrying "You cannot flip your Edge upgrades".
 *
 * Sources: RRG 1.8 "'Cannot'" (p. 11), "Cost" (p. 13), "Flip" (p. 20), "Permanent" (p. 32), "Restricted" (p. 38),
 * "Target" (p. 42).
 */

import { trait, type AbilityId, type AnyCard, type CardId, type UpgradeCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityCost, EngineDeps, RuleSpec } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustInstance, mustPlayer } from "./query.js";
import { cardsInPlay, restrictedCardsOf } from "./select.js";
import type { EffectSpec, TargetQuery, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { stubEvent, stubSupport, stubUpgrade } from "./testing/fixtures.js";
import { giveCard, resolvePending } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const ENERGY = trait("Energy");
const you = { kind: "controller" } as const;
const one = { kind: "const", value: 1 } as const;
const self: TargetRef = { kind: "self" };
const PERMANENT = { name: "permanent" } as const;
const RESTRICTED = { name: "restricted" } as const;
const yourEnergy: TargetQuery = { categories: ["upgrade"], trait: ENERGY, controlledBy: you };
const each = (query: TargetQuery): TargetRef => ({ kind: "each", query });

// --- The double-sided upgrade ----------------------------------------------------------------------------------

/** "Action: Flip this card." */
const FLIP_SELF = stubAbility("blade.flip", {
  trigger: { kind: "action" },
  effects: [{ kind: "flipCard", target: self }],
});
/** "Action: Flip this card → place 1 paid counter here." */
const FLIP_COST = stubAbility("blade.flip-cost", {
  trigger: { kind: "action" },
  cost: { flipSelf: true } satisfies AbilityCost,
  effects: [{ kind: "addCounters", target: self, counterType: "paid", amount: one }],
});
const bladeAbilities = [FLIP_SELF.ref, FLIP_COST.ref];
const doubleSided = (id: string, permanent: boolean): UpgradeCard => ({
  ...stubUpgrade({ id, cost: 0, traits: [ENERGY], keywords: permanent ? [PERMANENT] : [], abilities: bladeAbilities }),
  flipSide: {
    name: "Edge",
    traits: [ENERGY],
    keywords: permanent ? [PERMANENT, RESTRICTED] : [RESTRICTED],
    text: { printed: "", current: "" },
    abilities: bladeAbilities,
  },
});
/** Permanent on both faces; its Edge face is restricted. */
const PBLADE = doubleSided("pblade", true);
/** The same card, not permanent. */
const BLADE = doubleSided("blade", false);
/** An ordinary restricted upgrade. */
const GADGET = stubUpgrade({ id: "gadget", cost: 0, keywords: [RESTRICTED] });

// --- "You cannot flip your Edge upgrades." ---------------------------------------------------------------------

const yourEdges: TargetQuery = { categories: ["upgrade"], name: "Edge", controlledBy: you };
const rules = (id: string, rule: RuleSpec): StubAbility =>
  stubAbility(id, { trigger: { kind: "constant", rules: [rule] }, effects: [] });
const LOCK_RULE = rules("lock.constant", { kind: "cannotFlip", target: yourEdges });
const LOCK = stubSupport({ id: "lock", cost: 0, abilities: [LOCK_RULE.ref] });
/** "While a switch is in play, you cannot flip your Edge upgrades." */
const SWITCHED_RULE = rules("switched.constant", {
  kind: "cannotFlip",
  target: yourEdges,
  while: { kind: "exists", query: { categories: ["support"], name: "switch" } },
});
const SWITCHED_LOCK = stubSupport({ id: "switched-lock", cost: 0, abilities: [SWITCHED_RULE.ref] });
const SWITCH = stubSupport({ id: "switch", cost: 0 });
const TRACKER = stubSupport({ id: "tracker", cost: 0 });

// --- Events that apply their effects when played ---------------------------------------------------------------

const event = (
  id: string,
  effects: readonly EffectSpec[],
): { readonly card: AnyCard; readonly ability: StubAbility } => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const picked: TargetRef = { kind: "slot", slot: "picked" };
/** "Flip each of your Energy upgrades. Place 1 seen counter on the tracker." */
const FLIP_ALL = event("flip-all", [
  { kind: "flipCard", target: each(yourEnergy) },
  { kind: "addCounters", target: { kind: "named", name: "tracker" }, counterType: "seen", amount: one },
]);
/** "Flip 1 Energy upgrade you control." */
const FLIP_ONE = event("flip-one", [
  { kind: "chooseTarget", slot: "picked", query: yourEnergy, chooser: you },
  { kind: "flipCard", target: picked },
]);
/** "Place 1 seen counter on the tracker. You may flip 1 Energy upgrade you control." */
const MAY_FLIP = event("may-flip", [
  { kind: "addCounters", target: { kind: "named", name: "tracker" }, counterType: "seen", amount: one },
  { kind: "chooseTarget", slot: "picked", query: yourEnergy, chooser: you, optional: true },
  { kind: "flipCard", target: picked },
]);
const DROP = (name: string) => event(`drop-${name}`, [{ kind: "discardFromPlay", target: { kind: "named", name } }]);
const DROP_LOCK = DROP("lock");
const DROP_SWITCH = DROP("switch");
/** "Flip each of your Energy upgrades to its Edge side and exhaust it." (§4.1 Q43 = A.) */
const TO_EDGE = event("to-edge", [
  { kind: "flipCard", target: each({ ...yourEnergy, name: PBLADE.name }) },
  { kind: "exhaust", target: each(yourEnergy) },
]);

const EVENTS = [FLIP_ALL, FLIP_ONE, MAY_FLIP, DROP_LOCK, DROP_SWITCH, TO_EDGE];
const deps: EngineDeps = depsOf(FLIP_SELF, FLIP_COST, LOCK_RULE, SWITCHED_RULE, ...EVENTS.map((e) => e.ability));
const CARDS: readonly AnyCard[] = [
  PBLADE,
  BLADE,
  GADGET,
  LOCK,
  SWITCHED_LOCK,
  SWITCH,
  TRACKER,
  ...EVENTS.map((e) => e.card),
];

// --- Helpers ---------------------------------------------------------------------------------------------------

interface Table {
  readonly state: GameState;
  /** The cards put into play, in the order asked for. */
  readonly ids: readonly InstanceId[];
}

/** p1's first turn with these cards in play; one named `"<id>:edge"` shows its Edge face. */
function table(...inPlay: readonly string[]): Table {
  let state = gameAtFirstTurn({
    cards: CARDS,
    deps,
    deck: [
      ...copiesOf(PBLADE.id, 3),
      ...copiesOf(BLADE.id, 3),
      ...copiesOf(GADGET.id, 3),
      ...[LOCK, SWITCHED_LOCK, SWITCH, TRACKER].map((card) => card.id),
      ...EVENTS.flatMap((e) => copiesOf(e.card.id, 3)),
    ],
  });
  const ids: InstanceId[] = [];
  for (const entry of inPlay) {
    const [card, face] = entry.split(":");
    const put = playerCardIntoPlay(state, card as CardId);
    state =
      face === "edge"
        ? {
            ...put.state,
            instances: { ...put.state.instances, [put.id]: { ...mustInstance(put.state, put.id), flipped: true } },
          }
        : put.state;
    ids.push(put.id);
  }
  return { state, ids };
}

const ok = (
  state: GameState,
  command: Command,
): { readonly state: GameState; readonly events: readonly GameEvent[] } => {
  const result = applyCommand(state, command, deps);
  if (!result.ok) throw new Error(`${command.type} rejected: ${result.error.message}`);
  return { state: result.state, events: result.events };
};
const playCommand = (cardInstanceId: InstanceId): Command => ({
  type: "playCard",
  playerId: P1,
  cardInstanceId,
  payment: [],
  attachToInstanceId: null,
});
/** Hands p1 the event and plays it for 0; a choice it opens is left pending. */
function play(state: GameState, card: { readonly card: AnyCard }) {
  const given = giveCard(state, P1, card.card.id);
  return ok(given.state, playCommand(given.id));
}
const useCommand = (cardInstanceId: InstanceId, ability: StubAbility): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId,
  abilityId: ability.ref.id,
  payment: [],
});
const flipped = (state: GameState, id: InstanceId): boolean => mustInstance(state, id).flipped;
const exhausted = (state: GameState, id: InstanceId): boolean => mustInstance(state, id).exhausted;
const counters = (state: GameState, id: InstanceId, type: string): number =>
  mustInstance(state, id).counters[type] ?? 0;
const ofType = (events: readonly GameEvent[], type: GameEvent["type"]) => events.filter((e) => e.type === type);
/** Whether `legalActions` offers p1 this ability of this card. */
function offered(state: GameState, id: InstanceId, abilityId: AbilityId): boolean {
  const actions = legalActions(state, P1, deps);
  if (actions.kind !== "turn") throw new Error(`expected a turn, got ${actions.kind}`);
  return actions.legal.some(
    ({ action }) => action.kind === "useAbility" && action.instanceId === id && action.abilityId === abilityId,
  );
}
/** Whether `legalActions` offers p1 playing this card from hand. */
function playable(state: GameState, id: InstanceId): boolean {
  const actions = legalActions(state, P1, deps);
  if (actions.kind !== "turn") throw new Error(`expected a turn, got ${actions.kind}`);
  return actions.legal.some(({ action }) => action.kind === "playCard" && action.instanceId === id);
}
const optionIds = (state: GameState): readonly string[] => state.pendingChoice?.options.map((o) => o.optionId) ?? [];

// --- Tests -----------------------------------------------------------------------------------------------------

describe("§3.64 a flip keeps the card's state and shows its other face", () => {
  it("a flipped player upgrade keeps its exhausted state and counters, and reads its other face's name and keywords", () => {
    const { state: start, ids } = table("pblade");
    const blade = ids[0]!;
    const marked: GameState = {
      ...start,
      instances: {
        ...start.instances,
        [blade]: { ...mustInstance(start, blade), exhausted: true, counters: { charge: 2 } },
      },
    };
    expect(restrictedCardsOf(marked, P1, deps)).toEqual([]);

    const { state, events } = ok(marked, useCommand(blade, FLIP_SELF));
    expect(flipped(state, blade)).toBe(true);
    expect(exhausted(state, blade)).toBe(true);
    expect(counters(state, blade, "charge")).toBe(2);
    expect(restrictedCardsOf(state, P1, deps)).toEqual([blade]);
    expect(ofType(events, "cardFlipped")).toEqual([{ type: "cardFlipped", instanceId: blade, flipped: true }]);
    expect(state.pendingChoice).toBeNull();
  });
});

describe("§3.64 RuleSpec cannotFlip", () => {
  it("an effect flips every card but the one the rule names, logs that one as blocked, and resolves the rest", () => {
    const { state: start, ids } = table("lock", "tracker", "pblade:edge", "pblade");
    const [, tracker, edge, blade] = ids as [InstanceId, InstanceId, InstanceId, InstanceId];

    const { state, events } = play(start, FLIP_ALL);
    // The Edge stays an Edge; the other face, which the rule does not name, flips to Edge.
    expect(flipped(state, edge)).toBe(true);
    expect(flipped(state, blade)).toBe(true);
    expect(ofType(events, "flipBlocked")).toEqual([{ type: "flipBlocked", instanceId: edge }]);
    expect(ofType(events, "cardFlipped")).toEqual([{ type: "cardFlipped", instanceId: blade, flipped: true }]);
    expect(counters(state, tracker, "seen")).toBe(1);

    // Now both are Edges: nothing flips, the rest still resolves.
    const again = play(state, FLIP_ALL);
    expect([flipped(again.state, edge), flipped(again.state, blade)]).toEqual([true, true]);
    expect(ofType(again.events, "flipBlocked")).toHaveLength(2);
    expect(ofType(again.events, "cardFlipped")).toEqual([]);
    expect(counters(again.state, tracker, "seen")).toBe(2);
  });

  it("without the rule the same effect flips both", () => {
    const { state: start, ids } = table("tracker", "pblade:edge", "pblade");
    const { state, events } = play(start, FLIP_ALL);
    expect([flipped(state, ids[1]!), flipped(state, ids[2]!)]).toEqual([false, true]);
    expect(ofType(events, "flipBlocked")).toEqual([]);
  });

  it("an ability that only flips a card that cannot flip is not offered and is refused; its other face's is offered", () => {
    const { state, ids } = table("lock", "pblade:edge", "pblade");
    const [, edge, blade] = ids as [InstanceId, InstanceId, InstanceId];
    expect(offered(state, edge, FLIP_SELF.ref.id)).toBe(false);
    expect(offered(state, blade, FLIP_SELF.ref.id)).toBe(true);
    const refused = applyCommand(state, useCommand(edge, FLIP_SELF), deps);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error.code).toBe("no_valid_target");
  });

  it("a choice of a card to flip offers only cards that can flip, and cannot be initiated with none", () => {
    const mixed = table("lock", "pblade:edge", "pblade");
    const [, , blade] = mixed.ids as [InstanceId, InstanceId, InstanceId];
    // One candidate left: the choice resolves on it without asking, as a single-candidate choice does.
    const chosen = play(mixed.state, FLIP_ONE);
    const settled = chosen.state.pendingChoice
      ? resolvePending(chosen.state, optionIds(chosen.state), deps)
      : chosen.state;
    expect(optionIds(chosen.state)).not.toContain(mixed.ids[1]);
    expect(flipped(settled, blade)).toBe(true);
    expect(flipped(settled, mixed.ids[1]!)).toBe(true);

    const none = table("lock", "pblade:edge");
    const card = giveCard(none.state, P1, FLIP_ONE.card.id);
    expect(playable(card.state, card.id)).toBe(false);
    expect(applyCommand(card.state, playCommand(card.id), deps).ok).toBe(false);
    // Without the rule the same card is playable.
    const free = table("pblade:edge");
    const freeCard = giveCard(free.state, P1, FLIP_ONE.card.id);
    expect(playable(freeCard.state, freeCard.id)).toBe(true);
  });

  it("a 'you may flip' with no card that can flip is not asked; the rest of the ability resolves", () => {
    const { state: start, ids } = table("lock", "tracker", "pblade:edge");
    const [, tracker, edge] = ids as [InstanceId, InstanceId, InstanceId];
    const { state, events } = play(start, MAY_FLIP);
    expect(state.pendingChoice).toBeNull();
    expect(counters(state, tracker, "seen")).toBe(1);
    expect(flipped(state, edge)).toBe(true);
    expect(ofType(events, "cardFlipped")).toEqual([]);

    // Without the rule the player is asked, and may flip it.
    const free = table("tracker", "pblade:edge");
    const asked = play(free.state, MAY_FLIP);
    expect(optionIds(asked.state)).toContain(free.ids[1]);
    expect(flipped(resolvePending(asked.state, [free.ids[1]!], deps), free.ids[1]!)).toBe(false);
  });

  it("a flip cost cannot be paid by a card that cannot flip (RRG 1.8 'Cost', p. 13)", () => {
    const { state, ids } = table("lock", "pblade:edge", "pblade");
    const [, edge, blade] = ids as [InstanceId, InstanceId, InstanceId];
    expect(offered(state, edge, FLIP_COST.ref.id)).toBe(false);
    const refused = applyCommand(state, useCommand(edge, FLIP_COST), deps);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error.code).toBe("no_valid_target");

    // The face the rule does not name pays it: flipped, announced, and the effect resolves.
    expect(offered(state, blade, FLIP_COST.ref.id)).toBe(true);
    const paid = ok(state, useCommand(blade, FLIP_COST));
    expect(flipped(paid.state, blade)).toBe(true);
    expect(counters(paid.state, blade, "paid")).toBe(1);
    expect(ofType(paid.events, "cardFlipped")).toEqual([{ type: "cardFlipped", instanceId: blade, flipped: true }]);
    // Now an Edge, it cannot pay again.
    expect(offered(paid.state, blade, FLIP_COST.ref.id)).toBe(false);
  });

  it("the rule ends when its card leaves play", () => {
    const { state: start, ids } = table("lock", "pblade:edge");
    const edge = ids[1]!;
    expect(offered(start, edge, FLIP_SELF.ref.id)).toBe(false);
    const { state } = play(start, DROP_LOCK);
    expect(cardsInPlay(state)).not.toContain(ids[0]);
    expect(offered(state, edge, FLIP_SELF.ref.id)).toBe(true);
    expect(flipped(ok(state, useCommand(edge, FLIP_SELF)).state, edge)).toBe(false);
  });

  it("the rule applies only while its condition holds", () => {
    const { state: start, ids } = table("switched-lock", "switch", "pblade:edge");
    const edge = ids[2]!;
    expect(offered(start, edge, FLIP_SELF.ref.id)).toBe(false);
    expect(offered(start, edge, FLIP_COST.ref.id)).toBe(false);
    const { state } = play(start, DROP_SWITCH);
    expect(offered(state, edge, FLIP_SELF.ref.id)).toBe(true);
    expect(offered(state, edge, FLIP_COST.ref.id)).toBe(true);
  });
});

describe("§3.64 the restricted limit after a flip (Q38 = A)", () => {
  it("a flip to a third restricted face asks its controller to discard one, offering only cards that can leave play", () => {
    const { state: start, ids } = table("gadget", "gadget", "pblade");
    const [first, second, blade] = ids as [InstanceId, InstanceId, InstanceId];
    const { state } = ok(start, useCommand(blade, FLIP_SELF));
    const choice = state.pendingChoice;
    expect(choice?.playerId).toBe(P1);
    expect(choice?.prompt).toEqual({ kind: "discardRestricted", limit: 2 });
    expect(optionIds(state)).toEqual([first, second]);
    expect([choice?.minSelections, choice?.maxSelections]).toEqual([1, 1]);
    // The permanent card is no legal answer.
    const wrong = applyCommand(
      state,
      { type: "resolveChoice", playerId: P1, choiceId: choice!.choiceId, selectedOptionIds: [blade] },
      deps,
    );
    expect(wrong.ok).toBe(false);

    const after = resolvePending(state, [first], deps);
    expect(after.pendingChoice).toBeNull();
    expect(mustPlayer(after, P1).discard).toContain(first);
    expect(restrictedCardsOf(after, P1, deps)).toEqual([second, blade]);
    expect(flipped(after, blade)).toBe(true);
  });

  it("a card that is not permanent is offered with the others when its own flip takes its controller past the limit", () => {
    const { state: start, ids } = table("gadget", "gadget", "blade");
    const { state } = ok(start, useCommand(ids[2]!, FLIP_SELF));
    expect(optionIds(state)).toEqual(ids);
    const after = resolvePending(state, [ids[2]!], deps);
    expect(restrictedCardsOf(after, P1, deps)).toEqual([ids[0], ids[1]]);
    expect(cardsInPlay(after)).not.toContain(ids[2]);
  });

  it("the flip cost is checked the same way", () => {
    const { state: start, ids } = table("gadget", "gadget", "pblade");
    const { state } = ok(start, useCommand(ids[2]!, FLIP_COST));
    expect(state.pendingChoice?.prompt).toEqual({ kind: "discardRestricted", limit: 2 });
    expect(optionIds(state)).toEqual([ids[0], ids[1]]);
    // The discard comes before the paid-for effect, which then resolves.
    const after = resolvePending(state, [ids[1]!], deps);
    expect(counters(after, ids[2]!, "paid")).toBe(1);
    expect(restrictedCardsOf(after, P1, deps)).toEqual([ids[0], ids[2]]);
  });

  it("with two permanent restricted faces and one ordinary restricted card, only the ordinary one is offered", () => {
    const { state: start, ids } = table("pblade:edge", "gadget", "pblade");
    const [edge, gadget, blade] = ids as [InstanceId, InstanceId, InstanceId];
    const { state } = ok(start, useCommand(blade, FLIP_SELF));
    expect(optionIds(state)).toEqual([gadget]);
    expect([state.pendingChoice?.minSelections, state.pendingChoice?.maxSelections]).toEqual([1, 1]);
    const after = resolvePending(state, [gadget], deps);
    expect(restrictedCardsOf(after, P1, deps)).toEqual([edge, blade]);
    expect(mustPlayer(after, P1).discard).toContain(gadget);
  });

  it("with three permanent restricted faces nobody is asked and the game continues over the limit", () => {
    const { state: start, ids } = table("tracker", "pblade", "pblade", "pblade");
    const blades = ids.slice(1);
    const all = play(start, FLIP_ALL);
    expect(all.state.pendingChoice).toBeNull();
    expect(restrictedCardsOf(all.state, P1, deps)).toEqual(blades);
    expect(counters(all.state, ids[0]!, "seen")).toBe(1);
    expect(ofType(all.events, "leavePlayBlocked")).toEqual([]);

    // More commands run with the three still showing: no prompt, no loop, no throw.
    const paid = ok(all.state, useCommand(blades[0]!, FLIP_COST));
    expect(paid.state.pendingChoice).toBeNull();
    expect(restrictedCardsOf(paid.state, P1, deps)).toEqual(blades.slice(1));
    const back = ok(paid.state, useCommand(blades[0]!, FLIP_SELF));
    expect(back.state.pendingChoice).toBeNull();
    expect(restrictedCardsOf(back.state, P1, deps)).toEqual(blades);
    const ended = ok(back.state, { type: "endTurn", playerId: P1 });
    expect(ended.state.pendingChoice?.prompt.kind).not.toBe("discardRestricted");
    expect(blades.every((id) => cardsInPlay(ended.state).includes(id))).toBe(true);
  });

  it.todo(
    "one effect taking two players past the limit asks both: only one choice can be open, so only the first is asked",
  );

  it("flipping back below the limit asks nothing", () => {
    const { state: start, ids } = table("pblade:edge", "pblade:edge", "pblade:edge");
    const { state } = ok(start, useCommand(ids[0]!, FLIP_SELF));
    expect(state.pendingChoice).toBeNull();
    expect(restrictedCardsOf(state, P1, deps)).toEqual([ids[1], ids[2]]);
    // …and neither does a flip that leaves the player at exactly two.
    const two = table("gadget", "pblade");
    const atLimit = ok(two.state, useCommand(two.ids[1]!, FLIP_SELF));
    expect(atLimit.state.pendingChoice).toBeNull();
    expect(restrictedCardsOf(atLimit.state, P1, deps)).toEqual(two.ids);
  });
});

describe("§3.64 'flip each to its Edge side and exhaust it' (Q43 = A)", () => {
  it("one already showing Edge is not flipped and is exhausted; the other flips and is exhausted", () => {
    // The rule is in play as the effect resolves, as its obligation is; it names only the Edge face.
    const { state: start, ids } = table("lock", "pblade:edge", "pblade");
    const [, edge, blade] = ids as [InstanceId, InstanceId, InstanceId];
    const { state, events } = play(start, TO_EDGE);
    expect([flipped(state, edge), flipped(state, blade)]).toEqual([true, true]);
    expect([exhausted(state, edge), exhausted(state, blade)]).toEqual([true, true]);
    expect(ofType(events, "cardFlipped")).toEqual([{ type: "cardFlipped", instanceId: blade, flipped: true }]);
    expect(ofType(events, "flipBlocked")).toEqual([]);
    expect(state.pendingChoice).toBeNull();
    // Neither can be flipped back while the rule lasts.
    expect(offered(state, edge, FLIP_SELF.ref.id)).toBe(false);
    expect(offered(state, blade, FLIP_SELF.ref.id)).toBe(false);
  });
});
