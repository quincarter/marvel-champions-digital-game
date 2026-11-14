/**
 * Amplify on any character's boost card resolved during a basic power. Conflict between sources, settled by the owner
 * on 2026-11-14 (docs/phase7-wave11-scenarios.md §S4.0, "Amplify"; a shared rules correction, not an Elektra
 * exception): RRG 1.8 "Amplify Icon" (p. 7) adds the icon only to a boost card "turned faceup during an enemy
 * activation"; the Fear No Evil rulebook's updated text (MC60 p. 4) reads "When a character resolves a boost card while
 * using a basic power, add one additional boost icon to that card for each amplify icon in play", and the engine
 * follows it. So an enemy's attack keeps its amplify, and a villainous hero's basic attack, thwart, defense and recovery
 * and a villainous ally's basic attack and thwart gain it (an ally's defense is no basic power, so no card at all). A
 * card effect counting a card's boost icons outside a basic power does not.
 *
 * Synthetic cards: a side scheme printing one amplify icon (Vendetta's shape) and one printing two, an ally printed
 * with villainous (Black Cat's shape), a hero granted villainous (Elektra's shape), two-icon boost cards.
 */

import type { CardId, SideSchemeCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { Command } from "./commands.js";
import { defendPreview } from "./defend-preview.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import type { LastingEffect } from "./lasting.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubSideScheme, stubSupport, stubTreachery } from "./testing/fixtures.js";
import { defaultPick } from "./testing/scenario.js";
import { copiesOf, encounterCardInVillainArea, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

/** One amplify icon (Vendetta's shape). */
const VENDETTA: SideSchemeCard = { ...stubSideScheme({ id: "vendetta", startingThreat: 2 }), amplifyIcons: 1 };
/** Two amplify icons on one card. */
const DOUBLE: SideSchemeCard = { ...stubSideScheme({ id: "double", startingThreat: 2 }), amplifyIcons: 2 };
/** Two boost icons, no Boost ability. */
const PLAIN = stubTreachery({ id: "plain", boostIcons: 2 });
const CAT = stubAlly({ id: "cat", cost: 0, atk: 1, thw: 1, hp: 5, keywords: [{ name: "villainous" }] });

/**
 * "Action: Discard the top card of the encounter deck. Deal 1 damage to the villain for each boost icon on it." A
 * card effect's count of a card's icons: no boost card resolved, no basic power used.
 */
const COUNT_TOP = stubAbility("count-top.action", {
  trigger: { kind: "action" },
  effects: [
    { kind: "discardEncounterCards", count: { kind: "const", value: 1 }, bind: "d" },
    { kind: "countBoostIcons", cards: { kind: "slot", slot: "d" }, bind: "d" },
    { kind: "dealDamage", target: { kind: "villain" }, amount: { kind: "var", name: "d.boostIcons" } },
  ],
});
const COUNTER = stubSupport({ id: "counter", cost: 0, abilities: [COUNT_TOP.ref] });

const deps = depsOf(COUNT_TOP);
const SCHEMES: readonly CardId[] = [VENDETTA.id, DOUBLE.id];

/** P1's first turn in hero form, 5 threat on the main scheme, the encounter deck all PLAIN (beneath the schemes). */
function start(): { state: GameState; scheme: InstanceId } {
  const base = gameAtFirstTurn({
    cards: [VENDETTA, DOUBLE, PLAIN, CAT, COUNTER],
    deps,
    encounter: [...SCHEMES, ...copiesOf(PLAIN.id, 20)],
    deck: [CAT.id, COUNTER.id],
  });
  const hero: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
  };
  const scheme = hero.mainScheme!.instanceId;
  // The schemes leave the deck either way, so a game with no amplify draws the same boost cards.
  const taken = [VENDETTA.id, DOUBLE.id].reduce((s, id) => {
    const out = encounterCardInVillainArea(s, id, 2);
    return { ...out.state, villainArea: out.state.villainArea.filter((x) => x !== out.id) };
  }, hero);
  return {
    state: { ...taken, instances: { ...taken.instances, [scheme]: { ...mustInstance(taken, scheme), threat: 5 } } },
    scheme,
  };
}

/** `count` amplify icons in play: Vendetta (1), Double (2) or both (3). */
function withAmplify(state: GameState, count: 0 | 1 | 2 | 3): GameState {
  const ids = count === 1 ? [VENDETTA.id] : count === 2 ? [DOUBLE.id] : count === 3 ? [VENDETTA.id, DOUBLE.id] : [];
  let current = state;
  for (const card of ids) {
    const instance = (Object.keys(current.instances) as InstanceId[]).find(
      (id) => current.instances[id]!.cardId === card,
    )!;
    current = {
      ...current,
      villainArea: [...current.villainArea, instance],
      instances: { ...current.instances, [instance]: { ...mustInstance(current, instance), faceup: true } },
    };
  }
  return current;
}

const run = (state: GameState, commands: readonly Command[], pick = defaultPick) => {
  const { session, events } = driveSession(startSession(state), deps, commands, pick);
  return { session, state: session.state, events };
};

const identity = (state: GameState): InstanceId => mustPlayer(state, P1).identity.instanceId;
const villain = (state: GameState): InstanceId => state.villains[0]!.instanceId;

const grantVillainous = (target: InstanceId): LastingEffect => ({
  id: "test.grant",
  kind: "keywordGrant",
  keyword: { name: "villainous" },
  targets: [target],
  affects: null,
  scope: { selfInstanceId: null, controllerId: null, vars: {}, bindings: {} },
  duration: { kind: "endOfRound" },
});
const villainousHero = (state: GameState): GameState => ({
  ...state,
  lastingEffects: [...state.lastingEffects, grantVillainous(identity(state))],
});

const characterFlips = (events: readonly GameEvent[]) =>
  events.filter(
    (e): e is Extract<GameEvent, { type: "characterBoostCardFlipped" }> => e.type === "characterBoostCardFlipped",
  );
const enemyFlips = (events: readonly GameEvent[]) =>
  events.filter((e): e is Extract<GameEvent, { type: "boostCardFlipped" }> => e.type === "boostCardFlipped");

const thwart = (thwarter: InstanceId, scheme: InstanceId): Command => ({
  type: "basicThwart",
  playerId: P1,
  thwarterInstanceId: thwarter,
  schemeInstanceId: scheme,
});
const attack = (state: GameState, attacker: InstanceId): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: attacker,
  targetInstanceId: villain(state),
});
const defendWith = (defender: InstanceId) => (s: GameState) =>
  s.pendingChoice?.prompt.kind === "declareDefender" ? [defender] : defaultPick(s);

describe("an enemy activation keeps its amplify (RRG 1.8 p. 7; MC60 p. 4)", () => {
  it("the villain's attack boost card gets +1 per amplify icon in play", () => {
    const { state } = start();
    const hero = identity(state);
    const before = mustInstance(state, hero).damage;
    const after = run(withAmplify(state, 1), [{ type: "endTurn", playerId: P1 }]);
    // PLAIN's 2 + 1 amplify; undefended villain ATK 2 + 3.
    expect(enemyFlips(after.events)[0]?.boostIcons).toBe(3);
    expect(mustInstance(after.state, hero).damage).toBe(before + 5);
  });
});

describe("a villainous hero's basic powers gain amplify (owner, 2026-11-14: MC60 p. 4 over RRG 1.8 p. 7)", () => {
  it("a basic attack: ATK 2 + 2 printed + 1 per amplify icon", () => {
    const { state } = start();
    const hero = identity(state);
    const before = mustInstance(state, villain(state)).damage;
    const without = run(villainousHero(state), [attack(state, hero)]);
    const withOne = run(villainousHero(withAmplify(state, 1)), [attack(state, hero)]);
    const withThree = run(villainousHero(withAmplify(state, 3)), [attack(state, hero)]);
    expect(characterFlips(without.events)[0]).toMatchObject({ power: "attack", stat: "atk", boostIcons: 2 });
    expect(characterFlips(withOne.events)[0]).toMatchObject({ power: "attack", stat: "atk", boostIcons: 3 });
    expect(characterFlips(withThree.events)[0]).toMatchObject({ power: "attack", stat: "atk", boostIcons: 5 });
    const dealt = (r: { state: GameState }) => mustInstance(r.state, villain(r.state)).damage;
    expect(dealt(without)).toBe(before + 4);
    expect(dealt(withOne)).toBe(dealt(without) + 1);
    expect(dealt(withThree)).toBe(dealt(without) + 3);
  });

  it("a basic thwart: THW 2 + 2 + 1 removes all 5 threat", () => {
    const { state, scheme } = start();
    const hero = identity(state);
    const after = run(villainousHero(withAmplify(state, 1)), [thwart(hero, scheme)]);
    expect(characterFlips(after.events)[0]).toMatchObject({ power: "thwart", stat: "thw", boostIcons: 3 });
    expect(mustInstance(after.state, scheme).threat).toBe(0);
    const replayed = replay(after.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(after.state);
  });

  it("a basic defense: DEF 2 + 2 + 1 against ATK 2 + 2 + 1, no damage; without villainous 3", () => {
    const { state } = start();
    const hero = identity(state);
    const before = mustInstance(state, hero).damage;
    const amplified = withAmplify(state, 1);
    const after = run(villainousHero(amplified), [{ type: "endTurn", playerId: P1 }], defendWith(hero));
    expect(characterFlips(after.events)[0]).toMatchObject({ power: "defense", stat: "def", boostIcons: 3 });
    expect(enemyFlips(after.events)[0]?.boostIcons).toBe(3);
    expect(mustInstance(after.state, hero).damage).toBe(before);

    const plain = run(amplified, [{ type: "endTurn", playerId: P1 }], defendWith(hero));
    expect(characterFlips(plain.events)).toHaveLength(0);
    expect(mustInstance(plain.state, hero).damage).toBe(before + 3);
  });

  it("the defend preview counts amplify on both the enemy's cards and the hero's own", () => {
    const { state } = start();
    const hero = identity(state);
    let preview: ReturnType<typeof defendPreview> = null;
    run(villainousHero(withAmplify(state, 1)), [{ type: "endTurn", playerId: P1 }], (s) => {
      if (s.pendingChoice?.prompt.kind !== "declareDefender") return defaultPick(s);
      preview ??= defendPreview(s, deps);
      return [hero];
    });
    const options = preview as ReturnType<typeof defendPreview>;
    const option = options?.find((o) => o.defenderInstanceId === hero);
    expect(option?.boost).toMatchObject({ min: 3, max: 3 });
    expect(option?.ownBoost).toMatchObject({ facedownCount: 1, min: 3, max: 3 });
    // ATK 2 + 3 against DEF 2 + 3: no damage.
    expect(option?.bands).toEqual([expect.objectContaining({ boostFrom: 0, boostTo: 0, damageDealt: 0 })]);
  });

  // A recovery by an identity that has villainous itself, so the use is given its card. Not ruling September 10, 2026
  // - Ruling 3 (A), Elektra Natchios (no villainous) resolving a boost card held from earlier: the engine keeps a held
  // card facedown (`heldBefore`), an open gap for the Elektra kit.
  it("a basic recovery by a villainous identity: REC 3 + 2 + 1 heals 6", () => {
    const { state } = start();
    const id = identity(state);
    const alterEgo: GameState = {
      ...villainousHero(withAmplify(state, 1)),
      players: state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "alterEgo" as const } })),
    };
    const hurt = {
      ...alterEgo,
      instances: { ...alterEgo.instances, [id]: { ...mustInstance(alterEgo, id), damage: 7 } },
    };
    const after = run(hurt, [{ type: "basicRecover", playerId: P1 }]);
    expect(characterFlips(after.events)[0]).toMatchObject({ power: "recover", stat: "rec", boostIcons: 3 });
    expect(mustInstance(after.state, id).damage).toBe(1);
  });
});

describe("a villainous ally's basic powers gain amplify (owner, 2026-11-14)", () => {
  it("a basic attack: ATK 1 + 2 + 2 with two amplify icons", () => {
    const { state } = start();
    const ally = playerCardIntoPlay(withAmplify(state, 2), CAT.id, P1);
    const before = mustInstance(ally.state, villain(ally.state)).damage;
    const after = run(ally.state, [attack(ally.state, ally.id)]);
    expect(characterFlips(after.events)[0]).toMatchObject({ characterInstanceId: ally.id, boostIcons: 4 });
    expect(mustInstance(after.state, villain(after.state)).damage).toBe(before + 5);
  });

  it("a basic thwart: THW 1 + 2 + 1 leaves 1 threat", () => {
    const { state, scheme } = start();
    const ally = playerCardIntoPlay(withAmplify(state, 1), CAT.id, P1);
    const after = run(ally.state, [thwart(ally.id, scheme)]);
    expect(characterFlips(after.events)[0]).toMatchObject({ power: "thwart", boostIcons: 3 });
    expect(mustInstance(after.state, scheme).threat).toBe(1);
  });

  it("her defense is no basic power: no boost card, amplify or not (RRG 1.8 pp. 10, 15)", () => {
    const { state } = start();
    const ally = playerCardIntoPlay(withAmplify(state, 1), CAT.id, P1);
    const after = run(ally.state, [{ type: "endTurn", playerId: P1 }], defendWith(ally.id));
    expect(after.events).toContainEqual(
      expect.objectContaining({ type: "defenderDeclared", defenderInstanceId: ally.id }),
    );
    expect(characterFlips(after.events)).toHaveLength(0);
  });
});

describe("outside a basic power, amplify adds nothing", () => {
  it("a card effect counting a discarded card's boost icons counts the printed 2 only", () => {
    const { state } = start();
    const support = playerCardIntoPlay(withAmplify(state, 1), COUNTER.id, P1);
    const before = mustInstance(support.state, villain(support.state)).damage;
    const after = run(support.state, [
      { type: "useAbility", playerId: P1, cardInstanceId: support.id, abilityId: COUNT_TOP.ref.id, payment: [] },
    ]);
    expect(characterFlips(after.events)).toHaveLength(0);
    expect(mustInstance(after.state, villain(after.state)).damage).toBe(before + 2);
  });
});
