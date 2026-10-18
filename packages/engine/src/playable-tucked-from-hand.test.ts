/**
 * docs/phase7-wave11.md §3.9: a hand card's permission to play an event tucked under its player's identity "as if it
 * were in your hand", discarding itself as an additional cost (`PlayableAsIfInHandSpec.discardSelfFromHand` on an
 * `activeIn: "hand"` constant), `cardPlayed.via`, `EventPattern.notPlayedVia`, and a star-cost card never being played
 * (§1.2). Synthetic cards shaped like Photographic Reflexes (`fne` 60040a/b/c): "[star] If
 * you are in hero form, you can discard Photographic Reflexes from your hand to play an event tucked under Echo as if it
 * were in your hand. Reduce the cost to play that event by 2. You cannot trigger Echo's 'Watch and Learn' ability for
 * that event."
 *
 * Sources: MC60 FAQ p. 26 (usable whenever the tucked event could be played from hand: an Action in its player's turn,
 * a Response when its condition occurs). RRG 1.8 "Cost" (p. 13): "A player must pay all additional costs
 * simultaneously with the cost that is being added to". "Event" (p. 18): a played event is placed "in its owner's
 * discard pile after those effects resolve". "Star Icon" (p. 40): "In and of itself, the star icon has no effect"; that
 * a star-cost card is never played is the spec's reading (§1.2), not RRG text. "In Play and Out of Play" (p. 23).
 *
 * Synthetic cards only; the engine never names a card.
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import { asIfInHandPermissions, playCostOf } from "./actions.js";
import type { Command } from "./commands.js";
import { applyCommand, replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession, runCommands } from "./testing/drive.js";
import { stubAlly, stubEvent, stubSupport } from "./testing/fixtures.js";
import { defaultPick, giveCard, RESOURCE, TREACHERY } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const permission = (opts: { discard?: boolean; inHand?: boolean } = {}): AbilityDefinition => ({
  ...(opts.inHand === false ? {} : { activeIn: "hand" as const }),
  trigger: {
    kind: "constant",
    playableAsIfInHand: {
      player: { kind: "controller" },
      zone: { tuckedUnder: { kind: "identityOf", player: { kind: "controller" } } },
      cards: { categories: ["event"] },
      costReduction: 2,
      form: "hero",
      ...(opts.discard === false ? {} : { discardSelfFromHand: true as const }),
    },
  },
  effects: [],
});
const REFLEXES_CONSTANT = stubAbility("reflexes.constant", permission());
/** The Photographic Reflexes shape: a star cost, no triggered ability, the permission working from the hand. */
const REFLEXES = {
  ...stubEvent({ id: "reflexes", cost: 0, abilities: [REFLEXES_CONSTANT.ref] }),
  specialCost: "star" as const,
};
/** Near miss: the same permission on a support in play (no `activeIn`): read from play, never discards anything. */
const LENS_CONSTANT = stubAbility("lens.constant", permission({ discard: false, inHand: false }));
const LENS = stubSupport({ id: "lens", cost: 0, abilities: [LENS_CONSTANT.ref] });

const damageVillain = (value: number): EffectSpec => ({
  kind: "dealDamage",
  target: { kind: "villain" },
  amount: { kind: "const", value },
});
/** "Action: Deal 1 damage to the villain." Cost 3 (3 − 2 = 1). */
const JAB_ACTION = stubAbility("jab.action", { trigger: { kind: "action" }, effects: [damageVillain(1)] });
const JAB = stubEvent({ id: "jab", cost: 3, abilities: [JAB_ACTION.ref] });
/** The same for cost 1: the reduction floors the cost at 0. */
const TAP_ACTION = stubAbility("tap.action", { trigger: { kind: "action" }, effects: [damageVillain(1)] });
const TAP = stubEvent({ id: "tap", cost: 1, abilities: [TAP_ACTION.ref] });
/** "Response: After you play an ally, deal 3 damage to the villain." Cost 1. */
const COUNTER_RESPONSE = stubAbility("counter.response", {
  trigger: {
    kind: "response",
    forced: false,
    on: { on: "cardPlayed", playerIs: "controller", targetIs: { categories: ["ally"] } },
  },
  effects: [damageVillain(3)],
});
const COUNTER = stubEvent({ id: "counter", cost: 1, abilities: [COUNTER_RESPONSE.ref] });
/** Shaped like Powerful Punch: "Hero Interrupt: When an enemy initiates an attack against you, deal 3 damage to the villain." Cost 3. */
const PUNCH_INTERRUPT = stubAbility("punch.interrupt", {
  trigger: {
    kind: "interrupt",
    forced: false,
    form: "hero",
    on: { on: "enemyAttack", playerIs: "controller", usesAttackedPlayer: true },
  },
  effects: [damageVillain(3)],
});
const PUNCH = stubEvent({ id: "punch", cost: 3, abilities: [PUNCH_INTERRUPT.ref] });
/** A star-cost card that does print a triggered ability: refused all the same (§1.2). */
const STARRY_ACTION = stubAbility("starry.action", { trigger: { kind: "action" }, effects: [damageVillain(1)] });
const STARRY = {
  ...stubEvent({ id: "starry", cost: 0, abilities: [STARRY_ACTION.ref] }),
  specialCost: "star" as const,
};
const PAL = stubAlly({ id: "pal", cost: 0, atk: 1, thw: 1, hp: 3 });
/** Shaped like Watch and Learn: "Forced Response: After you play an event, draw 1 card", not for plays via a reflexes. */
const WATCH_RESPONSE = stubAbility("watch.response", {
  trigger: {
    kind: "response",
    forced: true,
    on: {
      on: "cardPlayed",
      playerIs: "controller",
      targetIs: { categories: ["event"] },
      notPlayedVia: { name: "reflexes" },
    },
  },
  effects: [{ kind: "draw", player: { kind: "controller" }, amount: { kind: "const", value: 1 } }],
});
/** Control: the same response with no exclusion (Echo's Katana, Improvisation): 5 damage to the villain. */
const KEEN_RESPONSE = stubAbility("keen.response", {
  trigger: {
    kind: "response",
    forced: true,
    on: { on: "cardPlayed", playerIs: "controller", targetIs: { categories: ["event"] } },
  },
  effects: [damageVillain(5)],
});
const OBSERVERS = stubSupport({ id: "observers", cost: 0, abilities: [WATCH_RESPONSE.ref, KEEN_RESPONSE.ref] });

const deps: EngineDeps = depsOf(
  REFLEXES_CONSTANT,
  LENS_CONSTANT,
  JAB_ACTION,
  TAP_ACTION,
  COUNTER_RESPONSE,
  STARRY_ACTION,
  PUNCH_INTERRUPT,
  WATCH_RESPONSE,
  KEEN_RESPONSE,
);
const CARDS = [REFLEXES, LENS, JAB, TAP, COUNTER, STARRY, PAL, OBSERVERS, PUNCH];

interface Table {
  readonly state: GameState;
  readonly identity: InstanceId;
  readonly tucked: InstanceId;
  readonly reflexes: InstanceId;
  readonly resource: InstanceId;
  readonly hand: readonly InstanceId[];
}

/** p1 in `form` with `card` tucked under their identity, a Reflexes, one resource card and `hand` in hand. */
function table(
  opts: { card?: CardId; hand?: readonly CardId[]; form?: "hero" | "alterEgo"; inPlay?: readonly CardId[] } = {},
): Table {
  const start = gameAtFirstTurn({
    cards: CARDS,
    deps,
    players: 1,
    deck: [...CARDS.map((c) => c.id), ...copiesOf(PAL.id, 20)],
    encounter: copiesOf(TREACHERY.id, 29),
  });
  // Test surgery: an empty hand and the chosen form.
  let state: GameState = {
    ...start,
    players: start.players.map((p) => ({
      ...p,
      identity: { ...p.identity, form: opts.form ?? "hero" },
      hand: [],
      deck: [...p.hand, ...p.deck],
    })),
  };
  for (const card of opts.inPlay ?? []) state = playerCardIntoPlay(state, card).state;
  const tucked = giveCard(state, P1, opts.card ?? JAB.id);
  state = tucked.state;
  const reflexes = giveCard(state, P1, REFLEXES.id, [tucked.id]);
  state = reflexes.state;
  const resource = giveCard(state, P1, RESOURCE.id, [tucked.id, reflexes.id]);
  state = resource.state;
  const hand: InstanceId[] = [];
  for (const card of opts.hand ?? []) {
    const given = giveCard(state, P1, card, [tucked.id, reflexes.id, resource.id, ...hand]);
    state = given.state;
    hand.push(given.id);
  }
  const identity = mustPlayer(state, P1).identity.instanceId;
  state = {
    ...state,
    players: state.players.map((p) => ({ ...p, hand: p.hand.filter((id) => id !== tucked.id) })),
    instances: { ...state.instances, [identity]: { ...mustInstance(state, identity), tucked: [tucked.id] } },
  };
  return { state, identity, tucked: tucked.id, reflexes: reflexes.id, resource: resource.id, hand };
}

const play = (id: InstanceId, payment: readonly { readonly fromHand: InstanceId }[] = []): Command => ({
  type: "playCard",
  playerId: P1,
  cardInstanceId: id,
  payment,
  attachToInstanceId: null,
});

const offered = (state: GameState, id: InstanceId) => {
  const actions = legalActions(state, P1, deps);
  return ("legal" in actions ? actions.legal : []).find(
    (a) => a.action.kind === "playCard" && a.action.instanceId === id,
  );
};
const illegal = (state: GameState, id: InstanceId) => {
  const actions = legalActions(state, P1, deps);
  return ("illegal" in actions ? actions.illegal : []).find(
    (a) => a.action.kind === "playCard" && a.action.instanceId === id,
  );
};
const villainDamage = (state: GameState): number =>
  state.activeVillainId ? mustInstance(state, state.activeVillainId).damage : 0;

describe("§3.9 a hand card's permission to play a tucked event, discarding itself", () => {
  it("plays a tucked Action event in its player's turn for its cost less 2, discarding the hand card; replay deep-equal", () => {
    const t = table();
    expect(asIfInHandPermissions(t.state, deps, P1)).toMatchObject([
      { instanceId: t.tucked, sourceInstanceId: t.reflexes, costReduction: 2, from: "tucked", discardsSource: true },
    ]);
    expect(offered(t.state, t.tucked)?.action).toEqual({ kind: "playCard", instanceId: t.tucked, from: "tucked" });
    expect(playCostOf(t.state, P1, t.tucked, deps, null)).toMatchObject({ printed: 3, current: 1 });
    const { session, events } = driveSession(startSession(t.state), deps, [play(t.tucked, [{ fromHand: t.resource }])]);
    const state = session.state;
    expect(villainDamage(state)).toBe(1);
    expect(mustPlayer(state, P1).hand).toEqual([]);
    expect(mustPlayer(state, P1).discard).toEqual(expect.arrayContaining([t.tucked, t.reflexes, t.resource]));
    expect(mustInstance(state, t.identity).tucked).toEqual([]);
    const discardAt = events.findIndex((e) => e.type === "cardDiscardedFromHand" && e.instanceId === t.reflexes);
    const playedAt = events.findIndex((e) => e.type === "cardPlayed" && e.instanceId === t.tucked);
    expect(discardAt).toBeGreaterThanOrEqual(0);
    expect(discardAt).toBeLessThan(playedAt);
    expect(events[playedAt]).toMatchObject({ from: "tucked", countsAsFrom: "hand", via: t.reflexes, resourcesPaid: 1 });
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("the reduction does not take the cost below 0", () => {
    const t = table({ card: TAP.id });
    expect(playCostOf(t.state, P1, t.tucked, deps, null)).toMatchObject({ printed: 1, current: 0 });
    const { state } = runCommands(t.state, deps, play(t.tucked));
    expect(villainDamage(state)).toBe(1);
    expect(mustPlayer(state, P1).hand).toEqual([t.resource]);
  });

  it("the discarded card is not a resource toward the play: a payment naming it is refused", () => {
    const t = table();
    const result = applyCommand(t.state, play(t.tucked, [{ fromHand: t.reflexes }]), deps);
    expect(result.ok ? null : result.error.message).toBe("that card is discarded to play this card, not spent");
    // Control: with only the hand card to pay with, a cost of 1 is not affordable, so the play is not offered.
    const poor = {
      ...t.state,
      players: t.state.players.map((p) => ({ ...p, hand: p.hand.filter((id) => id !== t.resource) })),
    };
    expect(offered(poor, t.tucked)).toBeUndefined();
  });

  it("Watch and Learn's pattern (`notPlayedVia`) is not heard for the play via the hand card; Katana's is", () => {
    const t = table({ inPlay: [OBSERVERS.id] });
    const { session } = driveSession(startSession(t.state), deps, [play(t.tucked, [{ fromHand: t.resource }])]);
    // Keen's 5 plus Jab's 1; Watch drew nothing.
    expect(villainDamage(session.state)).toBe(6);
    expect(mustPlayer(session.state, P1).hand).toEqual([]);
  });

  it("control: an event played from the hand itself is heard by Watch and Learn, and its log carries no `via`", () => {
    const t = table({ inPlay: [OBSERVERS.id], hand: [TAP.id] });
    const tap = t.hand[0]!;
    const { session, events } = driveSession(startSession(t.state), deps, [play(tap, [{ fromHand: t.resource }])]);
    expect(villainDamage(session.state)).toBe(6);
    expect(mustPlayer(session.state, P1).hand).toHaveLength(2);
    expect(events.find((e) => e.type === "cardPlayed" && e.instanceId === tap)).not.toHaveProperty("via");
  });

  it("a tucked Response event is played from its window via the hand card, which is discarded", () => {
    const t = table({ card: COUNTER.id, hand: [PAL.id] });
    const pal = t.hand[0]!;
    const pick = (state: GameState): readonly string[] => {
      const choice = state.pendingChoice!;
      const named = choice.options.find((o) => "instanceId" in o.ref && o.ref.instanceId === t.tucked);
      if (choice.prompt.kind === "chooseTriggers" && named) return [named.optionId];
      return defaultPick(state);
    };
    const { session, events } = driveSession(startSession(t.state), deps, [play(pal)], pick);
    expect(villainDamage(session.state)).toBe(3);
    expect(events.find((e) => e.type === "cardPlayed" && e.instanceId === t.tucked)).toMatchObject({
      from: "tucked",
      via: t.reflexes,
      resourcesPaid: 0,
    });
    expect(mustPlayer(session.state, P1).discard).toEqual(expect.arrayContaining([t.tucked, t.reflexes]));
    expect(mustPlayer(session.state, P1).hand).toEqual([t.resource]);
  });

  it("a tucked Hero Interrupt event is played via the hand card in the villain's attack window, its cost 1 paid without it", () => {
    for (const form of ["hero", "alterEgo"] as const) {
      const t = table({ card: PUNCH.id, form });
      let offeredInWindow = false;
      const pick = (state: GameState): readonly string[] => {
        const choice = state.pendingChoice!;
        const named = choice.options.find((o) => "instanceId" in o.ref && o.ref.instanceId === t.tucked);
        if (choice.prompt.kind === "chooseTriggers" && named) {
          offeredInWindow = true;
          return [named.optionId];
        }
        const resource = choice.options.find((o) => o.optionId === `hand:${t.resource}`);
        if ((choice.prompt.kind === "spendResources" || choice.prompt.kind === "payForCard") && resource)
          return [resource.optionId];
        return defaultPick(state);
      };
      // p1 ends their turn; the villain phase's attack on p1 opens the interrupt window.
      const { session, events } = driveSession(startSession(t.state), deps, [{ type: "endTurn", playerId: P1 }], pick);
      const state = session.state;
      if (form === "alterEgo") {
        // The form gate: neither the permission nor the Hero Interrupt is in force, so nothing is offered or paid.
        expect(offeredInWindow).toBe(false);
        expect(mustInstance(state, t.identity).tucked).toEqual([t.tucked]);
        expect(mustPlayer(state, P1).hand).toEqual(expect.arrayContaining([t.reflexes, t.resource]));
        expect(villainDamage(state)).toBe(0);
        continue;
      }
      expect(offeredInWindow).toBe(true);
      expect(villainDamage(state)).toBe(3);
      expect(events.find((e) => e.type === "cardPlayed" && e.instanceId === t.tucked)).toMatchObject({
        from: "tucked",
        countsAsFrom: "hand",
        via: t.reflexes,
        resourcesPaid: 1,
      });
      expect(mustInstance(state, t.identity).tucked).toEqual([]);
      expect(mustPlayer(state, P1).discard).toEqual(expect.arrayContaining([t.tucked, t.reflexes, t.resource]));
      expect(mustPlayer(state, P1).hand).not.toContain(t.reflexes);
    }
  });

  it("control: in alter-ego form nothing is covered, offered or playable", () => {
    const t = table({ form: "alterEgo" });
    expect(asIfInHandPermissions(t.state, deps, P1)).toEqual([]);
    expect(offered(t.state, t.tucked)).toBeUndefined();
    const result = applyCommand(t.state, play(t.tucked, [{ fromHand: t.resource }]), deps);
    expect(result.ok ? null : result.error.code).toBe("card_not_in_zone");
  });

  it("control: the same permission on a card in play (no `activeIn`) is read from play and discards nothing", () => {
    const t = table({ inPlay: [LENS.id] });
    const withoutReflexes = {
      ...t.state,
      players: t.state.players.map((p) => ({ ...p, hand: p.hand.filter((id) => id !== t.reflexes) })),
    };
    const permissions = asIfInHandPermissions(withoutReflexes, deps, P1);
    expect(permissions).toHaveLength(1);
    expect(permissions[0]).not.toHaveProperty("discardsSource");
    const { state } = runCommands(withoutReflexes, deps, play(t.tucked, [{ fromHand: t.resource }]));
    expect(villainDamage(state)).toBe(1);
  });
});

describe("§1.2 a star-cost card is never played", () => {
  it("the hand card itself is not offered as a play and is refused", () => {
    const t = table();
    expect(offered(t.state, t.reflexes)).toBeUndefined();
    expect(illegal(t.state, t.reflexes)).toMatchObject({ reason: "card_type_not_playable" });
    const result = applyCommand(t.state, play(t.reflexes), deps);
    expect(result.ok ? null : result.error).toMatchObject({
      code: "card_type_not_playable",
      message: "a card with a printed star cost is never played",
    });
  });

  it("a star-cost card that prints an Action is refused all the same; control: the same card with a cost of 0 plays", () => {
    const t = table({ hand: [STARRY.id, TAP.id] });
    const [starry, tap] = t.hand;
    expect(offered(t.state, starry!)).toBeUndefined();
    const result = applyCommand(t.state, play(starry!), deps);
    expect(result.ok ? null : result.error.code).toBe("card_type_not_playable");
    expect(offered(t.state, tap!)).toBeDefined();
  });
});
