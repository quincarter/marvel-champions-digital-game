/**
 * docs/phase7-wave11.md §3.5: "Threat cannot be removed from this scheme except by Daredevil or Matt Murdock" (Focus the
 * Senses, `fne` 60012) is `RuleSpec threatCannotBeRemoved` with `exceptFromSource: { extensionOf: you }`, a query on
 * the **removing card** (and, for a thwart, the thwarting character).
 *
 * - RRG 1.8 "Identity" (p. 23): both titles name the identity, so its removals in either form get through.
 * - RRG 1.8 "You, Your" (p. 49): events and upgrades (unless attached to another friendly character) are extensions of
 *   the identity; allies, supports and player side schemes are not.
 * - RRG 1.8 "Labeled Ability" (p. 26): a "(thwart)"-labeled ability is a thwart made by that player's identity, so
 *   one on the player's own support or ally gets through. The engine follows p. 26 over p. 49's line that supports
 *   and allies are not extensions (engine interpretation, §3.5): for a thwart only the thwarting character is read.
 * - RRG 1.8 "Ownership and Control" (p. 31), August 13, 2026 R1: a borrowed event stays its owner's card, but its
 *   effects are performed by the identity of the player playing it (p. 49).
 * - RRG 1.8 "'Cannot'" (p. 11): absolute, so an encounter card's removal is stopped too.
 * - RRG 1.8 "Target" (p. 43): "A target that cannot be thwarted is not a valid target for a thwart-labeled ability."
 *
 * Synthetic cards throughout: P1 plays the focus (a player side scheme, 6 threat) and is the "you" of its rule, as
 * Focus the Senses is Daredevil's own hero card, so `{ extensionOf: controller }` names his identity; P2 is another
 * hero. The focus, the other side scheme and the main scheme each hold 6 threat.
 */

import { flat, type AnyCard, type PlayerSideSchemeCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustInstance, mustPlayer } from "./query.js";
import { characterCannotRemoveThreat } from "./rules.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import {
  stubAlly,
  stubEnvironment,
  stubEvent,
  stubSideScheme,
  stubSupport,
  stubTreachery,
  stubUpgrade,
} from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import { copiesOf, encounterCardInVillainArea, gameAtFirstTurn, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const n = (value: number) => ({ kind: "const", value }) as const;
const MAIN = { kind: "mainScheme" } as const;
const EACH_SIDE: TargetRef = { kind: "each", query: { categories: ["sideScheme"] } };
const THE_FOCUS: TargetRef = { kind: "each", query: { categories: ["sideScheme"], name: "focus" } };
const CHOSEN: TargetRef = { kind: "slot", slot: "scheme" };
const CHOOSE_A_SCHEME: EffectSpec = {
  kind: "chooseTarget",
  slot: "scheme",
  query: { categories: ["scheme"] },
  chooser: { kind: "controller" },
};
const SWEEP_EFFECT: EffectSpec = { kind: "removeThreat", target: EACH_SIDE, amount: n(1) };
const THWART_EACH: EffectSpec = { kind: "thwart", target: EACH_SIDE, amount: n(1) };
const action = (id: string, effects: readonly EffectSpec[], labeled = false): StubAbility =>
  stubAbility(
    id,
    def({ trigger: { kind: "action" }, ...(labeled ? { label: ["thwart" as const] } : {}), effects: [...effects] }),
  );

/** "Threat cannot be removed from this scheme except by [your identity]." */
const FOCUS_RULE = stubAbility("focus.constant", {
  trigger: {
    kind: "constant",
    rules: [
      {
        kind: "threatCannotBeRemoved",
        target: { self: true },
        exceptFromSource: { extensionOf: { kind: "controller" } },
      },
    ],
  },
  effects: [],
});
const FOCUS: PlayerSideSchemeCard = {
  ...stubSupport({ id: "focus", cost: 0, abilities: [FOCUS_RULE.ref] }),
  type: "player_side_scheme",
  startingThreat: flat(6),
};
const OTHER = stubSideScheme({ id: "other", startingThreat: 6 });

/** An event: "Remove 1 threat from each side scheme." (no label) */
const SWEEP_ACTION = action("sweep.action", [SWEEP_EFFECT]);
const SWEEP = stubEvent({ id: "sweep", cost: 0, abilities: [SWEEP_ACTION.ref] });
/** An event: "Hero Action (thwart): Remove 1 threat from each side scheme." */
const STRIKE_ACTION = action("strike.action", [THWART_EACH], true);
const STRIKE = stubEvent({ id: "strike", cost: 0, abilities: [STRIKE_ACTION.ref] });
/** An event: "Action (thwart): Remove 1 threat from a scheme." */
const PROBE_ACTION = action("probe.action", [CHOOSE_A_SCHEME, { kind: "thwart", target: CHOSEN, amount: n(1) }], true);
const PROBE = stubEvent({ id: "probe", cost: 0, abilities: [PROBE_ACTION.ref] });
/** An upgrade, an ally and a support, each with "Action: Remove 1 threat from each side scheme." (no label) */
const GEAR_ACTION = action("gear.action", [SWEEP_EFFECT]);
const GEAR = stubUpgrade({ id: "gear", cost: 0, abilities: [GEAR_ACTION.ref] });
const ACE_ACTION = action("ace.action", [SWEEP_EFFECT]);
const ACE = stubAlly({ id: "ace", cost: 0, atk: 1, thw: 3, hp: 3, abilities: [ACE_ACTION.ref] });
const BASE_ACTION = action("base.action", [SWEEP_EFFECT]);
const BASE = stubSupport({ id: "base", cost: 0, abilities: [BASE_ACTION.ref] });
/** A support and an ally: "Action (thwart): Remove 1 threat from each side scheme." A thwart by the identity (p. 26). */
const DESK_ACTION = action("desk.action", [THWART_EACH], true);
const DESK = stubSupport({ id: "desk", cost: 0, abilities: [DESK_ACTION.ref] });
const MARK_ACTION = action("mark.action", [THWART_EACH], true);
const MARK = stubAlly({ id: "mark", cost: 0, atk: 1, thw: 1, hp: 3, abilities: [MARK_ACTION.ref] });
/** An event that removes no threat itself: "Place 1 threat on the main scheme." */
const CUE_ACTION = action("cue.action", [{ kind: "placeThreat", target: MAIN, amount: n(1) }]);
const CUE = stubEvent({ id: "cue", cost: 0, abilities: [CUE_ACTION.ref] });
/** An environment: "Forced Response: After threat is placed on the main scheme, remove 1 threat from each side scheme." */
const SABOTAGE_FORCED = stubAbility(
  "sabotage.forced-response",
  def({
    trigger: { kind: "response", forced: true, on: { on: "placeThreat", targetIs: { categories: ["mainScheme"] } } },
    effects: [SWEEP_EFFECT],
  }),
);
const SABOTAGE = stubEnvironment({ id: "sabotage", abilities: [SABOTAGE_FORCED.ref] });
/** An event: "Move 2 threat from the focus to the main scheme." */
const SHIFT_OFF_ACTION = action("shift-off.action", [{ kind: "moveThreat", from: THE_FOCUS, to: MAIN, amount: n(2) }]);
const SHIFT_OFF = stubEvent({ id: "shift-off", cost: 0, abilities: [SHIFT_OFF_ACTION.ref] });
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });

const ABILITIES = [
  FOCUS_RULE,
  SWEEP_ACTION,
  STRIKE_ACTION,
  PROBE_ACTION,
  GEAR_ACTION,
  ACE_ACTION,
  BASE_ACTION,
  DESK_ACTION,
  MARK_ACTION,
  CUE_ACTION,
  SABOTAGE_FORCED,
  SHIFT_OFF_ACTION,
];
const deps: EngineDeps = depsOf(...ABILITIES);
const PLAYER_CARDS: readonly AnyCard[] = [FOCUS, SWEEP, STRIKE, PROBE, GEAR, ACE, BASE, DESK, MARK, CUE, SHIFT_OFF];

interface Table {
  readonly state: GameState;
  readonly focus: InstanceId;
  readonly other: InstanceId;
  readonly main: InstanceId;
}

interface Step {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}
function run(state: GameState, ...commands: readonly Command[]): Step {
  const { session, events } = driveSession(startSession(state), deps, commands);
  const replayed = replay(session.log, deps);
  expect(replayed.ok && replayed.state).toEqual(session.state);
  return { state: session.state, events };
}
const playCommand = (player: PlayerId, id: InstanceId): Command => ({
  type: "playCard",
  playerId: player,
  cardInstanceId: id,
  payment: [],
  attachToInstanceId: null,
});
function play(state: GameState, card: AnyCard, player: PlayerId = P1): Step {
  const given = giveCard(state, player, card.id);
  return run(given.state, playCommand(player, given.id));
}
/** `player` plays a copy of `card` in their hand that `owner` owns (surgery: a borrowed event, Study the Tape's shape). */
function playBorrowed(state: GameState, card: AnyCard, player: PlayerId, owner: PlayerId): Step {
  const given = giveCard(state, player, card.id);
  const borrowed: GameState = {
    ...given.state,
    instances: { ...given.state.instances, [given.id]: { ...mustInstance(given.state, given.id), ownerId: owner } },
  };
  return run(borrowed, playCommand(player, given.id));
}

/** Two heroes at P1's first turn (P1 in `p1Form`); P1 has played the focus (6); other and main scheme at 6. */
function start(p1Form: "hero" | "alterEgo" = "hero"): Table {
  const base = gameAtFirstTurn({
    players: 2,
    cards: [...PLAYER_CARDS, OTHER, SABOTAGE, FILLER],
    deps,
    deck: PLAYER_CARDS.map((card) => card.id),
    encounter: [OTHER.id, SABOTAGE.id, ...copiesOf(FILLER.id, 30)],
  });
  const main = base.mainScheme.instanceId;
  const formed: GameState = {
    ...base,
    players: base.players.map((p) => ({
      ...p,
      identity: { ...p.identity, form: p.playerId === P1 ? p1Form : ("hero" as const) },
    })),
    instances: { ...base.instances, [main]: { ...mustInstance(base, main), threat: 6 } },
  };
  const given = giveCard(formed, P1, FOCUS.id);
  const played = run(given.state, playCommand(P1, given.id)).state;
  expect(played.villainArea).toContain(given.id);
  const other = encounterCardInVillainArea(played, OTHER.id, 6);
  return { state: other.state, focus: given.id, other: other.id, main };
}

const use = (player: PlayerId, card: InstanceId, ability: StubAbility): Command => ({
  type: "useAbility",
  playerId: player,
  cardInstanceId: card,
  abilityId: ability.ref.id as Extract<Command, { type: "useAbility" }>["abilityId"],
  payment: [],
});
const hero = (state: GameState, player: PlayerId) => mustPlayer(state, player).identity.instanceId;
const basicThwart = (
  state: GameState,
  player: PlayerId,
  scheme: InstanceId,
  thwarter: InstanceId = hero(state, player),
): Extract<Command, { type: "basicThwart" }> => ({
  type: "basicThwart",
  playerId: player,
  thwarterInstanceId: thwarter,
  schemeInstanceId: scheme,
});
const threat = (state: GameState, id: InstanceId) => mustInstance(state, id).threat;
/** P2's turn: P1 ends theirs. */
const p2Turn = (state: GameState) => run(state, { type: "endTurn", playerId: P1 }).state;
/** `card` in `player`'s play area, attached to `host` when given (surgery). */
function inPlay(state: GameState, card: AnyCard, player: PlayerId, host: InstanceId | null = null) {
  const placed = playerCardIntoPlay(state, card.id, player);
  const instance = mustInstance(placed.state, placed.id);
  return {
    id: placed.id,
    state: {
      ...placed.state,
      instances: { ...placed.state.instances, [placed.id]: { ...instance, attachedTo: host } },
    },
  };
}
function thwartTargets(state: GameState, player: PlayerId, thwarter: InstanceId) {
  const actions = legalActions(state, player, deps);
  if (actions.kind !== "turn") throw new Error(`not ${player}'s turn: ${actions.kind}`);
  const mine = (a: { readonly action: { readonly kind: string; readonly instanceId?: InstanceId } }) =>
    a.action.kind === "basicThwart" && a.action.instanceId === thwarter;
  const legal = actions.legal.find(mine);
  const illegal = actions.illegal.find(mine);
  return { targets: legal?.targets ?? [], blocked: legal?.blockedTargets ?? illegal?.blockedTargets ?? [] };
}
const BLOCKED = (scheme: InstanceId) => ({ type: "threatRemovalBlocked", schemeInstanceId: scheme, reason: "rule" });
const blockedOn = (events: readonly GameEvent[], scheme: InstanceId) =>
  events.filter((e) => e.type === "threatRemovalBlocked" && e.schemeInstanceId === scheme);
const offered = (state: GameState): readonly InstanceId[] =>
  (state.pendingChoice?.options ?? []).flatMap((o) => (o.ref.kind === "card" ? [o.ref.instanceId] : []));

describe("§3.5 the identity and its extensions remove threat", () => {
  it("its basic thwart: 6 to 4, and legalActions offers the scheme", () => {
    const { state, focus } = start();
    expect(thwartTargets(state, P1, hero(state, P1)).targets).toContain(focus);
    expect(characterCannotRemoveThreat(state, deps, focus, hero(state, P1))).toBe(false);
    const after = run(state, basicThwart(state, P1, focus));
    expect(threat(after.state, focus)).toBe(4);
    expect(blockedOn(after.events, focus)).toEqual([]);
  });

  it("an unlabeled event its player plays (Living Lie Detector's shape): 6 to 5 on both side schemes", () => {
    const { state, focus, other } = start();
    const swept = play(state, SWEEP);
    expect([threat(swept.state, focus), threat(swept.state, other)]).toEqual([5, 5]);
    expect(blockedOn(swept.events, focus)).toEqual([]);
  });

  it("in alter-ego form (Matt Murdock): its '(thwart)' event removes threat, and a thwart event is offered the scheme", () => {
    const { state, focus, other, main } = start("alterEgo");
    const struck = play(state, STRIKE);
    expect([threat(struck.state, focus), threat(struck.state, other)]).toEqual([5, 5]);
    const given = giveCard(state, P1, PROBE.id);
    const asked = applyCommand(given.state, playCommand(P1, given.id), deps);
    if (!asked.ok) throw new Error(asked.error.message);
    expect([...offered(asked.state)].sort()).toEqual([main, other, focus].sort());
  });

  it("an upgrade its player controls attached to the scheme itself (Superior Taste's shape): 6 to 5", () => {
    const table = start();
    const gear = inPlay(table.state, GEAR, P1, table.focus);
    const after = run(gear.state, use(P1, gear.id, GEAR_ACTION));
    expect([threat(after.state, table.focus), threat(after.state, table.other)]).toEqual([5, 5]);
  });

  it("an upgrade attached to the identity: 6 to 5", () => {
    const { state, focus } = start();
    const gear = inPlay(state, GEAR, P1, hero(state, P1));
    expect(threat(run(gear.state, use(P1, gear.id, GEAR_ACTION)).state, focus)).toBe(5);
  });

  it.each([
    ["support", DESK, DESK_ACTION],
    ["ally", MARK, MARK_ACTION],
  ] as const)(
    "a '(thwart)'-labeled ability on its player's own %s is the identity's thwart (p. 26): 6 to 5",
    (_l, card, ability) => {
      const { state, focus, other } = start();
      const placed = inPlay(state, card, P1);
      const after = run(placed.state, use(P1, placed.id, ability));
      expect([threat(after.state, focus), threat(after.state, other)]).toEqual([5, 5]);
      expect(blockedOn(after.events, focus)).toEqual([]);
    },
  );

  it("an event another player owns that its player plays acts for its identity (p. 49): 6 to 5", () => {
    const { state, focus, other } = start();
    const swept = playBorrowed(state, SWEEP, P1, P2);
    expect([threat(swept.state, focus), threat(swept.state, other)]).toEqual([5, 5]);
  });

  it("its own event may move threat off the scheme (RRG p. 30: moved off is removed): 6 to 4, main 6 to 8", () => {
    const { state, focus, main } = start();
    const shifted = play(state, SHIFT_OFF);
    expect([threat(shifted.state, focus), threat(shifted.state, main)]).toEqual([4, 8]);
  });
});

describe("§3.5 what is not the identity or an extension of it removes nothing", () => {
  it("its player's support (Foggy Nelson's shape): the focus stays at 6, the other scheme goes to 5", () => {
    const { state, focus, other } = start();
    const base = inPlay(state, BASE, P1);
    const after = run(base.state, use(P1, base.id, BASE_ACTION));
    expect([threat(after.state, focus), threat(after.state, other)]).toEqual([6, 5]);
    expect(blockedOn(after.events, focus)).toEqual([BLOCKED(focus)]);
  });

  it("its player's upgrade attached to its player's ally is not an extension (RRG p. 49): 6", () => {
    const { state, focus, other } = start();
    const ace = inPlay(state, ACE, P1);
    const gear = inPlay(ace.state, GEAR, P1, ace.id);
    const after = run(gear.state, use(P1, gear.id, GEAR_ACTION));
    expect([threat(after.state, focus), threat(after.state, other)]).toEqual([6, 5]);
  });

  it.each([
    ["the identity's player", P1],
    ["another player", P2],
  ] as const)(
    "an ally of %s (Blindspot's shape): not a legal target of its basic thwart, and its ability removes 0",
    (_label, player) => {
      const table = start();
      const turn = player === P1 ? table.state : p2Turn(table.state);
      const ace = inPlay(turn, ACE, player);
      const { targets, blocked } = thwartTargets(ace.state, player, ace.id);
      expect(targets).toContain(table.other);
      expect(targets).not.toContain(table.focus);
      expect(blocked.find((b) => b.instanceId === table.focus)).toMatchObject({ reason: "no_valid_target" });
      expect(applyCommand(ace.state, basicThwart(ace.state, player, table.focus, ace.id), deps)).toMatchObject({
        ok: false,
        error: { code: "no_valid_target" },
      });
      const after = run(ace.state, use(player, ace.id, ACE_ACTION));
      expect([threat(after.state, table.focus), threat(after.state, table.other)]).toEqual([6, 5]);
    },
  );

  it("another hero's basic thwart is refused before any cost; the other scheme is still its to thwart", () => {
    const table = start();
    const state = p2Turn(table.state);
    const p2 = hero(state, P2);
    expect(characterCannotRemoveThreat(state, deps, table.focus, p2)).toBe(true);
    expect(thwartTargets(state, P2, p2).targets).not.toContain(table.focus);
    expect(applyCommand(state, basicThwart(state, P2, table.focus), deps)).toMatchObject({
      ok: false,
      error: { code: "no_valid_target" },
    });
    expect(mustInstance(state, p2).exhausted).toBe(false);
    expect(threat(run(state, basicThwart(state, P2, table.other)).state, table.other)).toBe(4);
  });

  it("another player's events: a thwart event is not offered the focus; unlabeled and labeled sweeps remove 0 from it", () => {
    const table = start();
    const state = p2Turn(table.state);
    const given = giveCard(state, P2, PROBE.id);
    const asked = applyCommand(given.state, playCommand(P2, given.id), deps);
    if (!asked.ok) throw new Error(asked.error.message);
    expect([...offered(asked.state)].sort()).toEqual([table.main, table.other].sort());
    for (const card of [STRIKE, SWEEP]) {
      const after = play(state, card, P2);
      expect([threat(after.state, table.focus), threat(after.state, table.other)]).toEqual([6, 5]);
      expect(blockedOn(after.events, table.focus)).toEqual([BLOCKED(table.focus)]);
    }
  });

  it.each([SWEEP, STRIKE])(
    "an event its player owns that another player plays (borrowed, %s) is that player's: the focus stays at 6",
    (card) => {
      const table = start();
      const after = playBorrowed(p2Turn(table.state), card, P2, P1);
      expect([threat(after.state, table.focus), threat(after.state, table.other)]).toEqual([6, 5]);
      expect(blockedOn(after.events, table.focus)).toEqual([BLOCKED(table.focus)]);
    },
  );

  it("an encounter card's forced effect (RRG p. 11, 'cannot' is absolute): the focus stays at 6", () => {
    const table = start();
    const sabotage = encounterCardInVillainArea(table.state, SABOTAGE.id).state;
    const after = play(sabotage, CUE);
    expect([
      threat(after.state, table.focus),
      threat(after.state, table.other),
      threat(after.state, table.main),
    ]).toEqual([6, 5, 7]);
    expect(blockedOn(after.events, table.focus)).toEqual([BLOCKED(table.focus)]);
  });
});
