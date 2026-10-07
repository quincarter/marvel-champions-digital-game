/**
 * docs/phase7-wave7.md §3.51, §4.1 Q29 = A: "Characters other than [X] cannot remove threat from [this scheme]" is
 * `RuleSpec threatCannotBeRemoved` with `exceptBy`, a query on the removing **character**.
 *
 * Who the character is, per removal:
 *
 * - a basic thwart: the thwarting character (RRG 1.8 "Thwart", p. 44);
 * - a "(thwart)"-labeled ability, on whatever card: its player's identity (RRG 1.8 "Labeled Ability", p. 26: "that
 *   ability is considered to be a thwart made by that player's identity");
 * - an event's unlabeled removal: its player's identity; an upgrade's: its controller's identity "unless attached to a
 *   different friendly character", which the engine reads as that character's (RRG 1.8 "You, Your", p. 49);
 * - an ally's ability: the ally (p. 49: not "performed by that player's identity"; RRG 1.8 "Character", p. 12: an
 *   ally is a character);
 * - a support's unlabeled ability, an encounter card that is not a villain or minion, a removal no player makes:
 *   no character, so the rule does not bind it (Q29 = A: only characters are barred).
 *
 * Threat moved off the scheme is removed from it (RRG 1.8 "Move", p. 30: "the moved threat is considered to be removed
 * from that scheme") and is barred the same way; threat moved onto it and an effect that discards the scheme are not
 * removals. Synthetic cards throughout: P1's hero is the named identity, P2's is another hero.
 */

import type { AnyCard } from "@mc/content";
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
import { choiceExclusions } from "./why-not.js";

const def = (definition: AbilityDefinition) => definition;
const n = (value: number) => ({ kind: "const", value }) as const;
const MAIN = { kind: "mainScheme" } as const;
const EACH_SIDE: TargetRef = { kind: "each", query: { categories: ["sideScheme"] } };
const THE_PURGE: TargetRef = { kind: "each", query: { categories: ["sideScheme"], name: "purge" } };
const CHOSEN: TargetRef = { kind: "slot", slot: "scheme" };
const CHOOSE_A_SCHEME: EffectSpec = {
  kind: "chooseTarget",
  slot: "scheme",
  query: { categories: ["scheme"] },
  chooser: { kind: "controller" },
};
const SWEEP_EFFECT: EffectSpec = { kind: "removeThreat", target: EACH_SIDE, amount: n(1) };
const action = (id: string, effects: readonly EffectSpec[], labeled = false): StubAbility =>
  stubAbility(
    id,
    def({ trigger: { kind: "action" }, ...(labeled ? { label: ["thwart" as const] } : {}), effects: [...effects] }),
  );

/** "Characters other than hero (hero) cannot remove threat from this scheme." P1's identity shows that title as a hero. */
const PURGE_RULE = stubAbility("purge.constant", {
  trigger: {
    kind: "constant",
    rules: [
      {
        kind: "threatCannotBeRemoved",
        target: { self: true },
        exceptBy: { categories: ["identity"], name: "hero (hero)" },
      },
    ],
  },
  effects: [],
});
const PURGE = stubSideScheme({ id: "purge", startingThreat: 6, abilities: [PURGE_RULE.ref] });
const OTHER = stubSideScheme({ id: "other", startingThreat: 6 });

/** An event: "Remove 1 threat from each side scheme." */
const SWEEP_ACTION = action("sweep.action", [SWEEP_EFFECT]);
const SWEEP = stubEvent({ id: "sweep", cost: 0, abilities: [SWEEP_ACTION.ref] });
/** An event: "Hero Action (thwart): Remove 1 threat from each side scheme." */
const STRIKE_ACTION = action("strike.action", [{ kind: "thwart", target: EACH_SIDE, amount: n(1) }], true);
const STRIKE = stubEvent({ id: "strike", cost: 0, abilities: [STRIKE_ACTION.ref] });
/** An event: "Remove 1 threat from a scheme." */
const PICK_ACTION = action("pick.action", [CHOOSE_A_SCHEME, { kind: "removeThreat", target: CHOSEN, amount: n(1) }]);
const PICK = stubEvent({ id: "pick", cost: 0, abilities: [PICK_ACTION.ref] });
/** An event: "Hero Action (thwart): Remove 1 threat from a scheme." */
const PROBE_ACTION = action("probe.action", [CHOOSE_A_SCHEME, { kind: "thwart", target: CHOSEN, amount: n(1) }], true);
const PROBE = stubEvent({ id: "probe", cost: 0, abilities: [PROBE_ACTION.ref] });
/** An upgrade, an ally and a support, each with "Action: Remove 1 threat from each side scheme." */
const GEAR_ACTION = action("gear.action", [SWEEP_EFFECT]);
const GEAR = stubUpgrade({ id: "gear", cost: 0, abilities: [GEAR_ACTION.ref] });
const ACE_ACTION = action("ace.action", [SWEEP_EFFECT]);
const ACE = stubAlly({ id: "ace", cost: 0, atk: 1, thw: 1, hp: 3, abilities: [ACE_ACTION.ref] });
const BASE_ACTION = action("base.action", [SWEEP_EFFECT]);
const BASE = stubSupport({ id: "base", cost: 0, abilities: [BASE_ACTION.ref] });
/** A support: "Action (thwart): Remove 1 threat from each side scheme." A thwart by its player's identity (p. 26). */
const DESK_ACTION = action("desk.action", [{ kind: "thwart", target: EACH_SIDE, amount: n(1) }], true);
const DESK = stubSupport({ id: "desk", cost: 0, abilities: [DESK_ACTION.ref] });
/** A support, Wasp's shape: "You may divide your hero's basic thwart among any number of schemes." */
const SPLIT_RULE = stubAbility("split.constant", {
  trigger: {
    kind: "constant",
    rules: [{ kind: "divideBasicPower", power: "thwart", target: { categories: ["identity"], controller: "you" } }],
  },
  effects: [],
});
const SPLIT = stubSupport({ id: "split", cost: 0, abilities: [SPLIT_RULE.ref] });
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
/** An event whose removal names a player who is nobody here ("the player who defeated this scheme"): task 1b's shape. */
const NOBODY_ACTION = action("nobody.action", [{ ...SWEEP_EFFECT, by: { kind: "defeatingPlayer" } } as EffectSpec]);
const NOBODY = stubEvent({ id: "nobody", cost: 0, abilities: [NOBODY_ACTION.ref] });
/** Events: "Move 2 threat from the purge to the main scheme." / "Move 2 threat from the main scheme to the purge." */
const SHIFT_OFF_ACTION = action("shift-off.action", [{ kind: "moveThreat", from: THE_PURGE, to: MAIN, amount: n(2) }]);
const SHIFT_OFF = stubEvent({ id: "shift-off", cost: 0, abilities: [SHIFT_OFF_ACTION.ref] });
const SHIFT_ON_ACTION = action("shift-on.action", [{ kind: "moveThreat", from: MAIN, to: THE_PURGE, amount: n(2) }]);
const SHIFT_ON = stubEvent({ id: "shift-on", cost: 0, abilities: [SHIFT_ON_ACTION.ref] });
/** An event: "Discard the purge." It removes no threat. */
const SCRAP_ACTION = action("scrap.action", [{ kind: "discardFromPlay", target: THE_PURGE }]);
const SCRAP = stubEvent({ id: "scrap", cost: 0, abilities: [SCRAP_ACTION.ref] });
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });

const deps: EngineDeps = depsOf(
  PURGE_RULE,
  SWEEP_ACTION,
  STRIKE_ACTION,
  PICK_ACTION,
  PROBE_ACTION,
  GEAR_ACTION,
  ACE_ACTION,
  BASE_ACTION,
  DESK_ACTION,
  SPLIT_RULE,
  CUE_ACTION,
  SABOTAGE_FORCED,
  NOBODY_ACTION,
  SHIFT_OFF_ACTION,
  SHIFT_ON_ACTION,
  SCRAP_ACTION,
);
const PLAYER_CARDS: readonly AnyCard[] = [
  SWEEP,
  STRIKE,
  PICK,
  PROBE,
  GEAR,
  ACE,
  BASE,
  DESK,
  SPLIT,
  CUE,
  NOBODY,
  SHIFT_OFF,
  SHIFT_ON,
  SCRAP,
];

interface Table {
  readonly state: GameState;
  readonly purge: InstanceId;
  readonly other: InstanceId;
  readonly main: InstanceId;
}
/** Two players at P1's first turn, both heroes unless `p1Form` says otherwise; purge, other and main scheme at 6 threat. */
function start(p1Form: "hero" | "alterEgo" = "hero"): Table {
  const base = gameAtFirstTurn({
    players: 2,
    cards: [...PLAYER_CARDS, PURGE, OTHER, SABOTAGE, FILLER],
    deps,
    // A second copy of the upgrade, for the one attached and the one not.
    deck: [...PLAYER_CARDS.map((card) => card.id), GEAR.id],
    encounter: [PURGE.id, OTHER.id, SABOTAGE.id, ...copiesOf(FILLER.id, 30)],
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
  const purge = encounterCardInVillainArea(formed, PURGE.id, 6);
  const other = encounterCardInVillainArea(purge.state, OTHER.id, 6);
  return { state: other.state, purge: purge.id, other: other.id, main };
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
const blockedOn = (events: readonly GameEvent[], scheme: InstanceId) =>
  events.filter((e) => e.type === "threatRemovalBlocked" && e.schemeInstanceId === scheme);
const offered = (state: GameState): readonly InstanceId[] =>
  (state.pendingChoice?.options ?? []).flatMap((o) => (o.ref.kind === "card" ? [o.ref.instanceId] : []));

describe("§3.51 the named identity removes threat by any means", () => {
  it("by its basic thwart, which legalActions offers against the scheme", () => {
    const { state, purge } = start();
    expect(thwartTargets(state, P1, hero(state, P1)).targets).toContain(purge);
    const after = run(state, basicThwart(state, P1, purge));
    expect(threat(after.state, purge)).toBe(4);
    expect(blockedOn(after.events, purge)).toEqual([]);
  });

  it("by an event it plays, labeled a thwart or not", () => {
    const { state, purge, other } = start();
    const swept = play(state, SWEEP);
    expect([threat(swept.state, purge), threat(swept.state, other)]).toEqual([5, 5]);
    const struck = play(swept.state, STRIKE);
    expect([threat(struck.state, purge), threat(struck.state, other)]).toEqual([4, 4]);
    expect(blockedOn([...swept.events, ...struck.events], purge)).toEqual([]);
  });

  it("by an upgrade attached to it, and by one in its player's play area attached to nothing", () => {
    const { state, purge } = start();
    const attached = inPlay(state, GEAR, P1, hero(state, P1));
    const first = run(attached.state, use(P1, attached.id, GEAR_ACTION));
    expect(threat(first.state, purge)).toBe(5);
    const loose = inPlay(first.state, GEAR, P1);
    expect(loose.id).not.toBe(attached.id);
    expect(threat(run(loose.state, use(P1, loose.id, GEAR_ACTION)).state, purge)).toBe(4);
  });

  it("but not while it shows its alter-ego's title: nothing of its player's then removes threat", () => {
    const { state, purge, other } = start("alterEgo");
    const swept = play(state, SWEEP);
    expect([threat(swept.state, purge), threat(swept.state, other)]).toEqual([6, 5]);
    expect(blockedOn(swept.events, purge)).toEqual([
      { type: "threatRemovalBlocked", schemeInstanceId: purge, reason: "rule" },
    ]);
  });
});

describe("§3.51 another hero is barred", () => {
  it("its basic thwart is not a legal action against the scheme, and a forced command is refused before any cost", () => {
    const table = start();
    const state = p2Turn(table.state);
    const p2 = hero(state, P2);
    const { targets, blocked } = thwartTargets(state, P2, p2);
    expect(targets).toContain(table.other);
    expect(targets).not.toContain(table.purge);
    expect(blocked.find((b) => b.instanceId === table.purge)).toMatchObject({
      reason: "no_valid_target",
      message: "this character cannot remove threat from that scheme",
    });
    const refused = applyCommand(state, basicThwart(state, P2, table.purge), deps);
    expect(refused).toMatchObject({ ok: false, error: { code: "no_valid_target" } });
    expect(mustInstance(state, p2).exhausted).toBe(false);
    // The other scheme is still its to thwart (THW 2).
    expect(threat(run(state, basicThwart(state, P2, table.other)).state, table.other)).toBe(4);
  });

  it("its thwart event and its removal event cannot choose the scheme, and why-not names the reason", () => {
    const table = start();
    const state = p2Turn(table.state);
    for (const card of [PROBE, PICK]) {
      const given = giveCard(state, P2, card.id);
      const asked = applyCommand(given.state, playCommand(P2, given.id), deps);
      if (!asked.ok) throw new Error(asked.error.message);
      expect([...offered(asked.state)].sort()).toEqual([table.main, table.other].sort());
      expect(choiceExclusions(asked.state, deps)).toContainEqual({
        instanceId: table.purge,
        reason: "cannotRemoveThreat",
      });
    }
    // The named identity is offered all three, and nothing is reported against the scheme.
    const given = giveCard(table.state, P1, PROBE.id);
    const asked = applyCommand(given.state, playCommand(P1, given.id), deps);
    if (!asked.ok) throw new Error(asked.error.message);
    expect(offered(asked.state)).toContain(table.purge);
    expect(choiceExclusions(asked.state, deps).filter((e) => e.instanceId === table.purge)).toEqual([]);
  });

  it("an event of its that sweeps every side scheme removes threat from the others only", () => {
    const table = start();
    const state = p2Turn(table.state);
    for (const card of [SWEEP, STRIKE]) {
      const after = play(state, card, P2);
      expect([threat(after.state, table.purge), threat(after.state, table.other)]).toEqual([6, 5]);
      expect(blockedOn(after.events, table.purge)).toEqual([
        { type: "threatRemovalBlocked", schemeInstanceId: table.purge, reason: "rule" },
      ]);
    }
  });

  it("a divided basic thwart cannot include the scheme", () => {
    const table = start();
    const split = inPlay(p2Turn(table.state), SPLIT, P2).state;
    const share = (targetInstanceId: InstanceId) => ({ targetInstanceId, amount: 1 });
    const divided = (first: InstanceId, second: InstanceId): Command => ({
      ...basicThwart(split, P2, first),
      divide: [share(first), share(second)],
    });
    for (const command of [divided(table.other, table.purge), divided(table.purge, table.other)]) {
      expect(applyCommand(split, command, deps)).toMatchObject({ ok: false, error: { code: "no_valid_target" } });
    }
    const after = run(split, divided(table.other, table.main)).state;
    expect([threat(after, table.purge), threat(after, table.other), threat(after, table.main)]).toEqual([6, 5, 5]);
  });

  it("a '(thwart)'-labeled ability on its support is its identity's thwart, so that is barred too", () => {
    const table = start();
    const desk = inPlay(p2Turn(table.state), DESK, P2);
    const after = run(desk.state, use(P2, desk.id, DESK_ACTION));
    expect([threat(after.state, table.purge), threat(after.state, table.other)]).toEqual([6, 5]);
  });

  // Owner ruling 2026-10-06 (docs/phase7-wave7.md §4.1): a move whose source's threat cannot be removed cannot be made
  // (RRG 1.8 "Move", p. 30), so the ability is not initiated and the card stays in hand.
  it("it cannot move threat off the scheme (RRG p. 30: moved off is removed): the event is refused; moving threat on is not barred", () => {
    const table = start();
    const state = p2Turn(table.state);
    const given = giveCard(state, P2, SHIFT_OFF.id);
    const refused = applyCommand(given.state, playCommand(P2, given.id), deps);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error.code).toBe("no_valid_target");
    expect(mustPlayer(given.state, P2).hand).toContain(given.id);
    const on = play(state, SHIFT_ON, P2).state;
    expect([threat(on, table.purge), threat(on, table.main)]).toEqual([8, 4]);
    // The named identity moves it off.
    const mine = play(table.state, SHIFT_OFF).state;
    expect([threat(mine, table.purge), threat(mine, table.main)]).toEqual([4, 8]);
  });

  it("an effect of its that discards the scheme removes no threat and is not barred", () => {
    const table = start();
    const after = play(p2Turn(table.state), SCRAP, P2).state;
    expect(after.villainArea).not.toContain(table.purge);
  });
});

describe("§3.51 an ally is a character other than the identity, whoever controls it", () => {
  it.each([
    ["the named identity's player", P1],
    ["another player", P2],
  ] as const)("an ally of %s: its basic thwart and its ability are barred", (_label, player) => {
    const table = start();
    const turn = player === P1 ? table.state : p2Turn(table.state);
    const ace = inPlay(turn, ACE, player);
    const { targets, blocked } = thwartTargets(ace.state, player, ace.id);
    expect(targets).toContain(table.other);
    expect(targets).not.toContain(table.purge);
    expect(blocked.find((b) => b.instanceId === table.purge)?.reason).toBe("no_valid_target");
    expect(applyCommand(ace.state, basicThwart(ace.state, player, table.purge, ace.id), deps)).toMatchObject({
      ok: false,
      error: { code: "no_valid_target" },
    });
    const after = run(ace.state, use(player, ace.id, ACE_ACTION));
    expect([threat(after.state, table.purge), threat(after.state, table.other)]).toEqual([6, 5]);
    expect(blockedOn(after.events, table.purge)).toHaveLength(1);
  });

  it("an upgrade the named identity's player attached to their ally acts as that ally", () => {
    const table = start();
    const ace = inPlay(table.state, ACE, P1);
    const gear = inPlay(ace.state, GEAR, P1, ace.id);
    const after = run(gear.state, use(P1, gear.id, GEAR_ACTION)).state;
    expect([threat(after, table.purge), threat(after, table.other)]).toEqual([6, 5]);
  });
});

describe("§3.51 Q29 = A: what is not a character is not barred", () => {
  it("another player's support removes threat with an unlabeled ability", () => {
    const table = start();
    const base = inPlay(p2Turn(table.state), BASE, P2);
    const after = run(base.state, use(P2, base.id, BASE_ACTION));
    expect([threat(after.state, table.purge), threat(after.state, table.other)]).toEqual([5, 5]);
    expect(blockedOn(after.events, table.purge)).toEqual([]);
  });

  it("an encounter card's forced effect removes threat", () => {
    const table = start();
    const sabotage = encounterCardInVillainArea(p2Turn(table.state), SABOTAGE.id).state;
    const after = play(sabotage, CUE, P2).state;
    expect([threat(after, table.purge), threat(after, table.other), threat(after, table.main)]).toEqual([5, 5, 7]);
  });

  it("a removal no player makes (removeThreat.noPlayer) removes threat, though another hero's event carries it", () => {
    const table = start();
    const after = play(p2Turn(table.state), NOBODY, P2);
    expect([threat(after.state, table.purge), threat(after.state, table.other)]).toEqual([5, 5]);
    expect(after.events).toContainEqual(
      expect.objectContaining({ type: "threatRemoved", schemeInstanceId: table.purge, noPlayer: true }),
    );
  });
});

describe("§3.51 the rule's reach", () => {
  it("ends when the scheme leaves play: defeated by the named identity, nothing is left of it", () => {
    const table = start();
    const p2 = hero(table.state, P2);
    expect(characterCannotRemoveThreat(table.state, deps, table.purge, p2)).toBe(true);
    const low: GameState = {
      ...table.state,
      instances: { ...table.state.instances, [table.purge]: { ...mustInstance(table.state, table.purge), threat: 2 } },
    };
    const after = run(low, basicThwart(low, P1, table.purge)).state;
    expect(after.villainArea).not.toContain(table.purge);
    expect(characterCannotRemoveThreat(after, deps, table.purge, p2)).toBe(false);
    // Another hero then thwarts the remaining side scheme as usual.
    const next = p2Turn(after);
    expect(thwartTargets(next, P2, hero(next, P2)).blocked).toEqual([]);
    expect(threat(run(next, basicThwart(next, P2, table.other)).state, table.other)).toBe(4);
  });

  it.todo(
    "an upgrade one player controls attached to another player's identity: RRG p. 49 says only that it is not its controller's identity's",
  );
  it.todo(
    "a villain's or minion's own ability removing threat: a character as written (RRG p. 12), so barred here; Q29 named encounter cards as allowed",
  );
});
