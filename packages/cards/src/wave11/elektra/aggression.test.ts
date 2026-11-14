import {
  applyCommand,
  characterProfile,
  legalActions,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { validateDefinition } from "../../dsl/validate.js";
import {
  P1,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  play,
  playerOf,
  use,
  type Picker,
} from "../../testing/harness.js";
import { engageMinion, stagedInPlay } from "../../wave9/falcon/testing.js";
import { WAVE11_DEPS as DEPS } from "../index.js";
import { ELEKTRA_AGGRESSION as REGISTRY, ELEKTRA_AGGRESSION_SKIPPED as SKIPPED } from "./aggression.js";
import { elektraHeroGame } from "./elektra/elektra.testing.js";
import { SANDMAN, SHE_HULK_AGGRESSION, accepting, basicAttack, drive, elektraAspectGame } from "./aspect-testing.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Wave 11 `elektra/aggression` (docs/phase7-elektra-iron-fist.md): Shang-Chi 63015, Combo Move 63017, Chain Reaction
 * 63018, Nerve Strike 63019, Flow of Battle 63020 and Shuriken 63021 (Black Cat 63016 has only the Villainous keyword,
 * which is data). Each is played from the deck of Core's She-Hulk (Aggression, ATK 3) against Rhino; enemies are staged
 * by surgery. Exactly-defeat is no excess damage dealt (ruling August 3, 2026 - Ruling 6; RRG 1.8 p. 49: "you" is
 * the identity's own attack).
 */
const SHANG_CHI = "63015";
const COMBO_MOVE = "63017";
const CHAIN_REACTION = "63018";
const NERVE_STRIKE = "63019";
const FLOW_OF_BATTLE = "63020";
const SHURIKEN = "63021";
const SHANG_CHI_ACTION = "63015.shang-chi-action";

const A = "m-sandman-a" as InstanceId;
const B = "m-sandman-b" as InstanceId;
const C = "m-sandman-c" as InstanceId;

const game = (code: string): GameState => elektraAspectGame(code, SHE_HULK_AGGRESSION);
const hero = (s: GameState) => identityOf(s);
/** Puts Sandmen (4 hit points each) in play engaged with P1, with the given damage on each. */
function withEnemies(s: GameState, damages: readonly number[]): GameState {
  let state = s;
  [A, B, C].slice(0, damages.length).forEach((slot, i) => {
    state = patchInstance(engageMinion(state, SANDMAN, slot), slot, { damage: damages[i]! });
  });
  return state;
}
/**
 * Answers prompts: an optional trigger is accepted; a target is the first of `targets` offered; a divided-damage prompt
 * puts its points on the first of `targets` that has them; a "choose one" takes option number `option`.
 */
const choosing =
  (targets: readonly string[], option = 0): Picker =>
  (s) => {
    const choice = s.pendingChoice!;
    const ids = choice.options.map((o) => String(o.optionId));
    if (choice.prompt.kind === "chooseTriggers") return ids;
    if (choice.prompt.kind === "chooseOption") return [ids[option]!];
    if (choice.prompt.kind === "divide") {
      const points = targets.flatMap((t) => ids.filter((i) => i.startsWith(t + "#")));
      return [...points, ...ids.filter((i) => !points.includes(i))].slice(0, choice.minSelections);
    }
    const hit = targets.find((t) => ids.includes(t));
    return hit !== undefined ? [hit] : ids.slice(0, choice.minSelections);
  };
const canUse = (s: GameState, id: InstanceId, ability: string): boolean => {
  const actions = legalActions(s, P1, DEPS);
  return (
    actions.kind === "turn" &&
    actions.legal.some((a) => JSON.stringify(a.example).includes(ability) && JSON.stringify(a.example).includes(id))
  );
};
/** A hand card of P1's other than `id`, for paying. */
const pay = (s: GameState, id: InstanceId, n: number) =>
  playerOf(s, P1)
    .hand.filter((i) => i !== id)
    .slice(0, n);

describe("registry", () => {
  it("registers every scripted ref, skips none, and each validates", () => {
    expect(SKIPPED).toEqual({});
    expect(Object.keys(REGISTRY).sort()).toEqual(
      [
        SHANG_CHI_ACTION,
        "63015.shang-chi-constant",
        "63017.combo-move-action",
        "63018.chain-reaction-action",
        "63019.nerve-strike-action",
        "63020.flow-of-battle-response",
        "63021.shuriken-action",
      ].sort(),
    );
    for (const id of Object.keys(REGISTRY)) expect(validateDefinition(REGISTRY[id]!), id).toEqual([]);
    expect(REGISTRY["63020.flow-of-battle-response"]!.trigger).toMatchObject({ kind: "response", forced: false });
    expect(REGISTRY[SHANG_CHI_ACTION]!.limit).toEqual({ count: 2, period: "round" });
  });
});

describe("63015 Shang-Chi", () => {
  it("enters play with 10 ring counters", () => {
    const given = moveToHand(game(SHANG_CHI), P1, SHANG_CHI);
    const id = given.ids[0]!;
    const after = drive(given.state, accepting(), play(P1, id, pay(given.state, id, 4)));
    expect(inst(after, id).counters.ring).toBe(10);
  });

  it("Action: removes a ring counter to deal 1 damage to an enemy, at most twice a round", () => {
    const staged = stagedInPlay(withEnemies(game(SHANG_CHI), [0]), SHANG_CHI, { counters: { ring: 10 } });
    let s = drive(staged.state, choosing([A]), use(P1, staged.id, SHANG_CHI_ACTION));
    expect(inst(s, staged.id).counters.ring).toBe(9);
    expect(inst(s, A).damage).toBe(1);
    s = drive(s, choosing([A]), use(P1, staged.id, SHANG_CHI_ACTION));
    expect(inst(s, staged.id).counters.ring).toBe(8);
    expect(inst(s, A).damage).toBe(2);
    expect(canUse(s, staged.id, SHANG_CHI_ACTION)).toBe(false);
  });

  it("with no ring counters left he cannot use the action but stays in play", () => {
    const staged = stagedInPlay(withEnemies(game(SHANG_CHI), [0]), SHANG_CHI, { counters: { ring: 0 } });
    expect(canUse(staged.state, staged.id, SHANG_CHI_ACTION)).toBe(false);
    expect(playerOf(staged.state, P1).playArea).toContain(staged.id);
  });
});

describe("63021 Shuriken", () => {
  it("Hero Action: removes a shuriken counter to deal 1 damage to an enemy (not an attack)", () => {
    const staged = stagedInPlay(withEnemies(game(SHURIKEN), [0]), SHURIKEN, {
      attach: true,
      counters: { shuriken: 3 },
    });
    const after = drive(staged.state, choosing([A]), use(P1, staged.id, "63021.shuriken-action"));
    expect(inst(after, staged.id).counters.shuriken).toBe(2);
    expect(inst(after, A).damage).toBe(1);
  });
});

describe("63017 Combo Move", () => {
  it("Hero Action (attack): a non-Martial Artist divides 2 damage among enemies", () => {
    const given = moveToHand(withEnemies(game(COMBO_MOVE), [0, 0]), P1, COMBO_MOVE);
    const id = given.ids[0]!;
    const after = drive(given.state, choosing([A, B]), play(P1, id, pay(given.state, id, 1)));
    expect(inst(after, A).damage + inst(after, B).damage).toBe(2);
    expect(playerOf(after, P1).discard).toContain(id);
  });

  it("deals 3 instead when your identity has the Martial Artist trait (Elektra)", () => {
    const base = elektraHeroGame();
    const spare = playerOf(base, P1).deck[playerOf(base, P1).deck.length - 1]!;
    const retagged = patchInstance(base, spare, { cardId: "63017" as never });
    const given = moveToHand(withEnemies(retagged, [0, 0]), P1, COMBO_MOVE);
    const id = given.ids[0]!;
    const after = drive(given.state, choosing([A, B]), play(P1, id, pay(given.state, id, 1)));
    expect(inst(after, A).damage + inst(after, B).damage).toBe(3);
  });
});

describe("63018 Chain Reaction", () => {
  const cast = (damages: readonly number[], pick: Picker) => {
    const given = moveToHand(withEnemies(game(CHAIN_REACTION), damages), P1, CHAIN_REACTION);
    const id = given.ids[0]!;
    return drive(given.state, pick, play(P1, id, pay(given.state, id, 2)));
  };
  const gone = (s: GameState, id: InstanceId) => !playerOf(s, P1).playArea.includes(id);

  it("is one attack with three damage instances: one attack event, and all three enemies damaged", () => {
    const given = moveToHand(withEnemies(game(CHAIN_REACTION), [2, 2, 0]), P1, CHAIN_REACTION);
    const id = given.ids[0]!;
    const pick = choosing([A, B, C]);
    let result = applyCommand(given.state, play(P1, id, pay(given.state, id, 2)), DEPS);
    if (!result.ok) throw new Error(result.error.message);
    const events: GameEvent[] = [...result.events];
    while (result.state.pendingChoice) {
      const c = result.state.pendingChoice;
      const next = applyCommand(
        result.state,
        { type: "resolveChoice", playerId: c.playerId, choiceId: c.choiceId, selectedOptionIds: pick(result.state) },
        DEPS,
      );
      if (!next.ok) throw new Error(next.error.message);
      result = next;
      events.push(...next.events);
    }
    // The attack event is heard twice (its "when" and "after" windows); three separate attacks would be heard six times.
    const kinds = events
      .filter((e) => e.type === "triggerEvent")
      .map((e) => (e as unknown as { event: { kind: string } }).event.kind);
    expect(kinds.filter((k) => k === "attack")).toHaveLength(2);
    expect(inst(result.state, C).damage).toBe(3);
  });

  it("a first target that survives ends the chain", () => {
    const after = cast([0, 0, 0], choosing([A]));
    expect(inst(after, A).damage).toBe(2);
    expect(inst(after, B).damage).toBe(0);
    expect(inst(after, C).damage).toBe(0);
  });

  it("defeating the first deals 2 to a different second enemy, and defeating that deals 3 to a third", () => {
    const after = cast([2, 2, 0], choosing([A, B, C]));
    expect(gone(after, A)).toBe(true);
    expect(gone(after, B)).toBe(true);
    expect(inst(after, C).damage).toBe(3);
  });

  it("a second target that survives stops the chain", () => {
    const after = cast([2, 0, 0], choosing([A, B, C]));
    expect(gone(after, A)).toBe(true);
    expect(inst(after, B).damage).toBe(2);
    expect(inst(after, C).damage).toBe(0);
  });
});

describe("63019 Nerve Strike", () => {
  const cast = (option: number) => {
    const given = moveToHand(withEnemies(game(NERVE_STRIKE), [0]), P1, NERVE_STRIKE);
    const id = given.ids[0]!;
    return drive(given.state, choosing([A], option), play(P1, id, pay(given.state, id, 3)));
  };

  it("deals 2 damage and stuns the enemy when stun is chosen", () => {
    const after = cast(0);
    expect(inst(after, A).damage).toBe(2);
    expect(inst(after, A).statuses.stunned).toBe(1);
    expect(inst(after, A).statuses.confused).toBe(0);
  });

  it("deals 2 damage and confuses it when confuse is chosen", () => {
    const after = cast(1);
    expect(inst(after, A).damage).toBe(2);
    expect(inst(after, A).statuses.confused).toBe(1);
    expect(inst(after, A).statuses.stunned).toBe(0);
  });
});

describe("63019 Nerve Strike on an enemy it defeats", () => {
  it("deals 2 damage, defeats a Sandman with 2 left, and the stun or confuse is harmless", () => {
    const given = moveToHand(withEnemies(game(NERVE_STRIKE), [2]), P1, NERVE_STRIKE);
    const id = given.ids[0]!;
    const after = drive(given.state, choosing([A], 1), play(P1, id, pay(given.state, id, 3)));
    expect(playerOf(after, P1).playArea).not.toContain(A);
    expect(playerOf(after, P1).discard).toContain(id);
  });
});

describe("63021 Shuriken played from hand", () => {
  it("enters attached to her hero with 3 shuriken counters, and is discarded after the third is used", () => {
    const given = moveToHand(withEnemies(game(SHURIKEN), [0]), P1, SHURIKEN);
    const id = given.ids[0]!;
    let s = drive(given.state, choosing([A]), play(P1, id, pay(given.state, id, 2)));
    expect(inst(s, id).counters.shuriken).toBe(3);
    expect(inst(s, id).attachedTo).toBe(hero(s));
    for (let i = 0; i < 3; i++) s = drive(s, choosing([A]), use(P1, id, "63021.shuriken-action"));
    expect(inst(s, A).damage).toBe(3);
    expect(playerOf(s, P1).discard).toContain(id);
  });
});

describe("63020 Flow of Battle", () => {
  /** Flow of Battle attached to She-Hulk (ATK 3); a Sandman carrying `damage` (4 hit points). */
  const setup = (damage: number) =>
    stagedInPlay(withEnemies(game(FLOW_OF_BATTLE), [damage]), FLOW_OF_BATTLE, { attach: true });
  const handSize = (s: GameState) => playerOf(s, P1).hand.length;

  it("after you attack and exactly defeat an enemy, discards to draw 3 cards", () => {
    const { state, id } = setup(1); // 3 left, ATK 3: exact
    const before = handSize(state);
    const after = drive(state, accepting(), basicAttack(hero(state), A));
    expect(playerOf(after, P1).discard).toContain(id);
    expect(handSize(after)).toBe(before + 3);
  });

  it("does nothing when the attack deals excess damage", () => {
    const { state, id } = setup(2); // 2 left, ATK 3: 1 excess
    const before = handSize(state);
    const after = drive(state, accepting(), basicAttack(hero(state), A));
    expect(playerOf(after, P1).discard).not.toContain(id);
    expect(handSize(after)).toBe(before);
  });

  it("does nothing when the enemy survives", () => {
    const { state, id } = setup(0);
    const after = drive(state, accepting(), basicAttack(hero(state), A));
    expect(inst(after, A).damage).toBe(3);
    expect(playerOf(after, P1).discard).not.toContain(id);
  });

  it("an ally's exact defeat is not yours", () => {
    const { state, id } = setup(1);
    const spare = playerOf(state, P1).deck[0]!;
    const ally = stagedInPlay(patchInstance(state, spare, { cardId: "56041" as never }), "56041");
    const atk = characterProfile(ally.state, ally.id, DEPS)!.atk;
    const patched = patchInstance(ally.state, A, { damage: 4 - atk });
    const after = drive(patched, accepting(), basicAttack(ally.id, A));
    expect(playerOf(after, P1).playArea).not.toContain(A);
    expect(playerOf(after, P1).discard).not.toContain(id);
  });
});
