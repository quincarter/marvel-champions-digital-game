/**
 * docs/phase7-wave4.md §3.21: an enemy attack against a chosen character. Synthetic minions shaped like Crossfire
 * (`hood` 24026: "Forced Interrupt: When Crossfire attacks, he attacks the friendly character with the fewest remaining
 * hit points. That attack gains overkill and ranged.") and Speed Demon (`hood` 24046: "Forced Interrupt: When a
 * character attacks Speed Demon, Speed Demon attacks that character. (Resolve Speed Demon's attack first.)").
 *
 * Sources: RRG 1.8 "Attack (Enemy Activation)" (p. 8): abilities "can instead cause an enemy to attack … an ally that
 * player controls", and "the player is still considered attacked"; "Interrupt" (p. 25).
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "./abilities.js";
import type { Command } from "./commands.js";
import type { GameEvent } from "./events.js";
import { replay, startSession } from "./engine.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { characterProfile, mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubEvent, stubMinion, stubTreachery } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const FRIENDLY = { categories: ["identity", "ally"] } as const;
const CROSSFIRE_INTERRUPT = stubAbility(
  "crossfire.forced-interrupt",
  def({
    trigger: { kind: "interrupt", forced: true, on: { on: "enemyAttack", selfIs: "source" } },
    effects: [
      {
        kind: "retargetAttack",
        character: {
          kind: "superlative",
          among: { kind: "each", query: FRIENDLY },
          order: "lowest",
          measure: { kind: "remainingHp", of: { kind: "slot", slot: "candidate" } },
          ties: "first",
        },
      },
      { kind: "modifyAttack", keywords: ["overkill", "ranged"] },
    ],
  }),
);
const CROSSFIRE = stubMinion({
  id: "crossfire",
  atk: 2,
  sch: 1,
  hp: 4,
  boostIcons: 0,
  abilities: [CROSSFIRE_INTERRUPT.ref],
});
const SPEED_INTERRUPT = stubAbility(
  "speed.forced-interrupt",
  def({
    trigger: { kind: "interrupt", forced: true, on: { on: "attack", selfIs: "target" } },
    effects: [{ kind: "enemyAttack", enemies: { kind: "self" }, targetCharacter: { kind: "eventSource" } }],
  }),
);
const SPEED = stubMinion({ id: "speed", atk: 1, sch: 1, hp: 6, boostIcons: 0, abilities: [SPEED_INTERRUPT.ref] });
/** "Action: each minion engaged with you attacks you." */
const PROVOKE_ACTION = stubAbility(
  "provoke.action",
  def({
    trigger: { kind: "action" },
    effects: [
      { kind: "enemyAttack", enemies: { kind: "each", query: { categories: ["minion"], engagedWith: "you" } } },
    ],
  }),
);
const PROVOKE = stubEvent({ id: "provoke", cost: 0, abilities: [PROVOKE_ACTION.ref] });
const FRAIL = stubAlly({ id: "frail", cost: 0, atk: 1, thw: 1, hp: 1 });
const STURDY = stubAlly({ id: "sturdy", cost: 0, atk: 2, thw: 1, hp: 3 });
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });

const deps = depsOf(CROSSFIRE_INTERRUPT, SPEED_INTERRUPT, PROVOKE_ACTION);
const DECK: readonly CardId[] = [PROVOKE.id, FRAIL.id, FRAIL.id, STURDY.id];

function start(): GameState {
  const base = gameAtFirstTurn({
    cards: [CROSSFIRE, SPEED, PROVOKE, FRAIL, STURDY, BLANK],
    deps,
    deck: DECK,
    players: 2,
    encounter: [CROSSFIRE.id, SPEED.id, ...copiesOf(BLANK.id, 20)],
  });
  return { ...base, players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })) };
}
const identityOf = (state: GameState, player: PlayerId = P1) => mustPlayer(state, player).identity.instanceId;
function run(state: GameState, commands: readonly Command[], pick = defaultPick) {
  const driven = driveSession(startSession(state), deps, commands, pick);
  return { state: driven.session.state, events: driven.events, session: driven.session };
}
const discarded = (state: GameState, id: InstanceId, player: PlayerId) =>
  mustPlayer(state, player).discard.includes(id);

describe("§3.21 'When Crossfire attacks, he attacks the friendly character with the fewest remaining hit points'", () => {
  it("the attack on P1 becomes an attack on P2's 1-hit-point ally; P2 is asked to defend, and the ally is defeated", () => {
    const base = start();
    const crossfire = minionEngagedWith(base, CROSSFIRE.id, P1);
    const frail = playerCardIntoPlay(crossfire.state, FRAIL.id, P2);
    const provoke = giveCard(frail.state, P1, PROVOKE.id);
    const defenders: PlayerId[] = [];
    const pick = (state: GameState): readonly string[] => {
      if (state.pendingChoice?.prompt.kind === "declareDefender") defenders.push(state.pendingChoice.playerId);
      return defaultPick(state);
    };
    const { state, events, session } = run(
      provoke.state,
      [{ type: "playCard", playerId: P1, cardInstanceId: provoke.id, payment: [], attachToInstanceId: null }],
      pick,
    );
    expect(defenders).toEqual([P2]);
    expect(events.find((e) => e.type === "attackRetargeted")).toMatchObject({
      targetInstanceId: frail.id,
      playerId: P2,
    });
    expect(discarded(state, frail.id, P2)).toBe(true);
    // Overkill: the ally was not defending, so its excess goes nowhere (RRG 1.8 "Overkill", p. 31); P1 is untouched.
    expect(mustInstance(state, identityOf(state, P1)).damage).toBe(0);
    // One attack: Crossfire's "when he attacks" was heard once.
    const windows = events.filter(
      (e): e is Extract<GameEvent, { type: "windowOpened" }> =>
        e.type === "windowOpened" && e.candidates.some((c) => c.abilityId === CROSSFIRE_INTERRUPT.ref.id),
    );
    expect(windows).toHaveLength(1);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(state);
  });

  it("with no ally in play, the hero with the fewest remaining hit points is attacked", () => {
    const base = start();
    const crossfire = minionEngagedWith(base, CROSSFIRE.id, P1);
    const hurt: GameState = {
      ...crossfire.state,
      instances: {
        ...crossfire.state.instances,
        [identityOf(base, P2)]: { ...mustInstance(crossfire.state, identityOf(base, P2)), damage: 5 },
      },
    };
    const provoke = giveCard(hurt, P1, PROVOKE.id);
    const { state } = run(provoke.state, [
      { type: "playCard", playerId: P1, cardInstanceId: provoke.id, payment: [], attachToInstanceId: null },
    ]);
    expect(mustInstance(state, identityOf(state, P2)).damage).toBe(5 + 2);
    expect(mustInstance(state, identityOf(state, P1)).damage).toBe(0);
  });
});

describe("§3.21 'When a character attacks Speed Demon, Speed Demon attacks that character' (targetCharacter)", () => {
  const attack = (attacker: InstanceId, target: InstanceId): Command => ({
    type: "basicAttack",
    playerId: P1,
    attackerInstanceId: attacker,
    targetInstanceId: target,
  });
  const damageDealt = (events: readonly GameEvent[]) =>
    events.filter((e): e is Extract<GameEvent, { type: "damageDealt" }> => e.type === "damageDealt");

  // §4 Q20, user decision 2026-09-25: a player's attack whose attacker has left play ends, as an enemy's does (RRG 1.8
  // "Activation", p. 6).
  it("Speed Demon defeats the attacking ally first, so the ally's attack ends: no damage to Speed Demon", () => {
    const base = start();
    const speed = minionEngagedWith(base, SPEED.id, P1);
    const frail = playerCardIntoPlay(speed.state, FRAIL.id, P1);
    const { state, events, session } = run(frail.state, [attack(frail.id, speed.id)]);
    const dealt = damageDealt(events);
    // Only Speed Demon's damage: no attack damage, and no consequential damage on the discarded ally.
    expect(dealt).toHaveLength(1);
    expect(dealt[0]).toMatchObject({ targetInstanceId: frail.id, sourceInstanceId: speed.id });
    expect(discarded(state, frail.id, P1)).toBe(true);
    expect(mustInstance(state, speed.id).damage).toBe(0);
    expect(mustInstance(state, frail.id).damage).toBe(0);
    expect(events.filter((e) => e.type === "playerAttackEnded")).toEqual([
      {
        type: "playerAttackEnded",
        attackerInstanceId: frail.id,
        targetInstanceId: speed.id,
        reason: "attackerLeftPlay",
      },
    ]);
    // Nothing hangs off an attack that ended (retaliate, "after … attacks").
    const attackedBy = (e: GameEvent, id: InstanceId) =>
      e.type === "triggerEvent" && e.event.kind === "characterAttacked" && e.event.attackerInstanceId === id;
    expect(events.some((e) => attackedBy(e, frail.id))).toBe(false);
    expect(events.some((e) => attackedBy(e, speed.id))).toBe(true);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(state);
  });

  it("baseline: an ally that survives Speed Demon's attack still deals its damage after", () => {
    const base = start();
    const speed = minionEngagedWith(base, SPEED.id, P1);
    const sturdy = playerCardIntoPlay(speed.state, STURDY.id, P1);
    const { state, events } = run(sturdy.state, [attack(sturdy.id, speed.id)]);
    const dealt = damageDealt(events);
    expect(dealt.map((e) => [e.sourceInstanceId, e.targetInstanceId])).toEqual([
      [speed.id, sturdy.id],
      [sturdy.id, speed.id],
      [sturdy.id, sturdy.id], // its 1 consequential damage, after the attack
    ]);
    expect(mustInstance(state, sturdy.id).damage).toBe(2);
    expect(mustInstance(state, speed.id).damage).toBe(2);
    expect(events.some((e) => e.type === "playerAttackEnded")).toBe(false);
    expect(
      events.some(
        (e) =>
          e.type === "triggerEvent" && e.event.kind === "characterAttacked" && e.event.attackerInstanceId === sturdy.id,
      ),
    ).toBe(true);
  });

  it("baseline: a hero's attack is answered by Speed Demon's first, then deals its damage", () => {
    const base = start();
    const speed = minionEngagedWith(base, SPEED.id, P1);
    const hero = identityOf(speed.state, P1);
    const heroAtk = characterProfile(speed.state, hero, deps)?.atk ?? 0;
    const { state, events } = run(speed.state, [attack(hero, speed.id)]);
    expect(damageDealt(events).map((e) => [e.sourceInstanceId, e.targetInstanceId])).toEqual([
      [speed.id, hero],
      [hero, speed.id],
    ]);
    expect(mustInstance(state, hero).damage).toBe(1);
    expect(mustInstance(state, speed.id).damage).toBe(heroAtk);
    expect(events.some((e) => e.type === "playerAttackEnded")).toBe(false);
  });
});
