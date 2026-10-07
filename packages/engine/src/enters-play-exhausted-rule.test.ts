/**
 * docs/phase7-wave7.md §3.36 gap 1: a constant rule on one card that makes other cards enter play exhausted (`RuleSpec
 * entersPlayExhausted { target, while? }`). Synthetic cards shaped like an attachment on an identity: "Attach to your
 * identity. Your allies, upgrades, and supports enter play exhausted."
 *
 * Sources: RRG 1.8 "Enters Play" (p. 18): "any time when a card transitions from an out-of-play area into play. Playing
 * a card, putting a card into play by using a card ability, or revealing a card from the encounter deck are all
 * different means by which a card may enter play." "Ready" (p. 36): "Cards enter play in a ready state", which the
 * card's text replaces (The Golden Rules, p. 4). "Exhausted" (p. 19): "An exhausted card cannot be exhausted again until
 * it is ready" and "if an exhausted card must exhaust to pay the cost of using its ability, that ability cannot be used
 * until the card is ready." "Attachment" (p. 8): "you" on an attachment is the attached card's controller. "Ability"
 * (p. 4): a constant ability "remains active while the card is in play".
 *
 * The card is placed exhausted: the log has one `cardExhausted` for it and nothing is announced. The engine has no
 * "exhausted" triggering condition for an ability to listen to, so "no exhaust trigger fired" is read off the log.
 */

import { type CardId, trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps, RuleSpec } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, Predicate, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import {
  stubAlly,
  stubAttachment,
  stubEvent,
  stubMinion,
  stubSideScheme,
  stubSupport,
  stubUpgrade,
} from "./testing/fixtures.js";
import { giveCard, TREACHERY } from "./testing/scenario.js";
import { copiesOf, encounterCardInVillainArea, gameAtFirstTurn, P1, P2, playFree } from "./testing/wave3.js";

const you = { kind: "controller" } as const;
const self: TargetRef = { kind: "self" };
const TWIN = trait("TWIN");

/** "Your allies, upgrades, and supports enter play exhausted." */
const yours: RuleSpec = {
  kind: "entersPlayExhausted",
  target: { categories: ["ally", "upgrade", "support"], controlledBy: you },
};
const constant = (rule: RuleSpec): AbilityDefinition => ({ trigger: { kind: "constant", rules: [rule] }, effects: [] });
const SNARE_RULE = stubAbility("snare.constant", constant(yours));
const SNARE = stubAttachment({ id: "snare", attachesTo: { kind: "yourIdentity" }, abilities: [SNARE_RULE.ref] });
/** The same rule, only "while you are in hero form". */
const heroForm: Predicate = { kind: "form", player: you, form: "hero" };
const LULL_RULE = stubAbility("lull.constant", constant({ ...yours, while: heroForm }));
const LULL = stubAttachment({ id: "lull", attachesTo: { kind: "yourIdentity" }, abilities: [LULL_RULE.ref] });

const RECRUIT = stubAlly({ id: "recruit", cost: 0, atk: 1, thw: 1, hp: 3 });
const GADGET = stubUpgrade({ id: "gadget", cost: 0 });
/** "Action: Exhaust this card → place 1 counter here." */
const DEPOT_ACTION = stubAbility("depot.action", {
  trigger: { kind: "action" },
  cost: { exhaustSelf: true },
  effects: [{ kind: "addCounters", target: self, counterType: "crate", amount: { kind: "const", value: 1 } }],
});
const DEPOT = stubSupport({ id: "depot", cost: 0, abilities: [DEPOT_ACTION.ref] });
const TWIN_A = stubAlly({ id: "twin-a", traits: [TWIN], cost: 0, atk: 1, thw: 1, hp: 3 });
const TWIN_B = stubAlly({ id: "twin-b", traits: [TWIN], cost: 0, atk: 1, thw: 1, hp: 3 });
const THUG = stubMinion({ id: "thug", atk: 0, sch: 0, hp: 5 });

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
/** "Put the topmost Recruit from your [zone] into play." */
const call = (zone: "deck" | "discard" | "hand") =>
  event(`call-${zone}`, [
    {
      kind: "selectCards",
      slot: "called",
      cards: { kind: "zone", zone, player: you, filter: { name: RECRUIT.name }, topmostOnly: true },
    },
    { kind: "putIntoPlay", card: { kind: "slot", slot: "called" }, controller: you },
  ]);
const CALL_DECK = call("deck");
const CALL_DISCARD = call("discard");
const CALL_HAND = call("hand");
/** "Put each Twin ally from your deck and hand into play." Two cards entering play by one effect. */
const PAIR = event("pair", [
  {
    kind: "selectCards",
    slot: "twins",
    cards: { kind: "zone", zone: ["deck", "hand"], player: you, filter: { trait: TWIN } },
  },
  { kind: "putIntoPlay", card: { kind: "slot", slot: "twins" }, controller: you },
]);
/** "Put a Thug from the encounter deck into play engaged with you." */
const AMBUSH = event("ambush", [
  { kind: "selectCards", slot: "thug", cards: { kind: "encounter", zones: ["deck"], filter: { name: THUG.name } } },
  { kind: "putIntoPlay", card: { kind: "slot", slot: "thug" }, controller: you },
]);
/** "Play a Recruit from your hand. It enters play exhausted." The card's own instruction, under the rule as well. */
const MUSTER = event("muster", [
  { kind: "playFromHand", player: you, filter: { name: RECRUIT.name }, ignoreCost: true, entersExhausted: true },
]);
/** "Discard the Snare." */
const DISMISS = event("dismiss", [{ kind: "discardFromPlay", target: { kind: "each", query: { name: SNARE.name } } }]);
/** A side scheme that flips to an ally face when it is defeated: a card that stays in play as it becomes an ally. */
const FLIP = stubAbility("pad.when-defeated", {
  trigger: { kind: "whenDefeated" },
  effects: [{ kind: "flipCard", target: self }],
});
const PAD = {
  ...stubSideScheme({ id: "pad", startingThreat: 2, abilities: [FLIP.ref] }),
  otherFaceId: "stray" as CardId,
};
const STRAY = { ...stubAlly({ id: "stray", cost: 0, atk: 1, thw: 1, hp: 3 }), otherFaceId: "pad" as CardId };
const CLEAR = event("clear", [
  {
    kind: "removeThreat",
    target: { kind: "each", query: { categories: ["sideScheme"] } },
    amount: { kind: "const", value: 9 },
  },
]);

const EVENTS = [CALL_DECK, CALL_DISCARD, CALL_HAND, PAIR, AMBUSH, MUSTER, DISMISS, CLEAR];
const deps: EngineDeps = depsOf(SNARE_RULE, LULL_RULE, DEPOT_ACTION, FLIP, ...EVENTS.map((e) => e.ability));
const CARDS = [SNARE, LULL, RECRUIT, GADGET, DEPOT, TWIN_A, TWIN_B, THUG, PAD, STRAY, ...EVENTS.map((e) => e.card)];

/** A game at p1's first turn; `host` (if any) is attached to p1's identity by test surgery. */
function table(opts: { host?: typeof SNARE | null; players?: 1 | 2; form?: "hero" | "alterEgo" } = {}): GameState {
  const start = gameAtFirstTurn({
    cards: CARDS,
    deps,
    players: opts.players ?? 1,
    deck: [...copiesOf(RECRUIT.id, 3), GADGET.id, DEPOT.id, TWIN_A.id, TWIN_B.id, ...EVENTS.map((e) => e.card.id)],
    encounter: [...copiesOf(TREACHERY.id, 28), SNARE.id, LULL.id, THUG.id, PAD.id],
  });
  const form = opts.form ?? "hero";
  const state: GameState = {
    ...start,
    players: start.players.map((p) => ({ ...p, identity: { ...p.identity, form } })),
  };
  const host = opts.host === undefined ? SNARE : opts.host;
  if (!host) return state;
  const placed = encounterCardInVillainArea(state, host.id);
  const identity = mustPlayer(placed.state, P1).identity.instanceId;
  return {
    ...placed.state,
    villainArea: placed.state.villainArea.filter((id) => id !== placed.id),
    instances: {
      ...placed.state.instances,
      [placed.id]: { ...mustInstance(placed.state, placed.id), attachedTo: identity },
      [identity]: {
        ...mustInstance(placed.state, identity),
        attachments: [...mustInstance(placed.state, identity).attachments, placed.id],
      },
    },
  };
}

const play = (id: InstanceId, playerId: PlayerId = P1): Command => ({
  type: "playCard",
  playerId,
  cardInstanceId: id,
  payment: [],
  attachToInstanceId: null,
});
const exhausted = (state: GameState, id: InstanceId): boolean => mustInstance(state, id).exhausted;
const exhaustions = (events: readonly GameEvent[], id: InstanceId): number =>
  events.filter((e) => e.type === "cardExhausted" && e.instanceId === id).length;
const inPlayNamed = (state: GameState, name: string, player: PlayerId = P1): readonly InstanceId[] =>
  mustPlayer(state, player).playArea.filter((id) => mustInstance(state, id).cardId === name);

/** Hands p1 an ally, an upgrade and a support and plays the three. */
function playThree(state: GameState, player: PlayerId = P1, before: readonly Command[] = []) {
  const ally = giveCard(state, player, RECRUIT.id);
  const upgrade = giveCard(ally.state, player, GADGET.id);
  const support = giveCard(upgrade.state, player, DEPOT.id);
  const ids = [ally.id, upgrade.id, support.id] as const;
  const { session, events } = driveSession(startSession(support.state), deps, [
    ...before,
    ...ids.map((id) => play(id, player)),
  ]);
  return { session, state: session.state, events, ally: ally.id, upgrade: upgrade.id, support: support.id, ids };
}

describe("§3.36 a constant rule that makes other cards enter play exhausted", () => {
  it("an ally, an upgrade and a support the affected player plays enter play exhausted; replay deep-equal", () => {
    const played = playThree(table());
    for (const id of played.ids) {
      expect(exhausted(played.state, id)).toBe(true);
      expect(exhaustions(played.events, id)).toBe(1);
    }
    expect(mustInstance(played.state, played.upgrade).attachedTo).toBe(
      mustPlayer(played.state, P1).identity.instanceId,
    );
    const replayed = replay(played.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(played.state);
  });

  it("is placed exhausted, not exhausted by anything: one log line right after the move, nothing announced", () => {
    const { events, ally } = playThree(table());
    const moved = events.findIndex((e) => e.type === "cardMoved" && e.instanceId === ally && e.to.kind === "playArea");
    expect(events[moved + 1]).toEqual({ type: "cardExhausted", instanceId: ally });
    // The card's entering play is announced after it; no triggering condition in the log is an exhaustion.
    const announced = events.flatMap((e) => (e.type === "triggerEvent" ? [e.event.kind] : []));
    expect(announced).toContain("cardEntersPlay");
    expect(announced.filter((kind) => /exhaust/i.test(kind))).toEqual([]);
  });

  it("the same cards played by another player enter play ready", () => {
    const played = playThree(table({ players: 2 }), P2, [{ type: "endTurn", playerId: P1 }]);
    for (const id of played.ids) {
      expect(mustInstance(played.state, id).controllerId).toBe(P2);
      expect(exhausted(played.state, id)).toBe(false);
      expect(exhaustions(played.events, id)).toBe(0);
    }
  });

  it("a card type the rule does not name enters play ready: a minion an effect puts into play engaged with you", () => {
    const { state, events } = playFree(table(), deps, AMBUSH.card.id);
    const [thug] = inPlayNamed(state, THUG.id);
    expect(thug).toBeDefined();
    expect(mustInstance(state, thug!).engagedWith).toBe(P1);
    expect(exhausted(state, thug!)).toBe(false);
    expect(events.filter((e) => e.type === "cardExhausted")).toEqual([]);
  });

  it.each([
    ["deck", CALL_DECK],
    ["discard pile", CALL_DISCARD],
    ["hand", CALL_HAND],
  ] as const)("an ally an effect puts into play from the %s enters play exhausted", (zone, source) => {
    let state = table();
    const recruit = giveCard(state, P1, RECRUIT.id);
    state = recruit.state;
    if (zone !== "hand") {
      // Test surgery: every Recruit out of hand, and this one on top of the deck or the discard pile.
      const pile = zone === "deck" ? "deck" : "discard";
      state = {
        ...state,
        players: state.players.map((p) => {
          if (p.playerId !== P1) return p;
          const strays = p.hand.filter((id) => mustInstance(state, id).cardId === RECRUIT.id && id !== recruit.id);
          const hand = p.hand.filter((id) => mustInstance(state, id).cardId !== RECRUIT.id);
          return { ...p, hand, deck: [...p.deck, ...strays], [pile]: [recruit.id, ...p[pile]] };
        }),
      };
    }
    const result = playFree(state, deps, source.card.id);
    expect(mustPlayer(result.state, P1).playArea).toContain(recruit.id);
    expect(exhausted(result.state, recruit.id)).toBe(true);
    expect(exhaustions(result.events, recruit.id)).toBe(1);
  });

  it("two allies one effect puts into play are both exhausted before either's enters-play window opens", () => {
    const { state, events } = playFree(table(), deps, PAIR.card.id);
    const twins = [...inPlayNamed(state, TWIN_A.id), ...inPlayNamed(state, TWIN_B.id)];
    expect(twins).toHaveLength(2);
    const firstWindow = events.findIndex((e) => e.type === "triggerEvent" && e.event.kind === "cardEntersPlay");
    for (const id of twins) {
      expect(exhausted(state, id)).toBe(true);
      const placed = events.findIndex((e) => e.type === "cardExhausted" && e.instanceId === id);
      expect(placed).toBeGreaterThan(-1);
      expect(placed).toBeLessThan(firstWindow);
    }
  });

  it("while its condition is false, nothing enters exhausted; while true, cards do", () => {
    const off = playThree(table({ host: LULL, form: "alterEgo" }));
    for (const id of off.ids) expect(exhausted(off.state, id)).toBe(false);
    expect(off.events.filter((e) => e.type === "cardExhausted")).toEqual([]);
    const on = playThree(table({ host: LULL, form: "hero" }));
    for (const id of on.ids) expect(exhausted(on.state, id)).toBe(true);
  });

  it("with no such rule in play, cards enter ready", () => {
    const played = playThree(table({ host: null }));
    for (const id of played.ids) expect(exhausted(played.state, id)).toBe(false);
    expect(played.events.filter((e) => e.type === "cardExhausted")).toEqual([]);
  });

  it("a card with its own 'enters play exhausted' under the rule is exhausted once", () => {
    const recruit = giveCard(table(), P1, RECRUIT.id);
    const { state, events } = playFree(recruit.state, deps, MUSTER.card.id);
    const [entered] = inPlayNamed(state, RECRUIT.id);
    expect(entered).toBeDefined();
    expect(exhausted(state, entered!)).toBe(true);
    expect(exhaustions(events, entered!)).toBe(1);
  });

  it("the exhausted ally's attack and thwart, and the support's exhaust cost, are not offered or accepted", () => {
    const { state, ally, support } = playThree(table());
    const legal = legalActions(state, P1, deps);
    if (legal.kind !== "turn") throw new Error(legal.kind);
    const offered = (kind: string, id: InstanceId) =>
      legal.legal.some((a) => a.action.kind === kind && "instanceId" in a.action && a.action.instanceId === id);
    expect(offered("basicAttack", ally)).toBe(false);
    expect(offered("basicThwart", ally)).toBe(false);
    expect(offered("useAbility", support)).toBe(false);
    const attack = applyCommand(
      state,
      { type: "basicAttack", playerId: P1, attackerInstanceId: ally, targetInstanceId: state.activeVillainId },
      deps,
    );
    expect(attack.ok).toBe(false);
    if (!attack.ok) expect(attack.error.code).toBe("already_exhausted");
    const use = applyCommand(
      state,
      { type: "useAbility", playerId: P1, cardInstanceId: support, abilityId: DEPOT_ACTION.ref.id, payment: [] },
      deps,
    );
    expect(use.ok).toBe(false);
    if (!use.ok) expect(use.error.code).toBe("already_exhausted");
    // The near miss: with no rule in play the same ally and support are offered.
    const free = playThree(table({ host: null }));
    const freeLegal = legalActions(free.state, P1, deps);
    if (freeLegal.kind !== "turn") throw new Error(freeLegal.kind);
    const kinds = (id: InstanceId) =>
      freeLegal.legal.flatMap((a) => ("instanceId" in a.action && a.action.instanceId === id ? [a.action.kind] : []));
    expect(kinds(free.ally)).toContain("basicAttack");
    expect(kinds(free.support)).toContain("useAbility");
  });

  it("the ready step readies them as normal, and they can then be used", () => {
    const played = playThree(table());
    const { session, events } = driveSession(played.session, deps, [{ type: "endTurn", playerId: P1 }]);
    for (const id of played.ids) {
      expect(exhausted(session.state, id)).toBe(false);
      expect(events.filter((e) => e.type === "cardReadied" && e.instanceId === id)).toHaveLength(1);
    }
    expect(session.state.step).toMatchObject({ phase: "player", kind: "turn", activePlayerId: P1 });
    const legal = legalActions(session.state, P1, deps);
    if (legal.kind !== "turn") throw new Error(legal.kind);
    expect(legal.legal.some((a) => a.action.kind === "basicAttack" && a.action.instanceId === played.ally)).toBe(true);
  });

  it("once the rule's card has left play the next card enters ready; cards it placed exhausted stay exhausted", () => {
    const played = playThree(table());
    const dismiss = giveCard(played.state, P1, DISMISS.card.id);
    const next = giveCard(dismiss.state, P1, RECRUIT.id);
    const { session, events } = driveSession(startSession(next.state), deps, [play(dismiss.id), play(next.id)]);
    expect(events.some((e) => e.type === "cardDiscardedFromPlay" && e.cardId === SNARE.id)).toBe(true);
    expect(mustPlayer(session.state, P1).playArea).toContain(next.id);
    expect(exhausted(session.state, next.id)).toBe(false);
    expect(exhaustions(events, next.id)).toBe(0);
    for (const id of played.ids) expect(exhausted(session.state, id)).toBe(true);
  });

  it("a card that flips into an ally face has not entered play: it stays ready", () => {
    const placed = encounterCardInVillainArea(table(), PAD.id, 2);
    const { state, events } = playFree(placed.state, deps, CLEAR.card.id);
    expect(mustInstance(state, placed.id).cardId).toBe(STRAY.id);
    expect(mustPlayer(state, P1).playArea).toContain(placed.id);
    expect(events.some((e) => e.type === "triggerEvent" && e.event.kind === "cardEntersPlay")).toBe(true);
    expect(exhausted(state, placed.id)).toBe(false);
    expect(exhaustions(events, placed.id)).toBe(0);
  });
});
