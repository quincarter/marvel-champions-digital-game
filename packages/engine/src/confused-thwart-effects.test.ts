/**
 * A confused character's thwart through a card ability or effect is replaced by the confused card's removal, not only
 * its basic thwart. The character that thwarts is the one the `thwart` effect names (`thwarter`, else the controller's
 * identity).
 *
 * Source: RRG 1.8 "Confuse, Confused" (p. 13): "If a confused identity or ally attempts to thwart or use a thwart
 * ability, discard the confused card instead. Costs associated with the thwart attempt, including exhausting the
 * character, must still be paid." and "that character is not considered to have thwarted"; "Labeled Ability" (p. 26)
 * for a confused identity's "(thwart)" ability, cancelled whole with the card removed once; "Ally" (p. 7) for
 * consequential damage.
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, replay, startSession, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubEvent, stubMinion, stubResource } from "./testing/fixtures.js";
import { giveCard, TREACHERY } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, playerCardIntoPlay } from "./testing/wave3.js";

/** "Action: Exhaust this ally → it thwarts, removing 2 threat from the main scheme." (No label: an ally's own thwart.) */
const LOOKOUT_ACTION = stubAbility("lookout.action", {
  trigger: { kind: "action" },
  cost: { exhaustSelf: true },
  effects: [
    {
      kind: "thwart",
      target: { kind: "mainScheme" },
      amount: { kind: "const", value: 2 },
      thwarter: { kind: "self" },
    },
  ] as EffectSpec[],
} satisfies AbilityDefinition);
/** "Forced Response: After this ally thwarts, draw 1 card." */
const LOOKOUT_RESPONSE = stubAbility("lookout.response", {
  trigger: { kind: "response", forced: true, on: { on: "thwart", selfIs: "source" } },
  effects: [{ kind: "draw", player: { kind: "controller" }, amount: { kind: "const", value: 1 } }] as EffectSpec[],
} satisfies AbilityDefinition);
/** THW 1 (the ability removes 2), 1 consequential damage under THW. */
const LOOKOUT = stubAlly({
  id: "lookout",
  cost: 0,
  atk: 1,
  thw: 1,
  hp: 3,
  consequentialThwart: 1,
  abilities: [LOOKOUT_ACTION.ref, LOOKOUT_RESPONSE.ref],
});

/** "Hero Action (thwart): Remove 1 threat from the main scheme." */
const PROBE_ACTION = stubAbility("probe.action", {
  trigger: { kind: "action" },
  label: ["thwart"],
  effects: [{ kind: "thwart", target: { kind: "mainScheme" }, amount: { kind: "const", value: 1 } }] as EffectSpec[],
});
const PROBE = stubEvent({ id: "probe", cost: 0, abilities: [PROBE_ACTION.ref] });

/** "Action: Your identity thwarts, removing 1 threat from the main scheme." (No label.) */
const NUDGE_ACTION = stubAbility("nudge.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "thwart", target: { kind: "mainScheme" }, amount: { kind: "const", value: 1 } }] as EffectSpec[],
});
const NUDGE = stubEvent({ id: "nudge", cost: 0, abilities: [NUDGE_ACTION.ref] });

const FILLER = stubResource({ id: "filler", icons: 0, produces: { mental: 1 } });

const deps: EngineDeps = depsOf(LOOKOUT_ACTION, LOOKOUT_RESPONSE, PROBE_ACTION, NUDGE_ACTION);

/** P1 in hero form with an empty hand, 5 threat on the main scheme, and the lookout ally in play. */
function start(): { readonly state: GameState; readonly ally: InstanceId } {
  const state = gameAtFirstTurn({
    cards: [LOOKOUT, PROBE, NUDGE, FILLER],
    deps,
    deck: [LOOKOUT.id, PROBE.id, NUDGE.id, ...copiesOf(FILLER.id, 5)],
  });
  const main = state.mainScheme.instanceId;
  const emptied: GameState = {
    ...state,
    instances: { ...state.instances, [main]: { ...mustInstance(state, main), threat: 5 } },
    players: state.players.map((p) => ({
      ...p,
      identity: { ...p.identity, form: "hero" as const },
      hand: [],
      deck: [...p.hand, ...p.deck],
    })),
  };
  const withAlly = playerCardIntoPlay(emptied, LOOKOUT.id);
  return { state: withAlly.state, ally: withAlly.id };
}

const confuse = (state: GameState, id: InstanceId): GameState => {
  const instance = mustInstance(state, id);
  return {
    ...state,
    instances: { ...state.instances, [id]: { ...instance, statuses: { ...instance.statuses, confused: 1 } } },
  };
};
const heroOf = (state: GameState): InstanceId => mustPlayer(state, P1).identity.instanceId;
const mainThreat = (state: GameState): number => mustInstance(state, state.mainScheme.instanceId).threat;
const confusedRemovals = (events: readonly GameEvent[], id: InstanceId): number =>
  events.filter((e) => e.type === "statusRemoved" && e.instanceId === id && e.status === "confused").length;
const useLookout = (ally: InstanceId): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: ally,
  abilityId: LOOKOUT_ACTION.ref.id,
  payment: [],
});
const play = (id: InstanceId): Command => ({
  type: "playCard",
  playerId: P1,
  cardInstanceId: id,
  payment: [],
  attachToInstanceId: null,
});
const expectReplay = (session: GameSession): void => {
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
};

describe("a confused character's thwart through an ability or effect is replaced by the confused card", () => {
  it("a confused ally thwarting through its own ability pays, loses the card, removes no threat, takes no consequential damage, triggers no 'after it thwarts'; replay deep-equal", () => {
    const { state: bare, ally } = start();
    const state = confuse(bare, ally);
    const { session, events } = driveSession(startSession(state), deps, [useLookout(ally)]);
    expect(mustInstance(session.state, ally).exhausted).toBe(true);
    expect(mustInstance(session.state, ally).statuses.confused).toBe(0);
    expect(confusedRemovals(events, ally)).toBe(1);
    expect(mainThreat(session.state)).toBe(5);
    expect(mustInstance(session.state, ally).damage).toBe(0);
    expect(mustPlayer(session.state, P1).hand).toHaveLength(0);
    expectReplay(session);
  });

  it("the same ally unconfused thwarts: 2 threat removed and its 'after it thwarts' response resolves; replay deep-equal", () => {
    const { state, ally } = start();
    const { session, events } = driveSession(startSession(state), deps, [useLookout(ally)]);
    expect(mustInstance(session.state, ally).exhausted).toBe(true);
    expect(confusedRemovals(events, ally)).toBe(0);
    expect(mainThreat(session.state)).toBe(3);
    // Consequential damage is assessed on basic powers only; an ability's thwart never dealt it.
    expect(mustInstance(session.state, ally).damage).toBe(0);
    expect(mustPlayer(session.state, P1).hand).toHaveLength(1);
    expectReplay(session);
  });

  it("the confused ally's card goes, but a confused identity keeps its own: the thwarter is the character named", () => {
    const { state: bare, ally } = start();
    const state = confuse(confuse(bare, ally), heroOf(bare));
    const { session, events } = driveSession(startSession(state), deps, [useLookout(ally)]);
    expect(mustInstance(session.state, ally).statuses.confused).toBe(0);
    expect(mustInstance(session.state, heroOf(state)).statuses.confused).toBe(1);
    expect(confusedRemovals(events, heroOf(state))).toBe(0);
    expect(mainThreat(session.state)).toBe(5);
  });

  it("an unconfused ally thwarts through its ability even while the identity is confused", () => {
    const { state: bare, ally } = start();
    const state = confuse(bare, heroOf(bare));
    const { session } = driveSession(startSession(state), deps, [useLookout(ally)]);
    expect(mustInstance(session.state, heroOf(state)).statuses.confused).toBe(1);
    expect(mainThreat(session.state)).toBe(3);
  });

  it("a confused identity's unlabeled 'your identity thwarts' effect is replaced by the card; replay deep-equal", () => {
    const { state: bare } = start();
    const given = giveCard(bare, P1, NUDGE.id);
    const state = confuse(given.state, heroOf(bare));
    const { session, events } = driveSession(startSession(state), deps, [play(given.id)]);
    expect(mustPlayer(session.state, P1).discard).toContain(given.id);
    expect(mustInstance(session.state, heroOf(state)).statuses.confused).toBe(0);
    expect(confusedRemovals(events, heroOf(state))).toBe(1);
    expect(mainThreat(session.state)).toBe(5);
    expectReplay(session);
  });

  it("a confused identity's '(thwart)' event is cancelled whole by its label, the card removed once; replay deep-equal", () => {
    const { state: bare } = start();
    const given = giveCard(bare, P1, PROBE.id);
    const state = confuse(given.state, heroOf(bare));
    const { session, events } = driveSession(startSession(state), deps, [play(given.id)]);
    expect(mustPlayer(session.state, P1).discard).toContain(given.id);
    expect(mustInstance(session.state, heroOf(state)).statuses.confused).toBe(0);
    expect(confusedRemovals(events, heroOf(state))).toBe(1);
    expect(mainThreat(session.state)).toBe(5);
    expectReplay(session);
  });

  it("once the card is spent on a '(thwart)' event, the identity's next thwart effect removes threat", () => {
    const { state: bare } = start();
    const first = giveCard(bare, P1, PROBE.id);
    const second = giveCard(first.state, P1, NUDGE.id);
    const state = confuse(second.state, heroOf(bare));
    const { session, events } = driveSession(startSession(state), deps, [play(first.id), play(second.id)]);
    expect(confusedRemovals(events, heroOf(state))).toBe(1);
    expect(mainThreat(session.state)).toBe(4);
    expectReplay(session);
  });
});

// RRG 1.8 "Confuse, Confused" (p. 13): "A confused character can attempt to thwart or use a thwart ability even if it has
// no valid target for a thwart." A patrol minion engaged with P1 makes the main scheme, the only scheme, no target for
// P1's thwarts (RRG 1.8 "Patrol", p. 32; "Target", p. 42), so an unconfused ally's own thwart ability cannot be used.
describe("a confused character's unlabeled thwart ability can be used with no valid target (§4.1 Q50)", () => {
  const PATROL = stubMinion({ id: "patroller", atk: 1, sch: 1, hp: 5, keywords: [{ name: "patrol" }] });
  const patrolDeps: EngineDeps = depsOf(LOOKOUT_ACTION, LOOKOUT_RESPONSE, NUDGE_ACTION);

  /** P1 in hero form, 5 threat on the main scheme, the lookout ally in play, and the patrol minion engaged with P1. */
  function patrolled(): { readonly state: GameState; readonly ally: InstanceId } {
    const base = gameAtFirstTurn({
      cards: [LOOKOUT, NUDGE, FILLER, PATROL],
      deps: patrolDeps,
      deck: [LOOKOUT.id, NUDGE.id, ...copiesOf(FILLER.id, 5)],
      encounter: [PATROL.id, ...copiesOf(TREACHERY.id, 20)],
    });
    const main = base.mainScheme.instanceId;
    const hero: GameState = {
      ...base,
      instances: { ...base.instances, [main]: { ...mustInstance(base, main), threat: 5 } },
      players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
    };
    const withAlly = playerCardIntoPlay(hero, LOOKOUT.id);
    return { state: minionEngagedWith(withAlly.state, PATROL.id, P1).state, ally: withAlly.id };
  }

  it("unconfused, the ally's thwart ability is refused: it has no valid target", () => {
    const { state, ally } = patrolled();
    const result = applyCommand(state, useLookout(ally), patrolDeps);
    expect(result).toMatchObject({ ok: false, error: { code: "no_valid_target" } });
  });

  it("confused, the ally uses it: the cost is paid and the confused card is discarded instead; replay deep-equal", () => {
    const { state: bare, ally } = patrolled();
    const state = confuse(bare, ally);
    const { session, events } = driveSession(startSession(state), patrolDeps, [useLookout(ally)]);
    expect(mustInstance(session.state, ally).exhausted).toBe(true);
    expect(mustInstance(session.state, ally).statuses.confused).toBe(0);
    expect(confusedRemovals(events, ally)).toBe(1);
    expect(mainThreat(session.state)).toBe(5);
    const replayed = replay(session.log, patrolDeps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("a confused identity plays an unlabeled 'your identity thwarts' event with no valid target, losing the card", () => {
    const { state: bare } = patrolled();
    const given = giveCard(bare, P1, NUDGE.id);
    const state = confuse(given.state, heroOf(bare));
    const { session, events } = driveSession(startSession(state), patrolDeps, [play(given.id)]);
    expect(mustPlayer(session.state, P1).discard).toContain(given.id);
    expect(confusedRemovals(events, heroOf(state))).toBe(1);
    expect(mainThreat(session.state)).toBe(5);
  });
});
