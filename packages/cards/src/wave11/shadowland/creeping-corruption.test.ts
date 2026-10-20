import { trait } from "@mc/content";
import { applyCommand, traitsOf, type GameState } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { abilityRefIds } from "../../ability-refs.js";
import { validateDefinition } from "../../dsl/validate.js";
import { P1, firstLegal, inst, playerOf, settle, use } from "../../testing/harness.js";
import { WAVE11_CARDS } from "../cards.js";
import {
  SHADOWLAND_CREEPING_CORRUPTION as REGISTRY,
  SHADOWLAND_CREEPING_CORRUPTION_SKIPPED as SKIPPED,
} from "./creeping-corruption.js";
import { DEPS, CREEPING_CORRUPTION, ccOf, corruption, shadowGame, withCorruption } from "./corruption.testing.js";
import { withForm } from "../../testing/staging.js";

vi.setConfig({ testTimeout: 180_000 });

const REFS = [
  "65072a.creeping-corruption-constant",
  "65072a.creeping-corruption-action",
  "65072b.creeping-corruption-constant",
  "65072b.creeping-corruption-action",
];
const ACTION_A = "65072a.creeping-corruption-action";
const ACTION_B = "65072b.creeping-corruption-action";

const data = (WAVE11_CARDS as readonly any[]).find((c) => (c.id as string) === CREEPING_CORRUPTION)!;
const handSize = (s: GameState): number => playerOf(s, P1).hand.length;
const flipped = (s: GameState): boolean => inst(s, ccOf(s)).flipped;
const act = (s: GameState, ref: string): GameState =>
  settle(
    (() => {
      const r = applyCommand(s, use(P1, ccOf(s), ref), DEPS);
      if (!r.ok) throw new Error(`${r.error.code}: ${r.error.message}`);
      return r.state;
    })(),
    firstLegal,
    undefined,
    DEPS,
  );
const heroGame = () => withForm(shadowGame(), { heroForm: 0 });

describe("registry", () => {
  it("registers every printed ref of both faces; nothing is skipped", () => {
    expect([...abilityRefIds(data)].sort()).toEqual([...REFS].sort());
    expect(Object.keys(REGISTRY).sort()).toEqual([...REFS].sort());
    expect(Object.keys(SKIPPED)).toEqual([]);
  });
  it.each(REFS)("%s validates", (ref) => {
    expect(validateDefinition(REGISTRY[ref]!), ref).toEqual([]);
  });
});

describe("Creeping Corruption 72A", () => {
  it("starts the game in play, ready, with no counters (Setup)", () => {
    const s = shadowGame();
    expect(playerOf(s, P1).playArea).toContain(ccOf(s));
    expect(corruption(s)).toBe(0);
    expect(inst(s, ccOf(s)).exhausted).toBe(false);
  });

  it("action: exhausts it, places 1 corruption counter and draws 1 card", () => {
    const s = heroGame();
    const after = act(s, ACTION_A);
    expect(inst(after, ccOf(after)).exhausted).toBe(true);
    expect(corruption(after)).toBe(1);
    expect(handSize(after)).toBe(handSize(s) + 1);
    expect(flipped(after)).toBe(false);
  });

  it("action: an exhausted Creeping Corruption cannot be used again", () => {
    const after = act(heroGame(), ACTION_A);
    const again = applyCommand(after, use(P1, ccOf(after), ACTION_A), DEPS);
    expect(again.ok).toBe(false);
  });

  it("constant: the 5th counter removes all five and flips it (4 -> 5 flips, 3 -> 4 does not)", () => {
    const four = act(withCorruption(heroGame(), 4), ACTION_A);
    expect(flipped(four)).toBe(true);
    expect(corruption(four)).toBe(0);
    // The action still drew its card: the counter was a cost.
    expect(handSize(four)).toBe(handSize(withCorruption(heroGame(), 4)) + 1);
    const three = act(withCorruption(heroGame(), 3), ACTION_A);
    expect(flipped(three)).toBe(false);
    expect(corruption(three)).toBe(4);
  });
});

describe("Creeping Corruption 72B", () => {
  /** A flipped 72B holding `n` counters: reached the way the game does, by crossing 5 on 72A. */
  function overpowering(n: number): GameState {
    const flippedState = act(withCorruption(heroGame(), 4), ACTION_A);
    expect(flipped(flippedState)).toBe(true);
    const ready = { ...flippedState, instances: { ...flippedState.instances } };
    ready.instances[ccOf(flippedState)] = { ...inst(flippedState, ccOf(flippedState)), exhausted: false };
    return withCorruption(ready, n);
  }

  it("has the OVERPOWERING trait once flipped, and not before", () => {
    const before = heroGame();
    expect(traitsOf(before, ccOf(before), DEPS)).not.toContain(trait("OVERPOWERING"));
    const after = overpowering(0);
    expect(traitsOf(after, ccOf(after), DEPS)).toContain(trait("OVERPOWERING"));
  });

  it("action: places a counter, draws 2 cards, then discards 1 card from hand", () => {
    const s = overpowering(1);
    const run = settle(
      (() => {
        const r = applyCommand(s, use(P1, ccOf(s), ACTION_B), DEPS);
        if (!r.ok) throw new Error(r.error.message);
        return r.state;
      })(),
      firstLegal,
      undefined,
      DEPS,
    );
    expect(corruption(run)).toBe(2);
    expect(handSize(run)).toBe(handSize(s) + 2 - 1);
    expect(playerOf(run, P1).discard.length).toBe(playerOf(s, P1).discard.length + 1);
  });

  it("constant: with 5 counters here the player is defeated (4 -> 5 eliminates; 3 -> 4 does not)", () => {
    const dead = act(overpowering(4), ACTION_B);
    expect(playerOf(dead, P1).eliminated).toBe(true);
    const alive = act(overpowering(3), ACTION_B);
    expect(corruption(alive)).toBe(4);
    expect(playerOf(alive, P1).eliminated).toBe(false);
  });
});
