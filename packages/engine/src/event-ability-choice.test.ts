/**
 * An event with more than one Action ability. RRG 1.8 "Event" (p. 18): "If an event has more than one triggered ability
 * on it, the player playing it chooses one of those abilities to trigger when playing that event." So one ability is
 * judged, paid for and resolved: the only usable one without asking, else the one the player names (`playCard`'s
 * `abilityId`), or picks when an effect plays the card.
 *
 * RRG 1.8 "Initiating Abilities" (p. 24): play restrictions are checked at step 2 and the cost is determined at step
 * 3, each for the ability being triggered, so the choice comes before the payment.
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command, Payment } from "./commands.js";
import { applyCommand, replay, startSession } from "./engine.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { legalActions, paymentFor, type LegalAction } from "./legal.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { PlayerRef, Predicate } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent } from "./testing/fixtures.js";
import { ALLY, defaultPick, giveCard, payFor, RESOURCE } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, P2 } from "./testing/wave3.js";

const one = { kind: "const", value: 1 } as const;
const you: PlayerRef = { kind: "controller" };
const mark = (counterType: string) =>
  [{ kind: "addCounters", target: { kind: "identityOf", player: you }, counterType, amount: one }] as const;
const inForm = (form: "hero" | "alterEgo"): Predicate => ({ kind: "form", player: you, form });
const action = (id: string, counter: string, extra: Partial<AbilityDefinition> = {}): StubAbility =>
  stubAbility(id, { trigger: { kind: "action" }, effects: [...mark(counter)], ...extra });

/** "Action: … / Action: Spend 1 resource → …": both usable at once, with different costs. */
const QUICK = action("twin.action", "quick");
const HEAVY = action("twin.action-2", "heavy", { cost: { resources: 1 } });
const TWIN = stubEvent({ id: "twin", cost: 0, abilities: [QUICK.ref, HEAVY.ref] });

/** Two cost-free abilities, both usable at once. */
const LEFT = action("pair.action", "left");
const RIGHT = action("pair.action-2", "right");
const PAIR = stubEvent({ id: "pair", cost: 0, abilities: [LEFT.ref, RIGHT.ref] });

/** "Action: If you are in alter-ego form, … / Action: If you are in hero form, …": never both usable. */
const AS_ALTER_EGO = action("duo.action", "alterEgo", { trigger: { kind: "action", while: inForm("alterEgo") } });
const AS_HERO = action("duo.action-2", "hero", { trigger: { kind: "action", while: inForm("hero") } });
const DUO = stubEvent({ id: "duo", cost: 0, abilities: [AS_ALTER_EGO.ref, AS_HERO.ref] });

/** One Action ability, and an Action beside a Response: neither is a choice. */
const SOLO_ACTION = action("solo.action", "solo");
const SOLO = stubEvent({ id: "solo", cost: 0, abilities: [SOLO_ACTION.ref] });
const MIXED_ACTION = action("mixed.action", "mixedAction");
const MIXED_RESPONSE = stubAbility("mixed.response", {
  trigger: { kind: "response", forced: false, on: { on: "defended" } },
  effects: [...mark("mixedResponse")],
});
const MIXED = stubEvent({ id: "mixed", cost: 0, abilities: [MIXED_ACTION.ref, MIXED_RESPONSE.ref] });

/** "Action: Play a card from your hand, ignoring its resource cost." / "…, paying its cost." */
const MAGIC_ACTION = stubAbility("magic.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "playFromHand", player: you, ignoreCost: true }],
});
const MAGIC = stubEvent({ id: "magic", cost: 0, abilities: [MAGIC_ACTION.ref] });
const DRILL_ACTION = stubAbility("drill.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "playFromHand", player: you, costReduction: { kind: "const", value: 0 } }],
});
const DRILL = stubEvent({ id: "drill", cost: 0, abilities: [DRILL_ACTION.ref] });

const deps: EngineDeps = depsOf(
  QUICK,
  HEAVY,
  LEFT,
  RIGHT,
  AS_ALTER_EGO,
  AS_HERO,
  SOLO_ACTION,
  MIXED_ACTION,
  MIXED_RESPONSE,
  MAGIC_ACTION,
  DRILL_ACTION,
);
const CARDS = [TWIN, PAIR, DUO, SOLO, MIXED, MAGIC, DRILL];

/** Two seats at p1's first turn, both in alter-ego form, each holding only the cards named. */
function start(hands: { readonly p1?: readonly string[]; readonly p2?: readonly string[] }): {
  state: GameState;
  ids: Record<string, InstanceId>;
} {
  let state = gameAtFirstTurn({ deps, players: 2, cards: CARDS, deck: CARDS.map((card) => card.id) });
  state = {
    ...state,
    players: state.players.map((p) => ({ ...p, hand: [], deck: [...p.hand, ...p.deck] })),
  };
  const ids: Record<string, InstanceId> = {};
  for (const [player, wanted] of [
    [P1, hands.p1],
    [P2, hands.p2],
  ] as const) {
    const given: InstanceId[] = [];
    for (const card of wanted ?? []) {
      const next = giveCard(state, player, card, given);
      state = next.state;
      given.push(next.id);
      ids[`${player}:${card}`] = next.id;
    }
  }
  return { state, ids };
}

const play = (
  playerId: PlayerId,
  cardInstanceId: InstanceId,
  ability?: StubAbility,
  payment: readonly Payment[] = [],
): Command => ({
  type: "playCard",
  playerId,
  cardInstanceId,
  payment,
  attachToInstanceId: null,
  ...(ability ? { abilityId: ability.ref.id } : {}),
});
const counters = (state: GameState, player: PlayerId = P1): Readonly<Record<string, number>> =>
  mustInstance(state, mustPlayer(state, player).identity.instanceId).counters;
const refusalCode = (state: GameState, command: Command): string => {
  const result = applyCommand(state, command, deps);
  return result.ok ? "ok" : result.error.code;
};
const drive = (state: GameState, commands: readonly Command[], pick = defaultPick) => {
  const { session } = driveSession(startSession(state), deps, commands, pick);
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
  return session.state;
};
const listed = (state: GameState, player: PlayerId, id: InstanceId): LegalAction | undefined => {
  const actions = legalActions(state, player, deps);
  if (actions.kind !== "turn" && actions.kind !== "notYourTurn") throw new Error(`no action list: ${actions.kind}`);
  return actions.legal.find((entry) => entry.action.kind === "playCard" && entry.action.instanceId === id);
};

describe("playing an event with two usable Action abilities (RRG Event p. 18)", () => {
  it("is refused with nothing spent until the player names one", () => {
    const { state, ids } = start({ p1: [TWIN.id, RESOURCE.id] });
    const twin = ids["p1:twin"]!;
    expect(refusalCode(state, play(P1, twin))).toBe("invalid_choice");
    expect(refusalCode(state, play(P1, twin, undefined, payFor(state, P1, 1)))).toBe("invalid_choice");
  });

  it("resolves only the named ability, for that ability's cost", () => {
    const { state, ids } = start({ p1: [TWIN.id, RESOURCE.id] });
    const twin = ids["p1:twin"]!;
    const resource = ids["p1:res"]!;

    const quick = drive(state, [play(P1, twin, QUICK)]);
    expect(counters(quick)).toEqual({ quick: 1 });
    expect(mustPlayer(quick, P1).hand).toEqual([resource]);
    expect(mustPlayer(quick, P1).discard).toContain(twin);

    // The second ability's own "spend 1 resource" is part of the price, and only of that ability's.
    expect(refusalCode(state, play(P1, twin, HEAVY))).toBe("insufficient_resources");
    const heavy = drive(state, [play(P1, twin, HEAVY, payFor(state, P1, 1))]);
    expect(counters(heavy)).toEqual({ heavy: 1 });
    expect(mustPlayer(heavy, P1).hand).toEqual([]);
    expect(mustPlayer(heavy, P1).discard).toEqual(expect.arrayContaining([twin, resource]));
  });

  it("refuses an ability that is not one of the card's Actions, and a name on a card that is no Action event", () => {
    const { state, ids } = start({ p1: [TWIN.id, MIXED.id, ALLY.id] });
    expect(refusalCode(state, play(P1, ids["p1:twin"]!, LEFT))).toBe("invalid_choice");
    expect(refusalCode(state, play(P1, ids["p1:mixed"]!, MIXED_RESPONSE))).toBe("invalid_choice");
    expect(refusalCode(state, play(P1, ids["p1:ally"]!, QUICK))).toBe("invalid_choice");
  });

  it("legalActions lists the abilities that can be triggered and paid for, and its example names the first", () => {
    const paid = start({ p1: [TWIN.id, RESOURCE.id] });
    const both = listed(paid.state, P1, paid.ids["p1:twin"]!);
    expect(both?.abilities).toEqual([QUICK.ref.id, HEAVY.ref.id]);
    expect(both?.example).toMatchObject({ type: "playCard", abilityId: QUICK.ref.id, payment: [] });

    // With nothing to pay with, only the cost-free ability is offered.
    const broke = start({ p1: [TWIN.id] });
    expect(listed(broke.state, P1, broke.ids["p1:twin"]!)?.abilities).toEqual([QUICK.ref.id]);
  });

  it("paymentFor prices the ability the player chose", () => {
    const { state, ids } = start({ p1: [TWIN.id, RESOURCE.id] });
    const ref = { kind: "playCard", instanceId: ids["p1:twin"]! } as const;
    expect(paymentFor(state, P1, ref, {}, deps)).toBeNull();
    expect(paymentFor(state, P1, ref, { abilityId: QUICK.ref.id }, deps)).toBeNull();
    const heavy = paymentFor(state, P1, ref, { abilityId: HEAVY.ref.id }, deps);
    expect(heavy?.requirement.generic).toBe(1);
    expect(heavy?.suggested).toHaveLength(1);
  });
});

describe("an event whose Action abilities are never usable together", () => {
  it("triggers the usable one without a name, lists it, and refuses the other by name", () => {
    const { state, ids } = start({ p1: [DUO.id] });
    const duo = ids["p1:duo"]!;
    expect(listed(state, P1, duo)?.abilities).toEqual([AS_ALTER_EGO.ref.id]);
    expect(listed(state, P1, duo)?.example).toMatchObject({ abilityId: AS_ALTER_EGO.ref.id });
    expect(refusalCode(state, play(P1, duo, AS_HERO))).toBe("no_valid_target");
    expect(counters(drive(state, [play(P1, duo)]))).toEqual({ alterEgo: 1 });

    const hero = drive(state, [{ type: "changeForm", playerId: P1 }]);
    expect(listed(hero, P1, duo)?.abilities).toEqual([AS_HERO.ref.id]);
    expect(counters(drive(hero, [play(P1, duo)]))).toEqual({ hero: 1 });
    expect(counters(drive(hero, [play(P1, duo, AS_HERO)]))).toEqual({ hero: 1 });
  });
});

describe("an event with one Action ability, alone or beside a Response", () => {
  it("is played by the same command as ever, and offers no choice of ability", () => {
    const { state, ids } = start({ p1: [SOLO.id, MIXED.id] });
    for (const [id, counter] of [
      [ids["p1:solo"]!, "solo"],
      [ids["p1:mixed"]!, "mixedAction"],
    ] as const) {
      const entry = listed(state, P1, id);
      expect(entry).toBeDefined();
      expect(entry?.abilities).toBeUndefined();
      expect(entry?.example).not.toHaveProperty("abilityId");
      expect(counters(drive(state, [play(P1, id)]))).toEqual({ [counter]: 1 });
    }
  });
});

describe("an event played by an effect (playFromHand)", () => {
  /** Answers the card pick with `card`, the ability pick with `ability`, and a payment with its first option. */
  const picking =
    (card: InstanceId, ability?: StubAbility, seen: string[][] = []) =>
    (state: GameState): readonly string[] => {
      const choice = state.pendingChoice;
      if (!choice) return [];
      if (choice.prompt.kind === "chooseCards") return [card];
      if (choice.prompt.kind === "chooseOption") {
        seen.push(choice.options.map((option) => option.optionId));
        expect(choice.options.every((option) => option.ref.kind === "ability")).toBe(true);
        return ability ? [ability.ref.id] : [choice.options[0]!.optionId];
      }
      if (choice.prompt.kind === "spendResources") return choice.options.slice(0, 1).map((option) => option.optionId);
      return defaultPick(state);
    };

  it("ignoring the cost: the only usable ability resolves, with no question asked", () => {
    const { state, ids } = start({ p1: [MAGIC.id, DUO.id] });
    const seen: string[][] = [];
    const after = drive(state, [play(P1, ids["p1:magic"]!)], picking(ids["p1:duo"]!, undefined, seen));
    expect(seen).toEqual([]);
    expect(counters(after)).toEqual({ alterEgo: 1 });
  });

  it("ignoring the cost: the player chooses between two usable abilities, and only that one resolves", () => {
    const { state, ids } = start({ p1: [MAGIC.id, PAIR.id] });
    for (const [ability, counter] of [
      [LEFT, "left"],
      [RIGHT, "right"],
    ] as const) {
      const seen: string[][] = [];
      const after = drive(state, [play(P1, ids["p1:magic"]!)], picking(ids["p1:pair"]!, ability, seen));
      expect(seen).toEqual([[LEFT.ref.id, RIGHT.ref.id]]);
      expect(counters(after)).toEqual({ [counter]: 1 });
      expect(mustPlayer(after, P1).discard).toContain(ids["p1:pair"]!);
    }
  });

  it("ignoring the cost: an ability with a cost of its own is not among the choices", () => {
    const { state, ids } = start({ p1: [MAGIC.id, TWIN.id, RESOURCE.id] });
    const seen: string[][] = [];
    const after = drive(state, [play(P1, ids["p1:magic"]!)], picking(ids["p1:twin"]!, undefined, seen));
    expect(seen).toEqual([]);
    expect(counters(after)).toEqual({ quick: 1 });
    expect(mustPlayer(after, P1).hand).toEqual([ids["p1:res"]!]);
  });

  it("paying: the choice comes before the payment, which is the chosen ability's", () => {
    const { state, ids } = start({ p1: [DRILL.id, TWIN.id, RESOURCE.id] });
    const seen: string[][] = [];
    const heavy = drive(state, [play(P1, ids["p1:drill"]!)], picking(ids["p1:twin"]!, HEAVY, seen));
    expect(seen).toEqual([[QUICK.ref.id, HEAVY.ref.id]]);
    expect(counters(heavy)).toEqual({ heavy: 1 });
    expect(mustPlayer(heavy, P1).hand).toEqual([]);

    const quick = drive(state, [play(P1, ids["p1:drill"]!)], picking(ids["p1:twin"]!, QUICK));
    expect(counters(quick)).toEqual({ quick: 1 });
    expect(mustPlayer(quick, P1).hand).toEqual([ids["p1:res"]!]);
  });

  it("paying: an ability the player cannot pay for is not offered", () => {
    const { state, ids } = start({ p1: [DRILL.id, TWIN.id] });
    const seen: string[][] = [];
    const after = drive(state, [play(P1, ids["p1:drill"]!)], picking(ids["p1:twin"]!, undefined, seen));
    expect(seen).toEqual([]);
    expect(counters(after)).toEqual({ quick: 1 });
  });
});

describe("during another player's turn", () => {
  it("the same decision is made for the acting player", () => {
    const { state, ids } = start({ p2: [DUO.id, TWIN.id, RESOURCE.id] });
    const duo = ids["p2:duo"]!;
    const twin = ids["p2:twin"]!;
    expect(listed(state, P2, duo)?.abilities).toEqual([AS_ALTER_EGO.ref.id]);
    expect(listed(state, P2, twin)?.abilities).toEqual([QUICK.ref.id, HEAVY.ref.id]);
    expect(refusalCode(state, play(P2, twin))).toBe("invalid_choice");

    const after = drive(state, [play(P2, duo), play(P2, twin, HEAVY, payFor(state, P2, 1))]);
    expect(counters(after, P2)).toEqual({ alterEgo: 1, heavy: 1 });
    expect(counters(after, P1)).toEqual({});
    expect(mustPlayer(after, P2).hand).toEqual([]);
    expect(after.step).toMatchObject({ kind: "turn", activePlayerId: P1 });
  });
});
