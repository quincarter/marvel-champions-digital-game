import { activeEncounterDeck, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { validateDefinition } from "../../dsl/validate.js";
import { P1, identityOf, inst, moveToHand, patchInstance, play, playerOf, type Picker } from "../../testing/harness.js";
import { encounterCardInVillainArea } from "../../testing/staging.js";
import { FNE_ASPECT_BASIC_BASIC } from "../fne/aspect-basic/basic.js";
import { engageMinion, stagedInPlay } from "../../wave9/falcon/testing.js";
import { ELEKTRA_BASIC as REGISTRY, ELEKTRA_BASIC_SKIPPED as SKIPPED } from "./basic.js";
import { SANDMAN, SHE_HULK_AGGRESSION, accepting, basicAttack, drive, elektraAspectGame } from "./aspect-testing.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Wave 11 `elektra/basic`: Stone 63022, Hunting Shadows 63023 and the Dance with the Devil reprint 63027, in the deck of
 * Core's She-Hulk against Rhino. "Exactly defeats" is no excess damage dealt (ruling August 3, 2026 - Ruling 6).
 */
const STONE = "63022";
const HUNTING_SHADOWS = "63023";
const BREAKIN = "01107"; // Core side scheme
const A = "m-sandman-a" as InstanceId;

const game = (code: string): GameState => elektraAspectGame(code, SHE_HULK_AGGRESSION);
const basicThwart = (thwarter: InstanceId, scheme: InstanceId) =>
  ({ type: "basicThwart", playerId: P1, thwarterInstanceId: thwarter, schemeInstanceId: scheme }) as const;

describe("registry", () => {
  it("registers every ref of the module, skips none, and each validates", () => {
    expect(SKIPPED).toEqual({});
    expect(Object.keys(REGISTRY).sort()).toEqual(
      ["63022.stone-response", "63023.hunting-shadows-action", "63027.dance-with-the-devil-action"].sort(),
    );
    for (const id of Object.keys(REGISTRY)) expect(validateDefinition(REGISTRY[id]!), id).toEqual([]);
    expect(REGISTRY["63022.stone-response"]!.trigger).toMatchObject({ kind: "response", forced: false });
  });

  it("aliases the Dance with the Devil reprint to Fear No Evil's script (60031)", () => {
    expect(REGISTRY["63027.dance-with-the-devil-action"]).toBe(
      FNE_ASPECT_BASIC_BASIC["60031.dance-with-the-devil-action"],
    );
  });
});

describe("63022 Stone", () => {
  /** Stone in play with `stoneDamage`, a Sandman carrying `damage` (4 hit points), engaged with P1. */
  function setup(damage: number, stoneDamage = 0) {
    const staged = stagedInPlay(game(STONE), STONE);
    const withMinion = patchInstance(engageMinion(staged.state, SANDMAN, A), A, { damage });
    return { state: patchInstance(withMinion, staged.id, { damage: stoneDamage }), stone: staged.id };
  }

  it("after Stone exactly defeats an enemy, heals 2 damage from himself", () => {
    // 2 left, Stone ATK 2: exact. He carries 1 damage; the engine resolves the response before his 2 consequential
    // damage, so healed to 0 and then 2. Not healed, 1 + 2 = 3 would defeat him (3 hit points).
    const { state, stone } = setup(2, 1);
    const after = drive(state, accepting(), basicAttack(stone, A));
    expect(playerOf(after, P1).playArea).not.toContain(A);
    expect(playerOf(after, P1).playArea).toContain(stone);
    expect(inst(after, stone).damage).toBe(2);
  });

  it("does nothing when his attack deals excess damage", () => {
    const { state, stone } = setup(3); // 1 left, Stone ATK 2: 1 excess
    const after = drive(state, accepting(), basicAttack(stone, A));
    expect(playerOf(after, P1).playArea).not.toContain(A);
    expect(inst(after, stone).damage).toBe(2);
  });

  it("does nothing when the enemy survives", () => {
    const { state, stone } = setup(0);
    const after = drive(state, accepting(), basicAttack(stone, A));
    expect(inst(after, A).damage).toBe(2);
    expect(inst(after, stone).damage).toBe(2);
  });

  it("does nothing when another character exactly defeats the enemy", () => {
    const { state, stone } = setup(1, 1); // 3 left, She-Hulk ATK 3: exact, by her
    const hero = identityOf(state);
    const after = drive(state, accepting(), basicAttack(hero, A));
    expect(playerOf(after, P1).playArea).not.toContain(A);
    expect(inst(after, stone).damage).toBe(1);
  });

  it("after Stone's thwart exactly defeats a side scheme, heals 2 damage from himself", () => {
    const staged = stagedInPlay(game(STONE), STONE);
    const hurt = patchInstance(staged.state, staged.id, { damage: 1 });
    const scheme = encounterCardInVillainArea(hurt, BREAKIN, 1);
    const after = drive(scheme.state, accepting(), basicThwart(staged.id, scheme.id));
    expect(after.villainArea).not.toContain(scheme.id);
    expect(inst(after, staged.id).damage).toBe(1); // healed to 0, then his 1 consequential damage
  });

  it("does nothing when his thwart leaves threat on the side scheme", () => {
    const staged = stagedInPlay(game(STONE), STONE);
    const scheme = encounterCardInVillainArea(staged.state, BREAKIN, 2);
    const hurt = patchInstance(scheme.state, staged.id, { damage: 1 });
    const after = drive(hurt, accepting(), basicThwart(staged.id, scheme.id));
    expect(inst(after, scheme.id).threat).toBe(1);
    expect(inst(after, staged.id).damage).toBe(2); // not healed
  });
});

describe("63023 Hunting Shadows", () => {
  it("Hero Action: the chosen card from the top 8 of the encounter deck ends on top after the shuffle", () => {
    const given = moveToHand(game(HUNTING_SHADOWS), P1, HUNTING_SHADOWS);
    const id = given.ids[0]!;
    const top8 = activeEncounterDeck(given.state).deck.slice(0, 8);
    const wanted = top8[5]!;
    let offered: readonly string[] = [];
    const pick: Picker = (s) => {
      const choice = s.pendingChoice!;
      const ids = choice.options.map((o) => String(o.optionId));
      if (choice.prompt.kind === "chooseCards") offered = ids;
      if (choice.prompt.kind === "chooseTriggers") return ids;
      return ids.includes(wanted) ? [wanted] : ids.slice(0, choice.minSelections);
    };
    const after = drive(given.state, pick, play(P1, id));
    expect(offered).toEqual(top8);
    const deck = activeEncounterDeck(after).deck;
    expect(deck[0]).toBe(wanted);
    expect(deck).toHaveLength(activeEncounterDeck(given.state).deck.length);
    expect(playerOf(after, P1).discard).toContain(id);
  });
});
