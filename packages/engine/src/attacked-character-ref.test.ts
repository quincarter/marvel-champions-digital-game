/**
 * `TargetRef attackedCharacter`: the character the attack in progress is against, named from a constant ability.
 * Synthetic ally shaped like "While this ally is attacking an enemy, she gets +1 ATK for each upgrade attached to that
 * enemy."
 *
 * Sources: RRG 1.8 "Constant Abilities" (p. 12): active while the card is in play and its condition holds; "Attack"
 * (p. 9): the attacker's ATK is read as the attack deals its damage.
 */
import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "./abilities.js";
import type { Command } from "./commands.js";
import type { InstanceId } from "./ids.js";
import { mustInstance } from "./query.js";
import { resolveRef } from "./select.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import { stubAlly, stubMinion, stubUpgrade } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, playerCardIntoPlay } from "./testing/wave3.js";

const THAT_ENEMY = { kind: "attackedCharacter", attacker: { kind: "self" } } as const;
const HUNTER_CONSTANT = stubAbility("hunter.constant", {
  trigger: {
    kind: "constant",
    modifiers: [
      {
        stat: "atk",
        amount: { kind: "count", query: { categories: ["upgrade"], host: THAT_ENEMY } },
        target: { self: true },
        while: { kind: "attackInProgress", attacker: { self: true }, target: { categories: ["enemy"] } },
      },
    ],
  },
  effects: [],
} as AbilityDefinition);
const HUNTER = stubAlly({ id: "hunter", cost: 0, atk: 1, thw: 1, hp: 4, abilities: [HUNTER_CONSTANT.ref] });
const OTHER = stubAlly({ id: "other", cost: 0, atk: 1, thw: 1, hp: 4 });
const TAG = stubUpgrade({ id: "tag", cost: 0 });
const BRUTE = stubMinion({ id: "brute", atk: 1, sch: 1, hp: 9 });
const GRUNT = stubMinion({ id: "grunt", atk: 1, sch: 1, hp: 9 });

const deps = depsOf(HUNTER_CONSTANT);
const start = (): GameState =>
  gameAtFirstTurn({
    cards: [HUNTER, OTHER, TAG, BRUTE, GRUNT],
    deps,
    deck: [HUNTER.id, OTHER.id, ...copiesOf(TAG.id, 3)],
    encounter: [BRUTE.id, GRUNT.id],
  });

/** A copy of the upgrade attached to `host` (surgery). */
function tagged(state: GameState, host: InstanceId): GameState {
  const placed = playerCardIntoPlay(state, TAG.id);
  return {
    ...placed.state,
    players: placed.state.players.map((p) => ({ ...p, playArea: p.playArea.filter((id) => id !== placed.id) })),
    instances: {
      ...placed.state.instances,
      [placed.id]: { ...mustInstance(placed.state, placed.id), attachedTo: host },
      [host]: {
        ...mustInstance(placed.state, host),
        attachments: [...mustInstance(placed.state, host).attachments, placed.id],
      },
    },
  };
}
const attack = (attacker: InstanceId, target: InstanceId): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: attacker,
  targetInstanceId: target,
});
const damageOn = (state: GameState, id: InstanceId): number => mustInstance(state, id).damage;

function table(tagsOnBrute: number, tagsOnGrunt = 0) {
  const hunter = playerCardIntoPlay(start(), HUNTER.id);
  const other = playerCardIntoPlay(hunter.state, OTHER.id);
  const brute = minionEngagedWith(other.state, BRUTE.id);
  const grunt = minionEngagedWith(brute.state, GRUNT.id);
  let state = grunt.state;
  for (let i = 0; i < tagsOnBrute; i++) state = tagged(state, brute.id);
  for (let i = 0; i < tagsOnGrunt; i++) state = tagged(state, grunt.id);
  return { state, hunter: hunter.id, other: other.id, brute: brute.id, grunt: grunt.id };
}

describe("attackedCharacter: 'that enemy' of the attack in progress, from a constant", () => {
  it("names no one outside an attack", () => {
    const t = table(2);
    const context = { selfInstanceId: t.hunter, controllerId: P1, event: null, bindings: {}, deps };
    expect(resolveRef(t.state, THAT_ENEMY, context)).toEqual([]);
  });

  it("+1 ATK for each upgrade attached to the enemy she attacks", () => {
    const t = table(2);
    const { state } = runCommands(t.state, deps, attack(t.hunter, t.brute));
    expect(damageOn(state, t.brute)).toBe(1 + 2);
  });

  it("reads the enemy attacked, not another enemy's upgrades", () => {
    const t = table(2, 1);
    expect(damageOn(runCommands(t.state, deps, attack(t.hunter, t.grunt)).state, t.grunt)).toBe(1 + 1);
    const bare = table(0, 3);
    expect(damageOn(runCommands(bare.state, deps, attack(bare.hunter, bare.brute)).state, bare.brute)).toBe(1);
  });

  it("another character's attack on that enemy gives her nothing, and gives the attacker nothing", () => {
    const t = table(2);
    const { state } = runCommands(t.state, deps, attack(t.other, t.brute));
    expect(damageOn(state, t.brute)).toBe(1);
  });
});
