/**
 * A resource ability whose own cost picks a card, and whose generated resources read that pick: SP//dr Suit's Sync
 * Ratio (`spdr` 31001a: "Resource: Exhaust an [Interface] upgrade you control → generate that upgrade's resources"),
 * with synthetic cards. RRG 1.8 "Initiating Abilities" (p. 24): the cost is determined and paid (steps 3, 5) before the
 * effect (step 6), so the resources can read what the cost picked; "Resource Ability" (p. 37): it can trigger any time
 * its controller generates resources to pay a cost.
 */

import { trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import { paymentOptions, paymentsFromOptionIds } from "./actions.js";
import type { Command, Payment } from "./commands.js";
import { createCtx } from "./ctx.js";
import { applyCommand, replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { paymentFor } from "./legal.js";
import { mustInstance } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubSupport, stubUpgrade } from "./testing/fixtures.js";
import { giveCard, RESOURCE } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const INTERFACE = trait("INTERFACE");

const SYNC = stubAbility("suit.sync", {
  trigger: { kind: "resource" },
  cost: {
    exhaustCards: { slot: "exhausted", query: { categories: ["upgrade"], trait: INTERFACE }, min: 1, max: 1 },
  },
  generates: { kind: "printedResourcesOf", cards: { inSlot: "exhausted" } },
  effects: [],
} as Omit<AbilityDefinition, "id">);
const SUIT = stubSupport({ id: "suit", cost: 0, abilities: [SYNC.ref] });

const iface = (id: string, icons: Record<string, number>) => ({
  ...stubUpgrade({ id, cost: 0, traits: [INTERFACE] }),
  resourceIcons: { energy: 0, mental: 0, physical: 0, wild: 0, ...icons },
});
/** One [mental], and two [energy]: different enough that the pool tells which card paid. */
const LINK = iface("link", { mental: 1 });
const ALLOY = iface("alloy", { energy: 2 });
/** Prints a resource but is no Interface: never a pick. */
const PLAIN = {
  ...stubUpgrade({ id: "plain", cost: 0 }),
  resourceIcons: { energy: 0, mental: 0, physical: 1, wild: 0 },
};

const SHOT_ACTION = stubAbility("shot.action", {
  trigger: { kind: "action" },
  effects: [
    {
      kind: "dealDamage",
      target: { kind: "villain" },
      amount: { kind: "var", name: `paid.ability.${SYNC.ref.id}` },
    },
  ],
});
const SHOT = stubEvent({ id: "shot", cost: 2, abilities: [SHOT_ACTION.ref] });

const deps: EngineDeps = depsOf(SYNC, SHOT_ACTION);

interface Table {
  readonly state: GameState;
  readonly suit: InstanceId;
  readonly link?: InstanceId;
  readonly alloy?: InstanceId;
  readonly shot: InstanceId;
}

function table(with_: { link?: boolean; alloy?: boolean; plain?: boolean } = {}): Table {
  let state = gameAtFirstTurn({
    cards: [SUIT, LINK, ALLOY, PLAIN, SHOT],
    deps,
    deck: [SUIT.id, LINK.id, ALLOY.id, PLAIN.id, SHOT.id, ...copiesOf(RESOURCE.id, 3)],
  });
  const suit = playerCardIntoPlay(state, SUIT.id);
  state = suit.state;
  let link: InstanceId | undefined;
  let alloy: InstanceId | undefined;
  if (with_.link) ({ state, id: link } = playerCardIntoPlay(state, LINK.id));
  if (with_.alloy) ({ state, id: alloy } = playerCardIntoPlay(state, ALLOY.id));
  if (with_.plain) state = playerCardIntoPlay(state, PLAIN.id).state;
  const shot = giveCard(state, P1, SHOT.id);
  return { state: shot.state, suit: suit.id, shot: shot.id, ...(link ? { link } : {}), ...(alloy ? { alloy } : {}) };
}

const exhaust = (state: GameState, id: InstanceId): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...mustInstance(state, id), exhausted: true } },
});

const syncOptions = (state: GameState, payingFor: InstanceId) =>
  paymentOptions(createCtx(state, deps), P1, payingFor).filter(
    (o) => o.ref.kind === "ability" && o.ref.abilityId === SYNC.ref.id,
  );

const play = (t: Table, payment: readonly Payment[]): Command => ({
  type: "playCard",
  playerId: P1,
  cardInstanceId: t.shot,
  payment,
  attachToInstanceId: null,
});

const sync = (t: Table, pick?: InstanceId): Payment => ({
  ability: { instanceId: t.suit, abilityId: SYNC.ref.id, ...(pick ? { costChoices: { exhausted: [pick] } } : {}) },
});

const villainDamage = (state: GameState) => mustInstance(state, state.villains[0]!.instanceId).damage;

describe("a resource ability whose generated resources read its own cost's pick", () => {
  it("offers one payment source per legal pick, each with the pool that pick generates", () => {
    const t = table({ link: true, alloy: true, plain: true });
    const options = syncOptions(t.state, t.shot);
    expect(options.map((o) => o.optionId).sort()).toEqual(
      [
        `ability:${t.suit}:${SYNC.ref.id}@exhausted=${t.link}`,
        `ability:${t.suit}:${SYNC.ref.id}@exhausted=${t.alloy}`,
      ].sort(),
    );
    expect(paymentsFromOptionIds([options[0]!.optionId])[0]).toEqual({
      ability: { instanceId: t.suit, abilityId: SYNC.ref.id, costChoices: { exhausted: [expect.any(String)] } },
    });

    const query = paymentFor(t.state, P1, { kind: "playCard", instanceId: t.shot }, {}, deps);
    const sources = query?.sources.filter((s) => s.kind === "resourceAbility") ?? [];
    const byPick = new Map(sources.map((s) => [s.costChoices?.exhausted?.[0], s.pool] as const));
    expect(byPick.get(t.link)).toEqual({ energy: 0, mental: 1, physical: 0, wild: 0 });
    expect(byPick.get(t.alloy)).toEqual({ energy: 2, mental: 0, physical: 0, wild: 0 });
    expect(sources).toHaveLength(2);
  });

  it("exhausting the picked upgrade generates exactly its printed resources; the other stays ready; replay deep-equal", () => {
    const t = table({ link: true, alloy: true });
    const { session, events } = driveSession(startSession(t.state), deps, [play(t, [sync(t, t.alloy!)])]);
    expect(mustInstance(session.state, t.alloy!).exhausted).toBe(true);
    expect(mustInstance(session.state, t.link!).exhausted).toBe(false);
    expect(mustInstance(session.state, t.suit).exhausted).toBe(false);
    expect(villainDamage(session.state)).toBe(villainDamage(t.state) + 2);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "resourcesGenerated",
        abilityId: SYNC.ref.id,
        amount: 2,
        pool: expect.objectContaining({ energy: 2 }),
      }),
    );
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("the other pick generates the other card's resources (1 [mental], plus a resource card for the rest)", () => {
    const t = table({ link: true, alloy: true });
    const res = giveCard(t.state, P1, RESOURCE.id);
    const { session } = driveSession(startSession(res.state), deps, [
      play({ ...t, state: res.state }, [sync(t, t.link!), { fromHand: res.id }]),
    ]);
    expect(mustInstance(session.state, t.link!).exhausted).toBe(true);
    expect(mustInstance(session.state, t.alloy!).exhausted).toBe(false);
    expect(villainDamage(session.state)).toBe(villainDamage(t.state) + 1);
  });

  it("with two candidates and no pick named, the command is refused", () => {
    const t = table({ link: true, alloy: true });
    const result = applyCommand(t.state, play(t, [sync(t)]), deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("invalid_choice");
  });

  it("with one candidate the pick is forced: a plain option that generates that card's resources", () => {
    const t = table({ alloy: true });
    expect(syncOptions(t.state, t.shot).map((o) => o.optionId)).toEqual([`ability:${t.suit}:${SYNC.ref.id}`]);
    const query = paymentFor(t.state, P1, { kind: "playCard", instanceId: t.shot }, {}, deps);
    expect(query?.sources.find((s) => s.kind === "resourceAbility")?.pool.energy).toBe(2);
    const { session } = driveSession(startSession(t.state), deps, [play(t, [sync(t)])]);
    expect(mustInstance(session.state, t.alloy!).exhausted).toBe(true);
    expect(villainDamage(session.state)).toBe(villainDamage(t.state) + 2);
  });

  it("is not offered with no Interface upgrade, or with every one exhausted, and a non-Interface card can't pay", () => {
    const none = table({ plain: true });
    expect(syncOptions(none.state, none.shot)).toEqual([]);
    const tired = table({ link: true, alloy: true });
    const state = exhaust(exhaust(tired.state, tired.link!), tired.alloy!);
    expect(syncOptions(state, tired.shot)).toEqual([]);
    expect(applyCommand(state, play(tired, [sync(tired, tired.alloy!)]), deps).ok).toBe(false);
    const plain = none.state.players[0]!.playArea.find((id) => mustInstance(none.state, id).cardId === PLAIN.id)!;
    expect(applyCommand(none.state, play(none, [sync(none, plain)]), deps).ok).toBe(false);
  });

  it("may be used once per ready candidate in one payment, but one card can't pay twice", () => {
    const t = table({ link: true, alloy: true });
    const { session } = driveSession(startSession(t.state), deps, [play(t, [sync(t, t.link!), sync(t, t.alloy!)])]);
    expect(mustInstance(session.state, t.link!).exhausted).toBe(true);
    expect(mustInstance(session.state, t.alloy!).exhausted).toBe(true);
    expect(villainDamage(session.state)).toBe(villainDamage(t.state) + 3);
    const twice = applyCommand(t.state, play(t, [sync(t, t.alloy!), sync(t, t.alloy!)]), deps);
    expect(twice.ok).toBe(false);
  });
});
