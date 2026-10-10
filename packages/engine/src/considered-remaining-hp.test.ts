/**
 * docs/phase7-wave8.md §3.10: "is considered to have at least 1 hit point" (`RuleSpec consideredRemainingHp`, owner
 * decision §4.1 Q6 = A). Synthetic villains shaped like the Four Horsemen ("cannot be defeated while another villain has
 * at least 1 hit point") and an attachment shaped like Golden Horse ("Attach to the villain with the fewest hit points
 * without the Aerial trait. Attached villain gains the Aerial trait and is considered to have at least 1 hit point.").
 *
 * Sources: RRG 1.8 "Remaining Hit Points" (p. 36), "Hit Points" (p. 22), "Defeat" (p. 15: "If a character has zero or
 * fewer remaining hit points … it is defeated"), "'Cannot'" (p. 11).
 */

import { flat, trait, type AttachmentHost, type VillainCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { preview } from "./preview.js";
import { mustInstance, remainingHitPoints } from "./query.js";
import { attachmentHostCandidates } from "./resolve/index.js";
import { consideredRemainingHitPoints, hitPointFloor, traitsOf, type EffectContext } from "./select.js";
import { createGame } from "./setup.js";
import type { EffectSpec, Predicate, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import {
  stubAttachment,
  stubEvent,
  stubMainScheme,
  stubMinion,
  stubTreachery,
  stubVillain,
} from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, giveCard, HERO } from "./testing/scenario.js";
import { copiesOf, minionEngagedWith, P1, playFree } from "./testing/wave3.js";

const AERIAL = trait("Aerial");
const n = (value: number): ValueSpec => ({ kind: "const", value });
const named = (name: string): TargetRef => ({ kind: "named", name });
const hasHitPoint = (of: TargetRef): Predicate => ({
  kind: "compare",
  left: { kind: "remainingHp", of },
  op: "atLeast",
  right: n(1),
});

const NAMES = ["war", "famine", "death"] as const;
type Name = (typeof NAMES)[number];

/** "[Name] cannot be defeated while another villain has at least 1 hit point." */
const protectedWhileAnother = (name: Name) =>
  stubAbility(`${name}.constant`, {
    trigger: {
      kind: "constant",
      rules: [
        {
          kind: "cannotBeDefeated",
          target: { self: true },
          while: {
            kind: "or",
            of: NAMES.filter((other) => other !== name).map((other) => hasHitPoint(named(other))),
          },
        },
      ],
    },
    effects: [],
  });
const PROTECTION = Object.fromEntries(NAMES.map((name) => [name, protectedWhileAnother(name)])) as Record<
  Name,
  StubAbility
>;
const VILLAINS = Object.fromEntries(
  NAMES.map((name) => [
    name,
    stubVillain({ id: name, stages: [{ hp: flat(5), atk: 0, sch: 0, abilities: [PROTECTION[name].ref] }] }),
  ]),
) as Record<Name, VillainCard>;

const HORSE_HOST: AttachmentHost = {
  kind: "superlative",
  among: "villain",
  order: "lowest",
  measure: "remainingHp",
  withoutTrait: AERIAL,
};
const HOST = { categories: ["villain"], hostOfSelf: true } as const;
const HORSE_CONSTANT = stubAbility("horse.constant", {
  trigger: {
    kind: "constant",
    traitGrants: [{ trait: AERIAL, target: HOST }],
    rules: [{ kind: "consideredRemainingHp", target: HOST, atLeast: 1 }],
  },
  effects: [],
});
const HORSE = stubAttachment({ id: "horse", attachesTo: HORSE_HOST, abilities: [HORSE_CONSTANT.ref] });
/** The same host text without the trait condition: it ranks purely by remaining hit points. */
const LOWEST_HOST: AttachmentHost = { kind: "superlative", among: "villain", order: "lowest", measure: "remainingHp" };

/** A floor that holds only while its host carries no more than 6 damage. */
const BRITTLE_CONSTANT = stubAbility("brittle.constant", {
  trigger: {
    kind: "constant",
    rules: [
      {
        kind: "consideredRemainingHp",
        target: HOST,
        atLeast: 1,
        while: {
          kind: "compare",
          left: { kind: "damage", of: { kind: "host" } },
          op: "atMost",
          right: n(6),
        },
      },
    ],
  },
  effects: [],
});
const BRITTLE = stubAttachment({ id: "brittle", abilities: [BRITTLE_CONSTANT.ref] });

/** A minion that "is considered to have at least 1 hit point" by its own text. */
const STUBBORN_CONSTANT = stubAbility("stubborn.constant", {
  trigger: { kind: "constant", rules: [{ kind: "consideredRemainingHp", target: { self: true }, atLeast: 1 }] },
  effects: [],
});
const STUBBORN = stubMinion({
  id: "stubborn",
  atk: 0,
  sch: 0,
  hp: 2,
  boostIcons: 0,
  abilities: [STUBBORN_CONSTANT.ref],
});

const action = (id: string, ...effects: EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const hit = (name: string, amount: number) =>
  action(`hit-${name}-${amount}`, { kind: "dealDamage", target: named(name), amount: n(amount) });
const HIT_WAR = hit("war", 5);
const HIT_FAMINE = hit("famine", 5);
const HIT_DEATH = hit("death", 5);
const HIT_FAMINE_2 = hit("famine", 2);
const HIT_STUBBORN = hit("stubborn", 3);
const HEAL_FAMINE = action("heal-famine", { kind: "heal", target: named("famine"), amount: n(3) });
/** "If War has at least 1 hit point, deal 1 damage to your identity": a reader of the considered value. */
const PROBE = action("probe", {
  kind: "if",
  condition: hasHitPoint(named("war")),
  then: [{ kind: "dealDamage", target: { kind: "identityOf", player: { kind: "controller" } }, amount: n(1) }],
});
const UNHORSE = action("unhorse", {
  kind: "discardFromPlay",
  target: { kind: "each", query: { categories: ["attachment"] } },
});
const SLAY = action("slay", { kind: "defeat", target: named("stubborn") });
const EVENTS = [HIT_WAR, HIT_FAMINE, HIT_DEATH, HIT_FAMINE_2, HIT_STUBBORN, HEAL_FAMINE, PROBE, UNHORSE, SLAY];

const SCHEME = stubMainScheme({
  id: "the-row",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });

const CONSTANTS = [HORSE_CONSTANT, BRITTLE_CONSTANT, STUBBORN_CONSTANT, ...EVENTS.map((e) => e.ability)];
/** The three villains protect each other. */
const deps: EngineDeps = depsOf(...NAMES.map((name) => PROTECTION[name]), ...CONSTANTS);
/** Nothing protects a villain but the floor. */
const unprotected: EngineDeps = depsOf(...CONSTANTS);

function start(withDeps: EngineDeps = deps): GameState {
  const result = createGame(
    {
      seed: 5,
      cards: [
        ...DEFAULT_CARDS,
        ...NAMES.map((name) => VILLAINS[name]),
        SCHEME,
        FILLER,
        HORSE,
        BRITTLE,
        STUBBORN,
        ...EVENTS.map((e) => e.card),
      ],
      villainCardId: VILLAINS.war.id,
      villains: NAMES.map((name) => ({ villainCardId: VILLAINS[name].id, encounterDeck: [] })),
      sharedEncounterDeck: true,
      mainSchemeCardId: SCHEME.id,
      encounterDeck: [HORSE.id, HORSE.id, BRITTLE.id, STUBBORN.id, ...copiesOf(FILLER.id, 10)],
      includeIdentitySets: false,
      players: [{ identityCardId: HERO.id, deck: [...DEFAULT_DECK, ...EVENTS.flatMap((e) => copiesOf(e.card.id, 2))] }],
    },
    withDeps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return driveSession(startSession(result.state), withDeps).session.state;
}

const idOf = (state: GameState, name: Name): InstanceId => {
  const found = state.villains.find((v) => v.cardId === name);
  if (!found) throw new Error(`no villain ${name}`);
  return found.instanceId;
};
const damageOf = (state: GameState, name: Name): number => mustInstance(state, idOf(state, name)).damage;
const withDamage = (state: GameState, damage: Partial<Record<Name, number>>): GameState => ({
  ...state,
  instances: {
    ...state.instances,
    ...Object.fromEntries(
      Object.entries(damage).map(([name, amount]) => {
        const id = idOf(state, name as Name);
        return [id, { ...mustInstance(state, id), damage: amount }];
      }),
    ),
  },
});
/** Attaches the first copy of `card` in an encounter deck to `host` (surgery: no reveal). */
function attach(state: GameState, card: string, host: InstanceId): { state: GameState; id: InstanceId } {
  for (const [deckId, piles] of Object.entries(state.encounterDecks)) {
    const id = piles.deck.find((candidate) => state.instances[candidate]?.cardId === card);
    if (!id) continue;
    return {
      id,
      state: {
        ...state,
        encounterDecks: { ...state.encounterDecks, [deckId]: { ...piles, deck: piles.deck.filter((x) => x !== id) } },
        instances: {
          ...state.instances,
          [id]: { ...mustInstance(state, id), faceup: true, attachedTo: host },
          [host]: { ...mustInstance(state, host), attachments: [...mustInstance(state, host).attachments, id] },
        },
      },
    };
  }
  throw new Error(`no ${card} in an encounter deck`);
}
const defeatedNames = (state: GameState) => state.villains.filter((v) => v.defeated).map((v) => v.cardId);
const hostContext = (id: InstanceId, withDeps: EngineDeps): EffectContext => ({
  selfInstanceId: id,
  controllerId: null,
  event: null,
  bindings: {},
  deps: withDeps,
});
const heroDamage = (state: GameState) => mustInstance(state, state.players[0]!.identity.instanceId).damage;

describe("§3.10 considered to have at least 1 hit point", () => {
  it("a reader of remaining hit points sees 1 on a floored villain at 0, and 0 without the floor; the dial stays 0", () => {
    const zero = withDamage(start(), { war: 5 });
    const war = idOf(zero, "war");
    expect(consideredRemainingHitPoints(zero, war, deps)).toBe(0);
    expect(heroDamage(playFree(zero, deps, PROBE.card.id).state)).toBe(0);

    const horsed = attach(zero, HORSE.id, war).state;
    expect(remainingHitPoints(horsed, war, deps)).toBe(0);
    expect(hitPointFloor(horsed, war, deps)).toBe(1);
    expect(consideredRemainingHitPoints(horsed, war, deps)).toBe(1);
    // "If War has at least 1 hit point": true through the floor.
    expect(heroDamage(playFree(horsed, deps, PROBE.card.id).state)).toBe(1);
    // A villain above the floor reads its own dial.
    expect(hitPointFloor(horsed, idOf(horsed, "famine"), deps)).toBeUndefined();
    expect(consideredRemainingHitPoints(horsed, idOf(horsed, "famine"), deps)).toBe(5);
  });

  it("the defeat check sees it: a villain alone at 0 under the floor is not defeated, takes more damage (his dial stays at 0), and falls when the attachment leaves", () => {
    const horsed = attach(start(unprotected), HORSE.id, idOf(start(unprotected), "famine")).state;
    const struck = playFree(horsed, unprotected, HIT_FAMINE.card.id);
    expect(damageOf(struck.state, "famine")).toBe(5);
    expect(defeatedNames(struck.state)).toEqual([]);
    expect(struck.events.filter((e) => e.type === "characterDefeated")).toHaveLength(0);
    expect(struck.state.heldAtZero).toEqual([idOf(struck.state, "famine")]);

    // Damage is still dealt and taken below the floor, and a hit point dial stops at zero (RRG 1.8 "Hit Points",
    // p. 22; `settleDials`, `dial-stops-at-zero.test.ts`): the 2 are logged as dealt and none is kept past his 5.
    const again = playFree(struck.state, unprotected, HIT_FAMINE_2.card.id);
    expect(again.events.filter((e) => e.type === "damageDealt").map((e) => e.amount)).toEqual([2]);
    expect(damageOf(again.state, "famine")).toBe(5);
    expect(defeatedNames(again.state)).toEqual([]);

    const freed = playFree(again.state, unprotected, UNHORSE.card.id);
    expect(freed.events.filter((e) => e.type === "defeatProtectionEnded")).toHaveLength(1);
    expect(defeatedNames(freed.state)).toEqual(["famine"]);
    const replayed = replay(freed.session.log, unprotected);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(freed.session.state);
  });

  it("healed above zero while floored, the villain is no longer watched and the attachment leaving defeats nobody", () => {
    const base = start(unprotected);
    const horsed = attach(withDamage(base, { famine: 5 }), HORSE.id, idOf(base, "famine")).state;
    const struck = playFree(horsed, unprotected, HIT_FAMINE_2.card.id).state;
    const healed = playFree(struck, unprotected, HEAL_FAMINE.card.id).state;
    // Healed from zero, not from 2 below it: the dial stopped at zero (`settleDials`). It read 4 until 2026-10-10.
    expect(damageOf(healed, "famine")).toBe(2);
    const freed = playFree(healed, unprotected, UNHORSE.card.id);
    expect(defeatedNames(freed.state)).toEqual([]);
    expect(freed.state.heldAtZero ?? []).toEqual([]);
  });

  it("Q6 = A: all three at 0 with the floor on one, nobody is defeated (the others read its 1 hit point); the floor gone, all three fall together and the game is won", () => {
    const base = start();
    const horsed = attach(withDamage(base, { war: 5, death: 5 }), HORSE.id, idOf(base, "famine")).state;
    const struck = playFree(horsed, deps, HIT_FAMINE.card.id);
    expect(NAMES.map((name) => damageOf(struck.state, name))).toEqual([5, 5, 5]);
    expect(defeatedNames(struck.state)).toEqual([]);
    expect(struck.state.outcome).toBeNull();
    expect([...(struck.state.heldAtZero ?? [])].sort()).toEqual(NAMES.map((name) => idOf(struck.state, name)).sort());

    const freed = playFree(struck.state, deps, UNHORSE.card.id);
    expect(freed.events.filter((e) => e.type === "characterDefeated")).toHaveLength(3);
    expect(freed.state.outcome).toEqual({ result: "win", reason: "allVillainsDefeated" });
  });

  it("without the floor the same three at 0 fall at once (the control)", () => {
    const struck = playFree(withDamage(start(), { war: 5, death: 5 }), deps, HIT_FAMINE.card.id);
    expect(struck.state.outcome).toEqual({ result: "win", reason: "allVillainsDefeated" });
  });

  it("the host gains the trait, and a second copy cannot attach to it: its host is the lowest villain without the trait", () => {
    const base = withDamage(start(), { war: 3, famine: 1 });
    const war = idOf(base, "war");
    const first = attach(base, HORSE.id, war);
    expect(traitsOf(first.state, war, deps)).toContain(AERIAL);
    // War (2 left) is the lowest, but has the trait: Famine (4 left) is the lowest without it.
    expect(attachmentHostCandidates(first.state, HORSE_HOST, hostContext(first.id, deps))).toEqual([
      idOf(first.state, "famine"),
    ]);
  });

  it("a host ranked by remaining hit points reads the true dial, not the floor: War at 0 (considered 1) is below Famine at 1", () => {
    const base = withDamage(start(), { war: 5, famine: 4 });
    const horsed = attach(base, HORSE.id, idOf(base, "war"));
    const war = idOf(horsed.state, "war");
    expect(consideredRemainingHitPoints(horsed.state, war, deps)).toBe(1);
    expect(consideredRemainingHitPoints(horsed.state, idOf(horsed.state, "famine"), deps)).toBe(1);
    expect(attachmentHostCandidates(horsed.state, LOWEST_HOST, hostContext(horsed.id, deps))).toEqual([war]);
  });

  it("a floor with a `while` is off when the condition is false, and the villain falls the moment it turns false", () => {
    const base = start(unprotected);
    const famine = idOf(base, "famine");
    const fitted = attach(base, BRITTLE.id, famine).state;
    const five = playFree(fitted, unprotected, HIT_FAMINE.card.id).state;
    expect(hitPointFloor(five, famine, unprotected)).toBe(1);
    expect(defeatedNames(five)).toEqual([]);
    // 7 damage: the floor's condition (at most 6 damage) ends with this very damage, and the dial is at zero.
    const seven = playFree(five, unprotected, HIT_FAMINE_2.card.id);
    expect(hitPointFloor(seven.state, famine, unprotected)).toBeUndefined();
    expect(defeatedNames(seven.state)).toEqual(["famine"]);
  });

  it("a minion under a floor stays in play at 0, and a defeat by effect (which does not read the dial) still defeats it", () => {
    const engaged = minionEngagedWith(start(unprotected), STUBBORN.id);
    const struck = playFree(engaged.state, unprotected, HIT_STUBBORN.card.id);
    expect(mustInstance(struck.state, engaged.id).damage).toBe(3);
    expect(struck.state.players[0]!.playArea).toContain(engaged.id);
    expect(struck.state.heldAtZero).toEqual([engaged.id]);

    const slain = playFree(struck.state, unprotected, SLAY.card.id);
    expect(slain.state.players[0]!.playArea).not.toContain(engaged.id);
    expect(slain.events.filter((e) => e.type === "characterDefeated")).toHaveLength(1);
  });

  it("the preview's counters carry `consideredHp` beside the true dial, and omit it for a character with no floor", () => {
    const base = start(unprotected);
    const famine = idOf(base, "famine");
    const horsed = attach(withDamage(base, { famine: 4 }), HORSE.id, famine).state;
    const given = giveCard(horsed, P1, HIT_FAMINE.card.id);
    const outcome = preview(
      given.state,
      { type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
      unprotected,
    );
    const counter = outcome.counters.find((c) => c.instanceId === famine)!;
    expect(counter.before).toMatchObject({ remainingHitPoints: 1, consideredHp: 1 });
    // 5 more on 1 remaining: the true dial stops at zero (`settleDials`); it read -4 until 2026-10-10.
    expect(counter.after).toMatchObject({ remainingHitPoints: 0, consideredHp: 1, inPlay: true });

    const plain = giveCard(withDamage(base, { famine: 0 }), P1, HIT_FAMINE_2.card.id);
    const without = preview(
      plain.state,
      { type: "playCard", playerId: P1, cardInstanceId: plain.id, payment: [], attachToInstanceId: null },
      unprotected,
    );
    expect("consideredHp" in without.counters.find((c) => c.instanceId === famine)!.before).toBe(false);
  });
});
