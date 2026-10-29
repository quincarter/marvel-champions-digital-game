import { cardId } from "@mc/content";
import { createGame, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { P1, firstLegal, inst, patchInstance, settle } from "../../testing/harness.js";
import { SPIDER_MAN, heroAttacks, heroForm, types } from "../../wave9/testing.js";
import { WAVE11_DEPS } from "../index.js";
import { wave11Scenario } from "../setup.js";
import { CORRIDORS, encounterPiles, passageOn, villainId } from "./trap-testing.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * QA 2026-10-23: Into the Labyrinth 1B (65038b), "Forced Interrupt: When Shifting Corridors would take any amount of
 * damage, remove that much threat from here instead" (`shadow-labyrinth.ts`, `on.damage(CORRIDORS)` +
 * `instead(removeThreat(eventAmount, self))`).
 *
 * Constant damage-taken modifiers (reductions, increases, caps) apply BEFORE step-3 "would take" interrupts
 * (`damageConstantsBeforeWouldTake`, `packages/engine/src/resolve/event.ts`), so "that much" is the amount after the
 * constants, not the amount dealt. Sources: RRG 1.8 "Abilities" p. 5 (constant abilities take effect before triggered
 * ones) and FAQ p. 57 (constants before status cards before triggered abilities); FFG rulings June 6, 2024 (post RRG
 * 1.5), Ruling 205 ("Constant abilities that reduce damage will be applied before interrupt abilities that reduce
 * damage") and Ruling 206 (`docs/rulings/`). Engine-level version of the same ordering:
 * `packages/engine/src/damage-constants-before-would-take.test.ts`.
 *
 * Staging: the real Shadow Labyrinth game (`wave11Scenario`), Spider-Man in hero form, stage 1B scheme at 10 threat.
 * The constant is a real card: Neocarbon Scales (27150, Osborn Tech), "Reduce the amount of damage attached villain
 * takes from each attack by 1", seated on Shifting Corridors by test surgery (an encounter card instance of the game
 * re-pointed at 27150 and attached faceup; the labyrinth encounter deck has no Osborn Tech card of its own).
 */

const NEOCARBON_SCALES = "27150";
const schemeId = (s: GameState): InstanceId => s.mainScheme.instanceId;

function labyrinth(): GameState {
  const created = createGame(
    wave11Scenario("shadow-labyrinth", {
      players: [SPIDER_MAN],
      seed: 3,
      villainCardId: "65013a",
      modularSetIds: ["ninja_swarm"],
    }),
    WAVE11_DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  const settled = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE11_DEPS);
  return patchInstance(heroForm(settled, P1), schemeId(settled), { threat: 10 });
}

/** Neocarbon Scales attached to `host`, faceup: a spare encounter card instance of the game becomes the scales. */
function withScalesOn(state: GameState, host: InstanceId): { state: GameState; id: InstanceId } {
  const id = encounterPiles(state).deck[0]!;
  const scales = patchInstance(state, id, { cardId: cardId(NEOCARBON_SCALES), attachedTo: host, faceup: true });
  return { id, state: patchInstance(scales, host, { attachments: [...inst(scales, host).attachments, id] }) };
}

const threatRemovedFromScheme = (state: GameState, events: Parameters<typeof types>[0]) =>
  types(events, "threatRemoved").filter((e) => e.schemeInstanceId === schemeId(state));

describe("Into the Labyrinth 1B: 'that much' is the damage after the constant modifiers (Rulings 205, 206)", () => {
  it("the control: with no constant modifier, the whole attack's damage is removed as threat", () => {
    const start = labyrinth();
    const run = heroAttacks(WAVE11_DEPS, start, villainId(start));
    const removed = threatRemovedFromScheme(start, run.events);
    expect(removed).toHaveLength(1);
    const dealt = removed[0]!.amount;
    // Spider-Man's ATK: more than 1, so a reduction by 1 leaves something to remove.
    expect(dealt).toBeGreaterThanOrEqual(2);
    expect(inst(run.state, schemeId(start)).threat).toBe(10 - dealt);
    expect(inst(run.state, villainId(start)).damage).toBe(0);
    expect(passageOn(run.state)).toBe(10);
  });

  it("a constant 'takes 1 less damage from each attack' (Neocarbon Scales) on Shifting Corridors: 1 less threat is removed", () => {
    const start = labyrinth();
    const corridors = villainId(start);
    expect(inst(start, corridors).cardId).toBe(cardId(CORRIDORS));
    const baseline = threatRemovedFromScheme(start, heroAttacks(WAVE11_DEPS, start, corridors).events)[0]!.amount;

    const scaled = withScalesOn(start, corridors);
    const run = heroAttacks(WAVE11_DEPS, scaled.state, corridors);
    const removed = threatRemovedFromScheme(start, run.events);
    expect(removed).toHaveLength(1);
    // Constants first (Ruling 205): the interrupt's "that much" is the reduced amount, not the amount dealt.
    expect(removed[0]!.amount).toBe(baseline - 1);
    expect(inst(run.state, schemeId(start)).threat).toBe(10 - (baseline - 1));
    // The replaced damage is not taken either way.
    expect(inst(run.state, corridors).damage).toBe(0);
    expect(passageOn(run.state)).toBe(10);
  });
});
