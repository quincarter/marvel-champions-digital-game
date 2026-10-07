/**
 * docs/phase7-wave7.md §3.1 gap 3, §4.1 Q2 (owner decision, 2026-10-04): "The player who defeated this scheme deals 5
 * per player damage to the villain" (Lay the Trap's wording) and "… removes 5 per player threat from the main scheme"
 * (Keep Them Busy's) when no player removed the last threat. The When Defeated still resolves, with no player as its
 * source: the damage is dealt and the threat removed, nothing keyed to one player answers it ("after you deal damage",
 * "after you remove threat") and no rule on what one player may do applies to it. What applies to the whole table
 * still does: a crisis icon stops the removal (RRG 1.8 "Crisis Icon", p. 14: "threat cannot be removed from the main
 * scheme by player cards") and a tough status card absorbs the damage (RRG 1.8 "Tough", p. 44).
 *
 * The effect names its player with `by` (`EffectSpec dealDamage.by`, `removeThreat.by`); a `by` naming nobody marks
 * the event `noPlayer`. Synthetic cards throughout.
 */

import { flat, type AnyCard, type PlayerSideSchemeCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEnvironment, stubEvent, stubSideScheme, stubSupport, stubTreachery } from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import { copiesOf, encounterCardInVillainArea, gameAtFirstTurn, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const n = (value: number) => ({ kind: "const", value }) as const;
const MAIN = { kind: "mainScheme" } as const;
const DEFEATING_PLAYER = { kind: "defeatingPlayer" } as const;
const FIVE_PER_PLAYER = { kind: "perPlayer", base: 0, perPlayer: 5 } as const;
const YOUR_HERO = { kind: "identityOf", player: { kind: "controller" } } as const;

function playerSideScheme(id: string, whenDefeated: EffectSpec) {
  const ability = stubAbility(
    `${id}.when-defeated`,
    def({ trigger: { kind: "whenDefeated" }, effects: [whenDefeated] }),
  );
  const card: PlayerSideSchemeCard = {
    ...stubSupport({ id, cost: 0 }),
    type: "player_side_scheme",
    startingThreat: flat(4),
    abilities: [ability.ref],
  };
  return { card, ability };
}
/** "When Defeated: The player who defeated this scheme deals 5 per player damage to the villain." */
const TRAP = playerSideScheme("trap", {
  kind: "dealDamage",
  target: { kind: "villain" },
  amount: FIVE_PER_PLAYER,
  by: DEFEATING_PLAYER,
});
/** "When Defeated: The player who defeated this scheme removes 5 per player threat from the main scheme." */
const BUSY = playerSideScheme("busy", {
  kind: "removeThreat",
  target: MAIN,
  amount: FIVE_PER_PLAYER,
  by: DEFEATING_PLAYER,
});

/** A player event that neither deals damage nor removes threat: "Place 1 threat on the main scheme." */
const CUE_ACTION = stubAbility("cue.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "placeThreat", target: MAIN, amount: n(1) }],
});
const CUE = stubEvent({ id: "cue", cost: 0, abilities: [CUE_ACTION.ref] });
/**
 * An environment: "Forced Response: After threat is placed on the main scheme, remove 9 threat from each side scheme."
 * An encounter card's forced ability, so no player removes that threat.
 */
const SABOTAGE_FORCED = stubAbility(
  "sabotage.forced-response",
  def({
    trigger: { kind: "response", forced: true, on: { on: "placeThreat", targetIs: { categories: ["mainScheme"] } } },
    effects: [{ kind: "removeThreat", target: { kind: "each", query: { categories: ["sideScheme"] } }, amount: n(9) }],
  }),
);
const SABOTAGE = stubEnvironment({ id: "sabotage", abilities: [SABOTAGE_FORCED.ref] });

/** A support: "Forced Response: After a card you control deals damage to the villain, deal 1 damage to your hero." */
const DAMAGE_WATCH_FORCED = stubAbility(
  "damage-watch.forced-response",
  def({
    trigger: {
      kind: "response",
      forced: true,
      on: { on: "dealDamage", sourceIs: { controller: "you" }, targetIs: { categories: ["villain"] } },
    },
    effects: [{ kind: "dealDamage", target: YOUR_HERO, amount: n(1) }],
  }),
);
const DAMAGE_WATCH = stubSupport({ id: "damage-watch", cost: 0, abilities: [DAMAGE_WATCH_FORCED.ref] });
/** A support: "Forced Response: After you remove threat from the main scheme, deal 1 damage to your hero." */
const THREAT_WATCH_FORCED = stubAbility(
  "threat-watch.forced-response",
  def({
    trigger: {
      kind: "response",
      forced: true,
      on: { on: "removeThreat", playerIs: "controller", targetIs: { categories: ["mainScheme"] } },
    },
    effects: [{ kind: "dealDamage", target: YOUR_HERO, amount: n(1) }],
  }),
);
const THREAT_WATCH = stubSupport({ id: "threat-watch", cost: 0, abilities: [THREAT_WATCH_FORCED.ref] });

/** An environment: "P1 cannot remove threat from the main scheme." (a rule on one player, docs/phase7-wave3.md §3.26) */
const WARD_CONSTANT = stubAbility("ward.constant", {
  trigger: {
    kind: "constant",
    rules: [
      { kind: "threatCannotBeRemoved", target: { categories: ["mainScheme"] }, player: { kind: "id", playerId: P1 } },
    ],
  },
  effects: [],
});
const WARD = stubEnvironment({ id: "ward", abilities: [WARD_CONSTANT.ref] });
/** A side scheme with a crisis icon. */
const SIEGE = stubSideScheme({ id: "siege", startingThreat: 30, icons: ["crisis"] });
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });

const ABILITIES = [
  TRAP.ability,
  BUSY.ability,
  CUE_ACTION,
  SABOTAGE_FORCED,
  DAMAGE_WATCH_FORCED,
  THREAT_WATCH_FORCED,
  WARD_CONSTANT,
];
const deps: EngineDeps = depsOf(...ABILITIES);
const PLAYER_CARDS: readonly AnyCard[] = [TRAP.card, BUSY.card, CUE, DAMAGE_WATCH, THREAT_WATCH];

/** Every player in hero form at the first player's first turn, the main scheme at 16 threat, the sabotage in play. */
function start(players: 1 | 2): GameState {
  const base = gameAtFirstTurn({
    players,
    cards: [...PLAYER_CARDS, SABOTAGE, WARD, SIEGE, FILLER],
    deps,
    deck: PLAYER_CARDS.map((card) => card.id),
    encounter: [SABOTAGE.id, WARD.id, SIEGE.id, ...copiesOf(FILLER.id, 30)],
  });
  const main = base.mainScheme.instanceId;
  const state: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
    instances: { ...base.instances, [main]: { ...mustInstance(base, main), threat: 16 } },
  };
  return encounterCardInVillainArea(state, SABOTAGE.id).state;
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
function play(state: GameState, card: AnyCard, player: PlayerId = P1): Step & { readonly id: InstanceId } {
  const given = giveCard(state, player, card.id);
  const step = run(given.state, {
    type: "playCard",
    playerId: player,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  });
  return { ...step, id: given.id };
}
const hero = (state: GameState, player: PlayerId) => mustPlayer(state, player).identity.instanceId;
const heroDamage = (state: GameState, player: PlayerId) => mustInstance(state, hero(state, player)).damage;
const villain = (state: GameState) => state.activeVillainId;
const villainDamage = (state: GameState) => mustInstance(state, villain(state)).damage;
const mainThreat = (state: GameState) => mustInstance(state, state.mainScheme.instanceId).threat;
const withThreat = (state: GameState, id: InstanceId, value: number): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...mustInstance(state, id), threat: value } },
});
/** P1's event places 1 threat on the main scheme (16 → 17); the sabotage answers and removes the scheme's last threat. */
const sabotaged = (state: GameState) => play(state, CUE);
/** `player`'s hero (THW 2) thwarts the scheme, cut down to 2 threat, on that player's turn. */
function thwartedBy(state: GameState, player: PlayerId, scheme: InstanceId): Step {
  const ready = withThreat(state, scheme, 2);
  const turn = player === P1 ? ready : run(ready, { type: "endTurn", playerId: P1 }).state;
  return run(turn, {
    type: "basicThwart",
    playerId: player,
    thwarterInstanceId: hero(turn, player),
    schemeInstanceId: scheme,
  });
}

describe("Q2: 'the player who defeated this scheme deals damage' when no player defeated it", () => {
  it.each([
    [1, 5],
    [2, 10],
  ] as const)("the damage is still dealt to the villain: %i player(s), %i damage", (players, dealt) => {
    const trap = play(start(players), TRAP.card);
    const after = sabotaged(trap.state);
    expect(mustPlayer(after.state, P1).discard).toContain(trap.id);
    expect(villainDamage(after.state)).toBe(dealt);
    expect(after.events.filter((event) => event.type === "schemeDefeated")).toHaveLength(1);
  });

  it("the log names the scheme as the source and no player", () => {
    const trap = play(start(2), TRAP.card);
    const after = sabotaged(trap.state);
    expect(after.events.filter((event) => event.type === "damageDealt")).toEqual([
      {
        type: "damageDealt",
        targetInstanceId: villain(after.state),
        amount: 10,
        sourceInstanceId: trap.id,
        noPlayer: true,
      },
    ]);
  });

  it("the controller's 'after a card you control deals damage' is not triggered", () => {
    const trap = play(start(2), TRAP.card);
    const watch = playerCardIntoPlay(trap.state, DAMAGE_WATCH.id, P1);
    const after = sabotaged(watch.state);
    expect(villainDamage(after.state)).toBe(10);
    expect(heroDamage(after.state, P1)).toBe(0);
    expect(
      after.events.some((event) => event.type === "abilityResolved" && event.abilityId === DAMAGE_WATCH_FORCED.ref.id),
    ).toBe(false);
  });

  it("the villain's tough status card absorbs it", () => {
    const trap = play(start(2), TRAP.card);
    const id = villain(trap.state);
    const tough: GameState = {
      ...trap.state,
      instances: {
        ...trap.state.instances,
        [id]: { ...mustInstance(trap.state, id), statuses: { ...mustInstance(trap.state, id).statuses, tough: 1 } },
      },
    };
    const after = sabotaged(tough);
    expect(villainDamage(after.state)).toBe(0);
    expect(mustInstance(after.state, id).statuses.tough).toBe(0);
    expect(after.events).toContainEqual(
      expect.objectContaining({ type: "damagePrevented", targetInstanceId: id, reason: "tough" }),
    );
    expect(after.events.some((event) => event.type === "damageDealt")).toBe(false);
  });

  it("unchanged when its controller defeats it: that player's response answers, and the log marks nothing", () => {
    const trap = play(start(2), TRAP.card);
    const watch = playerCardIntoPlay(trap.state, DAMAGE_WATCH.id, P1);
    const after = thwartedBy(watch.state, P1, trap.id);
    expect(villainDamage(after.state)).toBe(10);
    expect(heroDamage(after.state, P1)).toBe(1);
    const dealt = after.events.filter(
      (event) => event.type === "damageDealt" && event.targetInstanceId === villain(after.state),
    );
    expect(dealt).toEqual([
      { type: "damageDealt", targetInstanceId: villain(after.state), amount: 10, sourceInstanceId: trap.id },
    ]);
  });

  // `by` naming a player other than the card's controller changes nothing for damage: damage events carry no player,
  // and "a card you control deals damage" reads the source card's controller. Not asked for by Q2; needs a player on
  // the `dealDamage` event and every reader of the source's controller moved to it.
  it.todo("another player defeats it: 'after you deal damage' answers for the defeating player, not the controller");
});

describe("Q2: 'the player who defeated this scheme removes threat' when no player defeated it", () => {
  it.each([
    [1, 12],
    [2, 7],
  ] as const)("the threat still leaves the main scheme: %i player(s), 17 → %i", (players, left) => {
    const busy = play(start(players), BUSY.card);
    const after = sabotaged(busy.state);
    expect(mustPlayer(after.state, P1).discard).toContain(busy.id);
    expect(mainThreat(after.state)).toBe(left);
  });

  it("the log names the scheme as the source and no player", () => {
    const busy = play(start(2), BUSY.card);
    const after = sabotaged(busy.state);
    const main = after.state.mainScheme.instanceId;
    expect(after.events.filter((event) => event.type === "threatRemoved" && event.schemeInstanceId === main)).toEqual([
      { type: "threatRemoved", schemeInstanceId: main, amount: 10, sourceInstanceId: busy.id, noPlayer: true },
    ]);
  });

  it("the controller's 'after you remove threat' is not triggered", () => {
    const busy = play(start(2), BUSY.card);
    const watch = playerCardIntoPlay(busy.state, THREAT_WATCH.id, P1);
    const after = sabotaged(watch.state);
    expect(mainThreat(after.state)).toBe(7);
    expect(heroDamage(after.state, P1)).toBe(0);
    expect(
      after.events.some((event) => event.type === "abilityResolved" && event.abilityId === THREAT_WATCH_FORCED.ref.id),
    ).toBe(false);
  });

  it("a rule that its controller cannot remove threat from the main scheme does not stop it", () => {
    const busy = play(start(2), BUSY.card);
    const ward = encounterCardInVillainArea(busy.state, WARD.id).state;
    const after = sabotaged(ward);
    expect(mainThreat(after.state)).toBe(7);
    expect(after.events.some((event) => event.type === "threatRemovalBlocked")).toBe(false);
  });

  it("a crisis icon stops it: it is still a player card's removal", () => {
    const busy = play(start(2), BUSY.card);
    const siege = encounterCardInVillainArea(busy.state, SIEGE.id, 30);
    const after = sabotaged(siege.state);
    expect(mustPlayer(after.state, P1).discard).toContain(busy.id);
    expect(mainThreat(after.state)).toBe(17);
    expect(after.events).toContainEqual({
      type: "threatRemovalBlocked",
      schemeInstanceId: after.state.mainScheme.instanceId,
      reason: "crisis",
    });
  });

  it("unchanged when its controller defeats it: that player's response answers, and the log marks nothing", () => {
    const busy = play(start(2), BUSY.card);
    const watch = playerCardIntoPlay(busy.state, THREAT_WATCH.id, P1);
    const after = thwartedBy(watch.state, P1, busy.id);
    const main = after.state.mainScheme.instanceId;
    expect(mainThreat(after.state)).toBe(16 - 10);
    expect(heroDamage(after.state, P1)).toBe(1);
    expect(after.events.filter((event) => event.type === "threatRemoved" && event.schemeInstanceId === main)).toEqual([
      { type: "threatRemoved", schemeInstanceId: main, amount: 10, sourceInstanceId: busy.id },
    ]);
  });

  it("unchanged when its controller defeats it: a rule on that player stops the removal", () => {
    const busy = play(start(2), BUSY.card);
    const ward = encounterCardInVillainArea(busy.state, WARD.id).state;
    const after = thwartedBy(ward, P1, busy.id);
    expect(mainThreat(after.state)).toBe(16);
    expect(after.events).toContainEqual({
      type: "threatRemovalBlocked",
      schemeInstanceId: after.state.mainScheme.instanceId,
      reason: "rule",
    });
  });

  it("another player defeats it: that player removes the threat, so a rule on its controller does not apply", () => {
    const busy = play(start(2), BUSY.card);
    const ward = encounterCardInVillainArea(busy.state, WARD.id).state;
    const p1Watch = playerCardIntoPlay(ward, THREAT_WATCH.id, P1);
    const p2Watch = playerCardIntoPlay(p1Watch.state, THREAT_WATCH.id, P2);
    const after = thwartedBy(p2Watch.state, P2, busy.id);
    expect(mainThreat(after.state)).toBe(16 - 10);
    // "After you remove threat" answers for the defeating player, not for the scheme's controller.
    expect([heroDamage(after.state, P1), heroDamage(after.state, P2)]).toEqual([0, 1]);
  });
});

describe("a player side scheme nobody controls (docs/phase7-wave7.md §4.1 Q24) reads the same `by`", () => {
  /** The scheme in play as the scenario puts it there: nobody's card (surgery). */
  function unowned(state: GameState, id: InstanceId): GameState {
    return {
      ...state,
      instances: { ...state.instances, [id]: { ...mustInstance(state, id), ownerId: null, controllerId: null } },
    };
  }

  it("no player defeats it: the threat still leaves the main scheme, by no player", () => {
    const busy = play(start(2), BUSY.card);
    const watch = playerCardIntoPlay(unowned(busy.state, busy.id), THREAT_WATCH.id, P1);
    const after = sabotaged(watch.state);
    const main = after.state.mainScheme.instanceId;
    expect(mainThreat(after.state)).toBe(7);
    expect(heroDamage(after.state, P1)).toBe(0);
    expect(after.events.filter((event) => event.type === "threatRemoved" && event.schemeInstanceId === main)).toEqual([
      { type: "threatRemoved", schemeInstanceId: main, amount: 10, sourceInstanceId: busy.id, noPlayer: true },
    ]);
  });

  it("a player defeats it: that player removes the threat", () => {
    const busy = play(start(2), BUSY.card);
    const watch = playerCardIntoPlay(unowned(busy.state, busy.id), THREAT_WATCH.id, P1);
    const after = thwartedBy(watch.state, P1, busy.id);
    expect(mainThreat(after.state)).toBe(16 - 10);
    expect(heroDamage(after.state, P1)).toBe(1);
  });
});
