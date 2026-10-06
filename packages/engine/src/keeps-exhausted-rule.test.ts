/**
 * docs/phase7-wave7.md §4.1 (owner ruling 2026-10-05, The Merc with the Mouth 44032): "Exhaust each ally you control."
 * printed with no timing trigger is a constant (`RuleSpec keepsExhausted { target, while? }`), applied between frames
 * beside the kept-status rule. Synthetic cards shaped like an attachment on an identity: "Attach to your identity.
 * Exhaust each ally you control."
 *
 * Sources: RRG 1.8 "Ability" (p. 4): a constant ability has no bold timing trigger and "remains active while the card
 * is in play". "Exhausted" (p. 19): "An exhausted card cannot be exhausted again until it is ready". "Ownership and
 * Control" (p. 31): "If a character changes control while it is in play, it remains in the same state (i.e., readied or
 * exhausted, damaged or not, etc.)", after which the standing instruction reads it under its new controller.
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps, RuleSpec } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, Predicate } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubAttachment, stubEvent, stubSupport } from "./testing/fixtures.js";
import { giveCard, TREACHERY } from "./testing/scenario.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  P1,
  P2,
  playerCardIntoPlay,
  playFree,
} from "./testing/wave3.js";

const you = { kind: "controller" } as const;
const allies: RuleSpec = { kind: "keepsExhausted", target: { categories: ["ally"], controlledBy: you } };
const constant = (...rules: RuleSpec[]): AbilityDefinition => ({ trigger: { kind: "constant", rules }, effects: [] });

/** "Attach to your identity. Exhaust each ally you control." */
const GAG_RULE = stubAbility("gag.constant", constant(allies));
const GAG = stubAttachment({ id: "gag", attachesTo: { kind: "yourIdentity" }, abilities: [GAG_RULE.ref] });
/** The same, with "Allies you control cannot ready." */
const BIND_RULE = stubAbility(
  "bind.constant",
  constant(allies, { kind: "cannotReady", target: { categories: ["ally"], controlledBy: you } }),
);
const BIND = stubAttachment({ id: "bind", attachesTo: { kind: "yourIdentity" }, abilities: [BIND_RULE.ref] });
/** The same rule, only "while you are in hero form". */
const heroForm: Predicate = { kind: "form", player: you, form: "hero" };
const LULL_RULE = stubAbility("lull.constant", constant({ ...allies, while: heroForm }));
const LULL = stubAttachment({ id: "lull", attachesTo: { kind: "yourIdentity" }, abilities: [LULL_RULE.ref] });

const RECRUIT = stubAlly({ id: "recruit", cost: 0, atk: 1, thw: 1, hp: 3 });
const DEPOT = stubSupport({ id: "depot", cost: 0 });

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
/** "Ready each ally." */
const RALLY = event("rally", [{ kind: "ready", target: { kind: "each", query: { categories: ["ally"] } } }]);
/** "Detach each attached ally and take control of it." */
const RESCUE = event("rescue", [
  { kind: "detach", card: { kind: "each", query: { categories: ["ally"] } }, controller: you },
]);
/** "Discard each attachment from your identity." */
const SHRUG = event("shrug", [
  { kind: "discardFromPlay", target: { kind: "each", query: { categories: ["attachment"] } } },
]);

const EVENTS = [RALLY, RESCUE, SHRUG];
const deps: EngineDeps = depsOf(GAG_RULE, BIND_RULE, LULL_RULE, ...EVENTS.map((e) => e.ability));
const CARDS = [GAG, BIND, LULL, RECRUIT, DEPOT, ...EVENTS.map((e) => e.card)];

function table(opts: { players?: 1 | 2; form?: "hero" | "alterEgo" } = {}): GameState {
  const start = gameAtFirstTurn({
    cards: CARDS,
    deps,
    players: opts.players ?? 1,
    deck: [...copiesOf(RECRUIT.id, 3), DEPOT.id, ...EVENTS.map((e) => e.card.id)],
    encounter: [...copiesOf(TREACHERY.id, 28), GAG.id, BIND.id, LULL.id],
  });
  const form = opts.form ?? "hero";
  return { ...start, players: start.players.map((p) => ({ ...p, identity: { ...p.identity, form } })) };
}

/** `host` attached to `player`'s identity by test surgery. */
function attached(state: GameState, host: typeof GAG, player: PlayerId = P1): GameState {
  const placed = encounterCardInVillainArea(state, host.id);
  const identity = mustPlayer(placed.state, player).identity.instanceId;
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
/** Runs the flow on `state` with no command: only what happens between frames. */
const settle = (state: GameState, commands: readonly Command[] = []) => {
  const { session, events } = driveSession(startSession(state), deps, commands);
  return { session, state: session.state, events };
};

describe("a constant that keeps matching cards exhausted (keepsExhausted)", () => {
  it("an ally already in play and ready is exhausted once the rule's card is in play, logged once; replay equal", () => {
    const ally = playerCardIntoPlay(table(), RECRUIT.id);
    expect(exhausted(ally.state, ally.id)).toBe(false);
    // The rule is first observed on the next pass between frames: any command will do.
    const depot = giveCard(attached(ally.state, GAG), P1, DEPOT.id);
    const after = settle(depot.state, [play(depot.id)]);
    expect(exhausted(after.state, ally.id)).toBe(true);
    expect(exhaustions(after.events, ally.id)).toBe(1);
    // The support it does not name stays ready.
    expect(exhausted(after.state, depot.id)).toBe(false);
    expect(after.events.filter((e) => e.type === "cardExhausted")).toHaveLength(1);
    const replayed = replay(after.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(after.state);
  });

  it("is a level, not a log line per scan: later commands do not log the exhausted ally again", () => {
    const ally = playerCardIntoPlay(table(), RECRUIT.id);
    const a = giveCard(attached(ally.state, GAG), P1, DEPOT.id);
    const b = giveCard(a.state, P1, RECRUIT.id, [ally.id]);
    const after = settle(b.state, [play(a.id), play(b.id)]);
    expect(exhaustions(after.events, ally.id)).toBe(1);
    // The ally played under the rule is exhausted too, once.
    expect(exhausted(after.state, b.id)).toBe(true);
    expect(exhaustions(after.events, b.id)).toBe(1);
  });

  it("another player's allies are left ready", () => {
    const mine = playerCardIntoPlay(table({ players: 2 }), RECRUIT.id, P1);
    const theirs = playerCardIntoPlay(mine.state, RECRUIT.id, P2);
    const depot = giveCard(attached(theirs.state, GAG, P1), P1, DEPOT.id);
    const after = settle(depot.state, [play(depot.id)]);
    expect(exhausted(after.state, mine.id)).toBe(true);
    expect(exhausted(after.state, theirs.id)).toBe(false);
    expect(exhaustions(after.events, theirs.id)).toBe(0);
  });

  it("an ally that comes under your control while in play is exhausted, in its new controller's play area", () => {
    // An ally attached to the main scheme, no one's, ready (the shape of a captive ally a scheme holds).
    const captive = playerCardIntoPlay(table(), RECRUIT.id);
    const scheme = captive.state.mainScheme.instanceId;
    const held: GameState = {
      ...captive.state,
      players: captive.state.players.map((p) => ({ ...p, playArea: p.playArea.filter((id) => id !== captive.id) })),
      instances: {
        ...captive.state.instances,
        [captive.id]: { ...mustInstance(captive.state, captive.id), controllerId: null, attachedTo: scheme },
        [scheme]: {
          ...mustInstance(captive.state, scheme),
          attachments: [...mustInstance(captive.state, scheme).attachments, captive.id],
        },
      },
    };
    const before = settle(attached(held, GAG));
    expect(exhausted(before.state, captive.id)).toBe(false);
    const after = playFree(before.state, deps, RESCUE.card.id);
    expect(mustInstance(after.state, captive.id).controllerId).toBe(P1);
    expect(mustPlayer(after.state, P1).playArea).toContain(captive.id);
    expect(exhausted(after.state, captive.id)).toBe(true);
    expect(exhaustions(after.events, captive.id)).toBe(1);
    const changed = after.events.findIndex((e) => e.type === "controllerChanged" && e.instanceId === captive.id);
    const spent = after.events.findIndex((e) => e.type === "cardExhausted" && e.instanceId === captive.id);
    expect(changed).toBeGreaterThanOrEqual(0);
    expect(spent).toBeGreaterThan(changed);
  });

  it("alone it does not stop a ready, but the readied ally is exhausted again before anything else happens", () => {
    const ally = playerCardIntoPlay(table(), RECRUIT.id);
    const after = playFree(attached(ally.state, GAG), deps, RALLY.card.id);
    expect(after.events.filter((e) => e.type === "cardReadied" && e.instanceId === ally.id)).toHaveLength(1);
    expect(exhaustions(after.events, ally.id)).toBe(2);
    expect(exhausted(after.state, ally.id)).toBe(true);
  });

  it("with 'cannot ready' beside it the ally is exhausted once and never readied", () => {
    const ally = playerCardIntoPlay(table(), RECRUIT.id);
    const after = playFree(attached(ally.state, BIND), deps, RALLY.card.id);
    expect(after.events.filter((e) => e.type === "cardReadied")).toEqual([]);
    expect(exhaustions(after.events, ally.id)).toBe(1);
    expect(exhausted(after.state, ally.id)).toBe(true);
  });

  it("nothing is readied when the rule's card leaves play, and the next ally enters ready", () => {
    const ally = playerCardIntoPlay(table(), RECRUIT.id);
    const gone = playFree(attached(ally.state, GAG), deps, SHRUG.card.id);
    expect(exhausted(gone.state, ally.id)).toBe(true);
    const next = giveCard(gone.state, P1, RECRUIT.id, [ally.id]);
    const after = settle(next.state, [play(next.id)]);
    expect(exhausted(after.state, next.id)).toBe(false);
  });

  it("a `while` condition gates it: nothing in alter-ego form, exhausted in hero form", () => {
    const calm = playerCardIntoPlay(table({ form: "alterEgo" }), RECRUIT.id);
    const depot = giveCard(attached(calm.state, LULL), P1, DEPOT.id);
    expect(exhausted(settle(depot.state, [play(depot.id)]).state, calm.id)).toBe(false);
    const hero = playerCardIntoPlay(table({ form: "hero" }), RECRUIT.id);
    const depot2 = giveCard(attached(hero.state, LULL), P1, DEPOT.id);
    expect(exhausted(settle(depot2.state, [play(depot2.id)]).state, hero.id)).toBe(true);
  });
});
