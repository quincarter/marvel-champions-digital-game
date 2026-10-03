/**
 * docs/phase7-wave6.md §3.29: `modifyAttack.extraDamage`, "this attack deals N additional damage" for a player attack in
 * progress (Coup de Grâce 32176/32181, Full Blast 33008, Warrior Skill 35016). Added to the damage the attack deals
 * after its amount is computed — a basic attack's ATK, an "(attack)" ability's or event's amount with its
 * `cardEffectBonus` — and dealt as one damage instance, so overkill, excess and a tough status see the total (RRG 1.8
 * "Overkill", p. 31). Synthetic cards; the real Coup de Grâce is in `@mc/cards` (`wave6/mut_gen/role-upgrades.ts`).
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { activeEncounterDeck, activeVillain, mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import { stubEvent, stubIdentity, stubMinion, stubSupport } from "./testing/fixtures.js";
import { giveCard, newGame } from "./testing/scenario.js";
import { copiesOf, minionEngagedWith, P1, playerCardIntoPlay } from "./testing/wave3.js";

const c = (value: number) => ({ kind: "const", value }) as const;
/** "your hero": your identity (the `@mc/cards` `YOUR_IDENTITY` query). */
const yourIdentity = { categories: ["identity"], controller: "you" } as const;

/** "Hero Action (attack): Deal 3 damage to the villain" on the identity. */
const blast = stubAbility("blast.action", {
  trigger: { kind: "action" },
  label: ["attack"],
  effects: [{ kind: "attack", target: { kind: "villain" }, amount: c(3) }],
});
/** "(attack): Deal 3 damage to the villain" on an event. */
const kick = stubAbility("kick.action", {
  trigger: { kind: "action" },
  label: ["attack"],
  effects: [{ kind: "attack", target: { kind: "villain" }, amount: c(3) }],
});
/** "When you play an event, increase the amount of damage it deals by 1" (a standing Embiggen!). */
const embiggen = stubAbility("embiggen.interrupt", {
  trigger: {
    kind: "interrupt",
    forced: true,
    on: { on: "cardBeingPlayed", playerIs: "controller", targetIs: { categories: ["event"] } },
  },
  effects: [{ kind: "modifyCardEffect", card: { kind: "eventTarget" }, damage: c(1) }],
});
/** "When your hero attacks, this attack deals 2 additional damage. Discard this card." (one use, so one attack) */
const coup = stubAbility("coup.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "attack", sourceIs: yourIdentity } },
  effects: [
    { kind: "modifyAttack", extraDamage: c(2) },
    { kind: "discardFromPlay", target: { kind: "self" } },
  ],
});
/** The same, and "… and gains overkill". */
const smash = stubAbility("smash.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "attack", sourceIs: yourIdentity } },
  effects: [
    { kind: "modifyAttack", extraDamage: c(2), overkill: true },
    { kind: "discardFromPlay", target: { kind: "self" } },
  ],
});

const IDENTITY = stubIdentity({
  id: "blaster",
  hp: 10,
  atk: 2,
  thw: 1,
  def: 1,
  rec: 3,
  heroHandSize: 5,
  alterEgoHandSize: 6,
  heroAbilities: [blast.ref],
});
const KICK = stubEvent({ id: "kick", cost: 0, abilities: [kick.ref] });
const EMBIGGEN = stubSupport({ id: "embiggen", cost: 0, abilities: [embiggen.ref] });
const COUP = stubSupport({ id: "coup", cost: 0, abilities: [coup.ref] });
const SMASH = stubSupport({ id: "smash", cost: 0, abilities: [smash.ref] });
const THUG = stubMinion({ id: "thug", atk: 0, sch: 0, hp: 3, boostIcons: 0 });

const deps: EngineDeps = depsOf(blast, kick, embiggen, coup, smash);

/** Hero form, first turn, with `supports` already in play and the thug engaged when `thug` is asked for. */
function table(supports: readonly CardId[], thug = false): { state: GameState; thug: InstanceId | null } {
  let state = newGame({
    identity: IDENTITY,
    extraCards: [KICK, EMBIGGEN, COUP, SMASH, THUG],
    deck: [...copiesOf(KICK.id, 4), EMBIGGEN.id, COUP.id, SMASH.id, ...copiesOf("res" as CardId, 10)],
    encounterDeck: [...copiesOf(THUG.id, 2), ...copiesOf("treachery" as CardId, 20)],
    deps,
  });
  state = runCommands(state, deps, { type: "changeForm", playerId: P1 }).state;
  for (const card of supports) state = playerCardIntoPlay(state, card).state;
  if (!thug) return { state, thug: null };
  const engaged = minionEngagedWith(state, THUG.id);
  return { state: engaged.state, thug: engaged.id };
}

/** Runs `commands` through a session and checks the log replays to the same state. */
function drive(state: GameState, ...commands: Command[]): GameState {
  const run = runCommands(state, deps, ...commands);
  const replayed = replay(run.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(run.session.state);
  return run.state;
}

const hero = (state: GameState): InstanceId => mustPlayer(state, P1).identity.instanceId;
const villainOf = (state: GameState): InstanceId => activeVillain(state)!.instanceId;
const damageOn = (state: GameState, id: InstanceId): number => mustInstance(state, id).damage;
const basicAttack = (state: GameState, target: InstanceId): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: hero(state),
  targetInstanceId: target,
});
const useBlast = (state: GameState): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: hero(state),
  abilityId: blast.ref.id,
  payment: [],
});

describe("§3.29 `modifyAttack.extraDamage` on a player attack in progress", () => {
  it("a basic attack deals its ATK + N", () => {
    const { state: start } = table([COUP.id]);
    const villain = villainOf(start);
    expect(damageOn(drive(start, basicAttack(start, villain)), villain)).toBe(2 + 2);
  });

  it("an '(attack)' identity ability deals its amount + N", () => {
    const { state: start } = table([COUP.id]);
    const villain = villainOf(start);
    expect(damageOn(drive(start, useBlast(start)), villain)).toBe(3 + 2);
  });

  it("an attack event takes its card damage bonus and the extra damage both", () => {
    const { state: before } = table([EMBIGGEN.id, COUP.id]);
    const given = giveCard(before, P1, KICK.id);
    const villain = villainOf(given.state);
    const after = drive(given.state, {
      type: "playCard",
      playerId: P1,
      cardInstanceId: given.id,
      payment: [],
      attachToInstanceId: null,
    });
    expect(damageOn(after, villain)).toBe(3 + 1 + 2);
  });

  it("is damage dealt: overkill spills what the target takes beyond its hit points (RRG 1.8 'Overkill', p. 31)", () => {
    const { state: start, thug } = table([SMASH.id], true);
    const villain = villainOf(start);
    const after = drive(start, basicAttack(start, thug!));
    // 2 ATK + 2 into a 3-hit-point minion: defeated, 1 excess to the villain.
    expect(activeEncounterDeck(after).discard).toContain(thug!);
    expect(damageOn(after, villain)).toBe(1);
  });

  it("is one damage instance: a tough status replaces all of it, so no excess (RRG 1.8 'Tough', p. 44)", () => {
    const { state: staged, thug } = table([SMASH.id], true);
    const start: GameState = {
      ...staged,
      instances: {
        ...staged.instances,
        [thug!]: { ...mustInstance(staged, thug!), statuses: { ...mustInstance(staged, thug!).statuses, tough: 1 } },
      },
    };
    const villain = villainOf(start);
    const after = drive(start, basicAttack(start, thug!));
    expect(mustInstance(after, thug!).statuses.tough).toBe(0);
    expect(damageOn(after, thug!)).toBe(0);
    expect(damageOn(after, villain)).toBe(0);
  });

  it("the next attack is unaffected", () => {
    const { state: start } = table([COUP.id]);
    const villain = villainOf(start);
    const first = drive(start, basicAttack(start, villain));
    expect(damageOn(first, villain)).toBe(4);
    expect(damageOn(drive(first, useBlast(first)), villain)).toBe(4 + 3);
  });

  it("without it the attack deals its own amount", () => {
    const { state: start } = table([]);
    const villain = villainOf(start);
    expect(damageOn(drive(start, basicAttack(start, villain)), villain)).toBe(2);
  });
});
