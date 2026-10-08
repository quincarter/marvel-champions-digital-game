/**
 * docs/phase7-wave8.md §3.63: an additional cost to change form (`RuleSpec formChangeCost`). A synthetic support shaped
 * like the obligation that prints it ("As an additional cost to change to hero form during your turn, you must spend 2
 * resources of the same type"), and one that taxes every change at any time, to tell the two limits apart.
 *
 * Sources: RRG 1.8 "Cost" (p. 14: an additional cost is paid with the cost it is added to, and unpaid "the effect
 * associated with the costs does not occur"; p. 13: overpaying is legal), "Form, Change Form" (p. 21: once each
 * round; a change by a card ability does not count against it), "Wild Resource" (p. 48). §4.2 Q37 = A: a change the
 * player makes on their own turn, by the option or by an ability of a card they control, is theirs to pay for; a
 * change an encounter card forces costs nothing and happens.
 *
 * Synthetic cards only; the engine never names a card.
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityCost, EngineDeps, RuleSpec } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { legalActions, paymentFor, tryPayment, type ActionRef } from "./legal.js";
import { mustPlayer } from "./query.js";
import { formChangeCostsFor } from "./rules.js";
import type { Form, GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubResource, stubSideScheme, stubSupport, stubTreachery } from "./testing/fixtures.js";
import { defaultPick, fromHand, giveCards } from "./testing/scenario.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  onTopOfEncounterDeck,
  P1,
  playerCardIntoPlay,
} from "./testing/wave3.js";

const you = { kind: "controller" } as const;
const TWO_OF_A_TYPE: AbilityCost = { resources: 2, sameResourceType: true };

const constant = (id: string, rules: readonly RuleSpec[]) =>
  stubAbility(id, { trigger: { kind: "constant", rules }, effects: [] });

/** "As an additional cost to change to hero form during your turn, you must spend 2 resources of the same type." */
const CURFEW_COST = constant("curfew.constant", [
  { kind: "formChangeCost", player: you, to: "hero", during: "ownTurn", cost: TWO_OF_A_TYPE },
]);
const CURFEW = stubSupport({ id: "curfew", cost: 0, abilities: [CURFEW_COST.ref] });

/** "As an additional cost to change form, spend 1 resource": every change, at any time. */
const TOLL_COST = constant("toll.constant", [{ kind: "formChangeCost", player: you, cost: { resources: 1 } }]);
const TOLL = stubSupport({ id: "toll", cost: 0, abilities: [TOLL_COST.ref] });

/** The player's own card: "Action: Change form." */
const SWITCH_ACTION = stubAbility("switch.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "changeForm", player: you }],
});
const SWITCH = stubSupport({ id: "switch", cost: 0, abilities: [SWITCH_ACTION.ref] });

/** The player's own card, outside their turn: "Forced Interrupt: When threat is placed, change to hero form." */
const ALARM_INTERRUPT = stubAbility("alarm.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "placeThreat" } },
  effects: [{ kind: "changeForm", player: you, to: "hero" }],
});
const ALARM = stubSupport({ id: "alarm", cost: 0, abilities: [ALARM_INTERRUPT.ref] });

/** An encounter card any player may trigger: "Action: Change to hero form." */
const LEVER_ACTION = stubAbility("lever.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "changeForm", player: you, to: "hero" }],
});
const LEVER = stubSideScheme({ id: "lever", startingThreat: 3, abilities: [LEVER_ACTION.ref] });

/** "When Revealed: Change to alter-ego form." */
const SENT_HOME_REVEAL = stubAbility("sent-home.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [{ kind: "changeForm", player: you, to: "alterEgo" }],
});
const SENT_HOME = stubTreachery({ id: "sent-home", boostIcons: 0, abilities: [SENT_HOME_REVEAL.ref] });

const ENERGY = stubResource({ id: "energy", icons: 0, produces: { energy: 1 } });
const MENTAL = stubResource({ id: "mental", icons: 0, produces: { mental: 1 } });
const WILD = stubResource({ id: "wild", icons: 1 });

const deps: EngineDeps = depsOf(CURFEW_COST, TOLL_COST, SWITCH_ACTION, ALARM_INTERRUPT, LEVER_ACTION, SENT_HOME_REVEAL);

const CHANGE: ActionRef = { kind: "changeForm" };

interface Table {
  readonly state: GameState;
  /** The hand, in the order asked for. */
  readonly hand: readonly InstanceId[];
  /** The supports put into play, by card id. */
  readonly inPlay: Readonly<Record<string, InstanceId>>;
}

/** The first turn, in `form`, with these supports in play and exactly this hand. */
function table(supports: readonly CardId[], hand: readonly CardId[], form: Form = "alterEgo"): Table {
  let state = gameAtFirstTurn({
    cards: [CURFEW, TOLL, SWITCH, ALARM, LEVER, SENT_HOME, ENERGY, MENTAL, WILD],
    deps,
    encounter: [LEVER.id, SENT_HOME.id, ...copiesOf(SENT_HOME.id, 6)],
    deck: [
      CURFEW.id,
      TOLL.id,
      SWITCH.id,
      ALARM.id,
      ...copiesOf(ENERGY.id, 3),
      ...copiesOf(MENTAL.id, 2),
      ...copiesOf(WILD.id, 2),
    ],
  });
  // The opening hand goes under the deck, so the hand is only what the test deals.
  state = {
    ...state,
    players: state.players.map((p) => ({
      ...p,
      hand: [],
      deck: [...p.deck, ...p.hand],
      identity: { ...p.identity, form },
    })),
  };
  const inPlay: Record<string, InstanceId> = {};
  for (const card of supports) {
    const placed = playerCardIntoPlay(state, card);
    state = placed.state;
    inPlay[card] = placed.id;
  }
  const dealt = giveCards(state, P1, ...hand);
  return { state: dealt.state, hand: dealt.ids, inPlay };
}

const formOf = (state: GameState): Form => mustPlayer(state, P1).identity.form;
const changeOf = (state: GameState) => {
  const actions = legalActions(state, P1, deps);
  if (actions.kind !== "turn") throw new Error(`expected a turn, got ${actions.kind}`);
  return {
    legal: actions.legal.find((entry) => entry.action.kind === "changeForm"),
    illegal: actions.illegal.find((entry) => entry.action.kind === "changeForm"),
  };
};
const typesOf = (events: readonly GameEvent[]): readonly string[] => events.map((event) => event.type);

function drive(state: GameState, commands: readonly Command[], pick = defaultPick) {
  const { session, events } = driveSession(startSession(state), deps, commands, pick);
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  // Replay determinism: the log alone rebuilds the state.
  expect(replayed.state).toEqual(session.state);
  return { state: session.state, events };
}

/** Answers a form change's cost prompt with these hand cards; anything else as `defaultPick`. */
const payingWith =
  (cards: readonly InstanceId[]) =>
  (state: GameState): readonly string[] => {
    const prompt = state.pendingChoice?.prompt;
    if (prompt?.kind === "spendResources" && prompt.formChangeCost) return cards.map((id) => `hand:${id}`);
    return defaultPick(state);
  };

describe("§3.63 the change-form option with an additional cost", () => {
  it("cannot change form while the cost cannot be paid: [energy] and [mental] are not two of a type", () => {
    const { state, hand } = table([CURFEW.id], [ENERGY.id, MENTAL.id]);
    const { legal, illegal } = changeOf(state);
    expect(legal).toBeUndefined();
    expect(illegal?.reason).toBe("insufficient_resources");
    // The refusal names the card and the cost.
    expect(illegal?.message).toContain("curfew (2 resources of the same type)");

    for (const command of [
      { type: "changeForm", playerId: P1 },
      { type: "changeForm", playerId: P1, payment: fromHand(...hand) },
    ] as const) {
      const result = applyCommand(state, command, deps);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("insufficient_resources");
    }
    // Refused, nothing was paid and the round's change is still there (RRG 1.8 "Cost", p. 14).
    expect(mustPlayer(state, P1).hand).toEqual(hand);
    expect(mustPlayer(state, P1).identity.changedFormThisRound).toBe(false);
  });

  it("an empty hand cannot pay, and the change is listed illegal rather than left out", () => {
    const { state } = table([CURFEW.id], []);
    expect(changeOf(state).legal).toBeUndefined();
    expect(changeOf(state).illegal?.reason).toBe("insufficient_resources");
  });

  it("pays 2 [energy] and changes: the example spends exactly the two, the cost is logged before the change", () => {
    const { state, hand, inPlay } = table([CURFEW.id], [MENTAL.id, ENERGY.id, ENERGY.id]);
    const [mental, energyA, energyB] = hand as [InstanceId, InstanceId, InstanceId];
    const { legal } = changeOf(state);
    expect(legal?.needsPayment).toBe(true);
    expect(legal?.formChangeCost).toEqual({ sourceInstanceIds: [inPlay[CURFEW.id]] });
    expect(legal?.example).toEqual({ type: "changeForm", playerId: P1, payment: fromHand(energyA, energyB) });

    const { state: after, events } = drive(state, [legal!.example]);
    expect(formOf(after)).toBe("hero");
    expect(mustPlayer(after, P1).hand).toEqual([mental]);
    expect(mustPlayer(after, P1).discard).toEqual(expect.arrayContaining([energyA, energyB]));
    expect(mustPlayer(after, P1).identity.changedFormThisRound).toBe(true);
    const types = typesOf(events);
    expect(types.indexOf("formChangeCostSettled")).toBeGreaterThanOrEqual(0);
    expect(types.indexOf("formChangeCostSettled")).toBeLessThan(types.indexOf("formChanged"));
    expect(events.find((event) => event.type === "formChangeCostSettled")).toMatchObject({
      playerId: P1,
      to: "hero",
      sourceInstanceIds: [inPlay[CURFEW.id]],
      outcome: "paid",
    });
  });

  it("a wild stands for any type: [mental] and [wild] pays, and overpaying with a third card is accepted", () => {
    const wild = table([CURFEW.id], [MENTAL.id, WILD.id]);
    expect(changeOf(wild.state).legal?.example).toMatchObject({ payment: fromHand(...wild.hand) });
    expect(formOf(drive(wild.state, [changeOf(wild.state).legal!.example]).state)).toBe("hero");

    const over = table([CURFEW.id], [ENERGY.id, MENTAL.id, ENERGY.id]);
    const all: Command = { type: "changeForm", playerId: P1, payment: fromHand(...over.hand) };
    const after = drive(over.state, [all]).state;
    expect(formOf(after)).toBe("hero");
    expect(mustPlayer(after, P1).hand).toEqual([]);
  });

  it("the payment query prices it as a play is priced: the requirement, a suggestion, and the engine's verdict", () => {
    const { state, hand } = table([CURFEW.id], [MENTAL.id, ENERGY.id, ENERGY.id]);
    const [mental, energyA, energyB] = hand as [InstanceId, InstanceId, InstanceId];
    const query = paymentFor(state, P1, CHANGE, {}, deps);
    expect(query?.requirement).toMatchObject({ generic: 2 });
    expect(query?.sources.map((source) => source.instanceId).sort()).toEqual([...hand].sort());
    expect(query?.suggested).toEqual([`hand:${energyA}`, `hand:${energyB}`]);

    const mixed = tryPayment(state, P1, CHANGE, [`hand:${mental}`, `hand:${energyA}`], {}, deps);
    expect(mixed.ok).toBe(false);
    if (!mixed.ok) expect(mixed.message).toContain("spend 2 resources of the same type");
    expect(tryPayment(state, P1, CHANGE, [`hand:${energyA}`, `hand:${energyB}`], {}, deps).ok).toBe(true);
  });

  it("a change the rule does not cover is free: to alter-ego form, and a payment offered for it is refused", () => {
    const { state, hand } = table([CURFEW.id], [ENERGY.id, ENERGY.id], "hero");
    expect(formChangeCostsFor(state, deps, P1, "alterEgo")).toEqual([]);
    const { legal } = changeOf(state);
    expect(legal?.needsPayment).toBe(false);
    expect(legal?.formChangeCost).toBeUndefined();
    expect(legal?.example).toEqual({ type: "changeForm", playerId: P1 });
    expect(paymentFor(state, P1, CHANGE, {}, deps)).toBeNull();

    const paid = applyCommand(state, { type: "changeForm", playerId: P1, payment: fromHand(...hand) }, deps);
    expect(paid.ok).toBe(false);
    if (!paid.ok) expect(paid.error.code).toBe("invalid_choice");

    const after = drive(state, [legal!.example]).state;
    expect(formOf(after)).toBe("alterEgo");
    expect(mustPlayer(after, P1).hand).toEqual(hand);
  });

  it("with no rule in play the change is the free basic action it always was", () => {
    const { state } = table([], [ENERGY.id]);
    expect(changeOf(state).legal?.example).toEqual({ type: "changeForm", playerId: P1 });
    expect(formOf(drive(state, [{ type: "changeForm", playerId: P1 }]).state)).toBe("hero");
  });
});

describe("§3.63, Q37 = A: a change by an ability of the player's own card, on their own turn, asks for the cost", () => {
  const useSwitch = (t: Table): Command => ({
    type: "useAbility",
    playerId: P1,
    cardInstanceId: t.inPlay[SWITCH.id]!,
    abilityId: SWITCH_ACTION.ref.id,
    payment: [],
  });

  it("asked and paid, the form changes and the round's own change is still unused", () => {
    const t = table([CURFEW.id, SWITCH.id], [ENERGY.id, MENTAL.id, ENERGY.id]);
    const [energyA, mental, energyB] = t.hand as [InstanceId, InstanceId, InstanceId];
    const asked = applyCommand(t.state, useSwitch(t), deps);
    if (!asked.ok) throw new Error(asked.error.message);
    expect(asked.state.pendingChoice?.prompt).toEqual({
      kind: "spendResources",
      requirement: { generic: 2, physical: 0, mental: 0, energy: 0 },
      formChangeCost: { to: "hero", sourceInstanceIds: [t.inPlay[CURFEW.id]], sameType: 2 },
    });
    expect(formOf(asked.state)).toBe("alterEgo");

    const { state, events } = drive(t.state, [useSwitch(t)], payingWith([energyA, energyB]));
    expect(formOf(state)).toBe("hero");
    expect(mustPlayer(state, P1).hand).toEqual([mental]);
    expect(mustPlayer(state, P1).identity.changedFormThisRound).toBe(false);
    expect(typesOf(events).filter((type) => type.startsWith("formChange"))).toEqual([
      "formChangeCostAsked",
      "formChangeCostSettled",
      "formChanged",
    ]);
    expect(events.find((event) => event.type === "formChanged")).toMatchObject({ to: "hero", byEffect: true });
  });

  it("declined, or answered with a payment that is not two of a type, nothing is spent and the form stays", () => {
    const t = table([CURFEW.id, SWITCH.id], [ENERGY.id, MENTAL.id, ENERGY.id]);
    const [energyA, mental] = t.hand as [InstanceId, InstanceId, InstanceId];
    for (const answer of [[], [energyA, mental]]) {
      const { state, events } = drive(t.state, [useSwitch(t)], payingWith(answer));
      expect(formOf(state)).toBe("alterEgo");
      expect(mustPlayer(state, P1).hand).toEqual(t.hand);
      expect(events.find((event) => event.type === "formChangeCostSettled")).toMatchObject({ outcome: "declined" });
      expect(typesOf(events)).not.toContain("formChanged");
    }
  });

  it("unpayable, nobody is asked and the form stays", () => {
    const t = table([CURFEW.id, SWITCH.id], [ENERGY.id, MENTAL.id]);
    const { state, events } = drive(t.state, [useSwitch(t)]);
    expect(formOf(state)).toBe("alterEgo");
    expect(mustPlayer(state, P1).hand).toEqual(t.hand);
    expect(typesOf(events)).not.toContain("formChangeCostAsked");
    expect(events.find((event) => event.type === "formChangeCostSettled")).toMatchObject({ outcome: "unpayable" });
  });

  it("the same ability back to alter-ego form is free under a rule for hero form only", () => {
    const t = table([CURFEW.id, SWITCH.id], [ENERGY.id, ENERGY.id], "hero");
    const { state, events } = drive(t.state, [useSwitch(t)]);
    expect(formOf(state)).toBe("alterEgo");
    expect(mustPlayer(state, P1).hand).toEqual(t.hand);
    expect(typesOf(events)).not.toContain("formChangeCostSettled");
  });
});

describe("§3.63, Q37 = A: a change that is not the player's to pay for costs nothing and happens", () => {
  it("an encounter card's When Revealed changes the form under a rule that covers every change", () => {
    const t = table([TOLL.id], [ENERGY.id], "hero");
    // The rule does cover this change for the player's own option...
    expect(formChangeCostsFor(t.state, deps, P1, "alterEgo")).toHaveLength(1);
    // ...but the encounter card's change is forced: no prompt, nothing spent.
    const { state, events } = drive(onTopOfEncounterDeck(t.state, SENT_HOME.id), [{ type: "endTurn", playerId: P1 }]);
    expect(typesOf(events)).toContain("formChanged");
    expect(typesOf(events)).not.toContain("formChangeCostAsked");
    expect(typesOf(events)).not.toContain("formChangeCostSettled");
    expect(mustPlayer(state, P1).discard).not.toContain(t.hand[0]);
  });

  it("an encounter card's Action the player triggers on their own turn changes the form for nothing", () => {
    const t = table([CURFEW.id], [ENERGY.id, ENERGY.id]);
    const placed = encounterCardInVillainArea(t.state, LEVER.id, 3);
    const { state, events } = drive(placed.state, [
      { type: "useAbility", playerId: P1, cardInstanceId: placed.id, abilityId: LEVER_ACTION.ref.id, payment: [] },
    ]);
    expect(formOf(state)).toBe("hero");
    expect(mustPlayer(state, P1).hand).toEqual(t.hand);
    expect(typesOf(events)).not.toContain("formChangeCostSettled");
  });

  it("the player's own card outside their turn changes the form for nothing under a 'during your turn' rule", () => {
    const t = table([CURFEW.id, ALARM.id], []);
    const { events } = drive(t.state, [{ type: "endTurn", playerId: P1 }]);
    expect(events.find((event) => event.type === "formChanged")).toMatchObject({ to: "hero", byEffect: true });
    expect(typesOf(events)).not.toContain("formChangeCostAsked");
    expect(typesOf(events)).not.toContain("formChangeCostSettled");
  });
});
