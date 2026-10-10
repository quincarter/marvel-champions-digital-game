/**
 * Overkill's excess damage is dealt before the When Defeated abilities of the character it spilled from.
 *
 * MC50 (Agents of S.H.I.E.L.D.) rulebook FAQ, p. 22: "Overkill damage is simultaneous with the damage from the attack,
 * so the 'Forced Interrupt' on M.O.D.O.K. resolves first because it uses the word 'would.' Then, the 'When Defeated'
 * ability of the Adaptoid resolves." RRG 1.8 "Damage" (p. 14) orders placing damage (step 5), "would be defeated"
 * (step 6), When Defeated (step 7) and the discard (step 8); "Overkill" (p. 31) deals the excess "if a minion is
 * defeated by an attack with the overkill keyword", to the villain, and an ally's to its controller's identity.
 *
 * So: the attacked character's own defeat window, the defeat, the spill and whatever defeat the spill causes (its
 * "would be defeated" interrupt, a villain stage falling), and only then the attacked character's When Defeated and
 * its leaving play. A defeat replaced in its own window spills nothing. Synthetic cards only.
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { activeVillain, mustInstance, mustPlayer } from "./query.js";
import { cardsInPlay } from "./select.js";
import type { EffectSpec, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { stubAlly, stubEvent, stubMinion, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { defaultPick } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, playerCardIntoPlay, playFree } from "./testing/wave3.js";

const self: TargetRef = { kind: "self" };
const theVillain: TargetRef = { kind: "villain" };
const n = (value: number): ValueSpec => ({ kind: "const", value });

/** "When Defeated: place 1 'seen' counter on this card for each damage on [what]." (Read from the log: it leaves.) */
const whenDefeated = (id: string, reads: TargetRef) =>
  stubAbility(`${id}.when-defeated`, {
    trigger: { kind: "whenDefeated" },
    effects: [{ kind: "addCounters", target: self, counterType: "seen", amount: { kind: "damage", of: reads } }],
  });
const GRUNT_DEFEATED = whenDefeated("grunt", theVillain);
const GRUNT = stubMinion({ id: "ok-grunt", atk: 1, sch: 1, hp: 3, abilities: [GRUNT_DEFEATED.ref] });

/** "Forced Interrupt: When this minion would be defeated, set its remaining hit points to 1 instead." */
const SURVIVES = stubAbility("survivor.would-be-defeated", {
  trigger: { kind: "interrupt", forced: true, would: true, on: { on: "characterDefeated", selfIs: "target" } },
  effects: [{ kind: "replaceTriggeringEvent", with: [{ kind: "setRemainingHitPoints", target: self, amount: n(1) }] }],
});
const SURVIVOR = stubMinion({ id: "ok-survivor", atk: 1, sch: 1, hp: 3, abilities: [SURVIVES.ref] });

/** "Forced Interrupt: When [the villain] would be defeated, reset his hit points to 10 instead." */
const WOULD_FALL = stubAbility("overlord.would-be-defeated", {
  trigger: { kind: "interrupt", forced: true, would: true, on: { on: "characterDefeated", selfIs: "target" } },
  effects: [
    {
      kind: "replaceTriggeringEvent",
      with: [{ kind: "setRemainingHitPoints", target: self, amount: n(10), reset: true }],
    },
  ],
});
/** "Each enemy attack gains overkill." */
const ENEMY_OVERKILL = stubAbility("brute.constant", {
  trigger: {
    kind: "constant",
    rules: [{ kind: "attackKeywords", keywords: ["overkill"], attacker: { categories: ["enemy"] } }],
  },
  effects: [],
});
const TOUGH_GUY = stubVillain({ id: "ok-tough-guy", stages: [{ hp: flat(30), atk: 1, sch: 1 }] });
const OVERLORD = stubVillain({
  id: "ok-overlord",
  stages: [
    { hp: flat(10), atk: 1, sch: 1, abilities: [WOULD_FALL.ref] },
    { hp: flat(20), atk: 1, sch: 1 },
  ],
});
const TWO_STAGES = stubVillain({
  id: "ok-two-stages",
  stages: [
    { hp: flat(5), atk: 1, sch: 1 },
    { hp: flat(20), atk: 1, sch: 1 },
  ],
});
const LAST_STAGE = stubVillain({ id: "ok-last-stage", stages: [{ hp: flat(5), atk: 1, sch: 1 }] });
const BRUTE = stubVillain({
  id: "ok-brute",
  stages: [{ hp: flat(30), atk: 5, sch: 1, abilities: [ENEMY_OVERKILL.ref] }],
});
const VILLAINS = [TOUGH_GUY, OVERLORD, TWO_STAGES, LAST_STAGE, BRUTE];

/** An ally whose When Defeated reads the damage on its controller's identity. */
const PAL_DEFEATED = whenDefeated("pal", { kind: "identityOf", player: { kind: "controller" } });
const PAL = stubAlly({ id: "ok-pal", cost: 0, atk: 1, thw: 1, hp: 2, abilities: [PAL_DEFEATED.ref] });
/** An ally whose When Defeated reads the damage on the villain. */
const SCOUT_DEFEATED = whenDefeated("scout", theVillain);
const SCOUT = stubAlly({ id: "ok-scout", cost: 0, atk: 1, thw: 1, hp: 2, abilities: [SCOUT_DEFEATED.ref] });
const BLANK = stubTreachery({ id: "ok-blank", boostIcons: 0 });

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
/** "Hero Action (attack): Deal 10 damage to each minion. This attack gains overkill." */
const CLEAVE = event("ok-cleave", [
  { kind: "attack", target: { kind: "each", query: { categories: ["minion"] } }, amount: n(10), overkill: true },
]);

const deps: EngineDeps = depsOf(
  GRUNT_DEFEATED,
  SURVIVES,
  WOULD_FALL,
  ENEMY_OVERKILL,
  PAL_DEFEATED,
  SCOUT_DEFEATED,
  CLEAVE.ability,
);

function start(villain: (typeof VILLAINS)[number]): GameState {
  const base = gameAtFirstTurn({
    deps,
    villain,
    cards: [GRUNT, SURVIVOR, PAL, SCOUT, BLANK, CLEAVE.card],
    encounter: [GRUNT.id, SURVIVOR.id, ...copiesOf(BLANK.id, 12)],
    deck: [PAL.id, SCOUT.id, ...copiesOf(CLEAVE.card.id, 2)],
  });
  // Attacks are hero actions, and the villain attacks a hero.
  return { ...base, players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })) };
}

const withDamage = (state: GameState, id: InstanceId, damage: number): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...mustInstance(state, id), damage } },
});
const villainId = (state: GameState) => activeVillain(state).instanceId;
const villainDamage = (state: GameState) => mustInstance(state, villainId(state)).damage;
/** What `id`'s When Defeated read: the 'seen' counters it placed on itself (0 placed logs nothing). */
const seen = (events: readonly GameEvent[], id: InstanceId) =>
  events
    .filter((e) => e.type === "counterAdded" && e.instanceId === id && e.counterType === "seen")
    .reduce((sum, e) => sum + (e.type === "counterAdded" ? e.amount : 0), 0);
const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

/** The log order of: damage landing on `spillTo`, each named ability resolving, and `left` leaving play. */
function order(
  events: readonly GameEvent[],
  spillTo: InstanceId,
  abilities: Readonly<Record<string, string>>,
  left: InstanceId,
): string[] {
  return events.flatMap((e) =>
    e.type === "damageDealt" && e.targetInstanceId === spillTo
      ? [`spill ${e.amount}`]
      : e.type === "abilityResolved" && abilities[e.abilityId] !== undefined
        ? [abilities[e.abilityId]!]
        : e.type === "cardMoved" && e.instanceId === left
          ? ["leaves play"]
          : e.type === "villainStageAdvanced"
            ? ["next stage"]
            : [],
  );
}

describe("overkill from a player's attack onto the villain (RRG 1.8 p. 31, MC50 FAQ p. 22)", () => {
  it("10 damage on a 3 hit point minion: the 7 excess lands on the villain before the minion's When Defeated, which reads the 7", () => {
    const grunt = minionEngagedWith(start(TOUGH_GUY), GRUNT.id);
    const { state, events, session } = playFree(grunt.state, deps, CLEAVE.card.id);
    expect(of(events, "overkillSpilled")).toEqual([
      { type: "overkillSpilled", fromInstanceId: grunt.id, toInstanceId: villainId(state), amount: 7 },
    ]);
    expect(order(events, villainId(state), { [GRUNT_DEFEATED.ref.id]: "when defeated" }, grunt.id)).toEqual([
      "spill 7",
      "when defeated",
      "leaves play",
    ]);
    expect(seen(events, grunt.id)).toBe(7);
    expect(villainDamage(state)).toBe(7);
    expect(cardsInPlay(state)).not.toContain(grunt.id);
    const replayed = replay(session.log, deps);
    expect(replayed.ok && replayed.state).toEqual(state);
  });

  it("the excess takes the villain to 0: his 'would be defeated' interrupt resets him to 10, then the minion's When Defeated reads no damage on him", () => {
    const grunt = minionEngagedWith(start(OVERLORD), GRUNT.id);
    const hurt = withDamage(grunt.state, villainId(grunt.state), 5); // 5 of 10 left, 7 excess coming
    const { state, events } = playFree(hurt, deps, CLEAVE.card.id);
    const villain = villainId(state);
    expect(
      order(
        events,
        villain,
        { [WOULD_FALL.ref.id]: "would be defeated", [GRUNT_DEFEATED.ref.id]: "when defeated" },
        grunt.id,
      ),
    ).toEqual(["spill 7", "would be defeated", "when defeated", "leaves play"]);
    expect(of(events, "hitPointsSet")).toMatchObject([{ instanceId: villain, remaining: 10, damage: 0 }]);
    expect(villainDamage(state)).toBe(0);
    expect(activeVillain(state).stageIndex).toBe(0);
    expect(seen(events, grunt.id)).toBe(0); // before the fix it read the 5 he had before the spill
  });

  it("the excess defeats a villain stage: the next stage is in play, undamaged, when the minion's When Defeated resolves", () => {
    const grunt = minionEngagedWith(start(TWO_STAGES), GRUNT.id);
    const { state, events } = playFree(grunt.state, deps, CLEAVE.card.id);
    expect(order(events, villainId(state), { [GRUNT_DEFEATED.ref.id]: "when defeated" }, grunt.id)).toEqual([
      "spill 7",
      "next stage",
      "when defeated",
      "leaves play",
    ]);
    expect(activeVillain(state).stageIndex).toBe(1);
    expect(villainDamage(state)).toBe(0); // RRG 1.8 "Villain Defeat" (p. 47): excess does not carry over
    expect(seen(events, grunt.id)).toBe(0);
  });

  it("the excess defeats the last villain stage: the players win, and the minion's When Defeated never resolves", () => {
    const grunt = minionEngagedWith(start(LAST_STAGE), GRUNT.id);
    const { state, events } = playFree(grunt.state, deps, CLEAVE.card.id);
    expect(state.outcome).toMatchObject({ result: "win", reason: "villainDefeated" });
    expect(of(events, "abilityResolved").filter((e) => e.abilityId === GRUNT_DEFEATED.ref.id)).toEqual([]);
  });

  it("a minion whose defeat is replaced in its own window is not defeated, so nothing spills (RRG 1.8 p. 31: 'if a minion is defeated')", () => {
    const survivor = minionEngagedWith(start(TOUGH_GUY), SURVIVOR.id);
    const { state, events } = playFree(survivor.state, deps, CLEAVE.card.id);
    expect(of(events, "overkillSpilled")).toEqual([]);
    expect(of(events, "characterDefeated")).toEqual([]);
    expect(villainDamage(state)).toBe(0);
    expect(cardsInPlay(state)).toContain(survivor.id);
    expect(mustInstance(state, survivor.id).damage).toBe(2);
  });

  it("defeated together with another character at 0: the excess lands before either When Defeated, and both read it", () => {
    const grunt = minionEngagedWith(start(TOUGH_GUY), GRUNT.id);
    const scout = playerCardIntoPlay(grunt.state, SCOUT.id);
    // Surgery: the ally already has damage equal to its hit points, so the attack's sweep defeats both at once.
    const { state, events } = playFree(withDamage(scout.state, scout.id, 2), deps, CLEAVE.card.id);
    expect(
      of(events, "characterDefeated")
        .map((e) => e.instanceId)
        .sort(),
    ).toEqual([grunt.id, scout.id].sort());
    const spill = events.findIndex((e) => e.type === "damageDealt" && e.targetInstanceId === villainId(state));
    const firstWhenDefeated = events.findIndex(
      (e) => e.type === "abilityResolved" && [GRUNT_DEFEATED.ref.id, SCOUT_DEFEATED.ref.id].includes(e.abilityId),
    );
    expect(spill).toBeGreaterThan(-1);
    expect(spill).toBeLessThan(firstWhenDefeated);
    expect(seen(events, grunt.id)).toBe(7);
    expect(seen(events, scout.id)).toBe(7);
    expect(villainDamage(state)).toBe(7);
  });
});

describe("overkill from an enemy's attack on an ally onto its controller's identity (RRG 1.8 p. 31, p. 10)", () => {
  it("5 damage on a defending 2 hit point ally: the 3 excess lands on the identity before the ally's When Defeated, which reads the 3", () => {
    const pal = playerCardIntoPlay(start(BRUTE), PAL.id);
    const hero = mustPlayer(pal.state, P1).identity.instanceId;
    const before = mustInstance(pal.state, hero).damage;
    const endTurn: Command = { type: "endTurn", playerId: P1 };
    const pick = (s: GameState) =>
      s.pendingChoice?.prompt.kind === "declareDefender" && s.pendingChoice.options.some((o) => o.optionId === pal.id)
        ? [pal.id as string]
        : defaultPick(s);
    const { state, events } = runCommandsPicking(pal.state, deps, pick, endTurn);
    expect(of(events, "overkillSpilled")).toEqual([
      { type: "overkillSpilled", fromInstanceId: pal.id, toInstanceId: hero, amount: 3 },
    ]);
    expect(order(events, hero, { [PAL_DEFEATED.ref.id]: "when defeated" }, pal.id)).toEqual([
      "spill 3",
      "when defeated",
      "leaves play",
    ]);
    expect(mustInstance(state, hero).damage).toBe(before + 3);
    expect(seen(events, pal.id)).toBe(before + 3);
    expect(mustPlayer(state, P1).discard).toContain(pal.id);
  });
});
