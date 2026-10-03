import {
  activeVillain,
  createGame,
  hasKeyword,
  replay,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { playToOutcome, type DriverResult } from "../../testing/driver.js";
import { inst, instancesOf, patchInstance } from "../../testing/harness.js";
import { stageNemesisCardForReveal, withForm } from "../../testing/staging.js";
import { WAVE6_DEPS, wave6Scenario, type Wave6ScenarioOptions } from "../index.js";
import { phoenixGame } from "./phoenix/support.js";

/**
 * Wave 6 rules QA, Phoenix (`docs/phase7-wave6-qa-cyclops-phoenix.md`). Two parts.
 *
 * 1. Rulings that touch a Phoenix card. None of the sources below was pinned by a module test before this pass.
 *    - Ruling Jul 9, 2026 (3) #5 (Peril prohibits other players from acting or playing cards), for Fiery Rage 34031:
 *      asserted below (the card's peril keyword; the engine's sole-decider mark is the engine's own, pinned in its tests).
 *    No FAQ entry (p. 55 to 64) and no erratum (p. 65 to 69) names a Phoenix card or Jean Grey; the one erratum near
 *    her pack, Logan's Setup (p. 68), is the wording Q25 copies for Jean Grey's Setup (`phoenix/identity.test.ts` pins
 *    that Setup). No other post-1.7 ruling names a card of the pack (greps of the RRG and the rulings file for the hero,
 *    Jean Grey, Phoenix Force, her nemesis set and every card title in the pack).
 * 2. Whole games with Phoenix's precon, 2 players standard (with Wolverine, another wave 6 hero) and 1 hero expert,
 *    played by the greedy driver and replayed deep-equal: one asserting Phoenix Force's counters and flip, one asserting
 *    Dark Phoenix's reveal and her scheme onto Consume the World.
 */

const stunVillain = (state: GameState) =>
  patchInstance(state, activeVillain(state).instanceId, {
    statuses: { ...inst(state, activeVillain(state).instanceId).statuses, stunned: 1 },
  });

describe("rulings", () => {
  describe("Ruling Jul 9, 2026 (3) #5: Fiery Rage (34031) has Peril", () => {
    const board = (): GameState => {
      const base = phoenixGame("rhino", {
        seed: 1,
        extraPlayers: [{ starterDeckId: "core-spider-man-justice" }],
      });
      return stunVillain(withForm(base, { heroForm: 0 }));
    };

    it("the card prints the peril keyword", () => {
      const staged = stageNemesisCardForReveal(board(), "34031");
      const [rage] = instancesOf(staged, "34031");
      // The keyword the engine reads to mark a stacked card's prompts `soleDecider` (`perilOnStack`, ctx.ts); the mark
      // itself is the engine's, pinned in engine tests, and Fiery Rage's reveal raises no prompt in this staging.
      expect(hasKeyword(staged, rage!, "peril", WAVE6_DEPS)).toBe(true);
    });
  });
});

const DUO = [{ starterDeckId: "phoenix-justice" }, { starterDeckId: "wolverine-aggression" }] as const;
const SOLO = [{ starterDeckId: "phoenix-justice" }] as const;
const VARIANTS: readonly { label: string; options: Omit<Wave6ScenarioOptions, "seed"> }[] = [
  { label: "2 players, standard (with Wolverine)", options: { players: DUO } },
  { label: "1 hero, expert", options: { players: SOLO, difficulty: "expert" } },
];

/** First seed of 1..60 whose game (played from setup, no surgery) reaches an outcome and `wanted` holds of its events. */
const findGame = (
  options: Omit<Wave6ScenarioOptions, "seed">,
  wanted: (events: readonly GameEvent[], state: GameState, force: InstanceId) => boolean,
): { result: DriverResult; events: readonly GameEvent[] } => {
  for (let seed = 1; seed <= 60; seed++) {
    const created = createGame(wave6Scenario("rhino", { ...options, seed }), WAVE6_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const result = playToOutcome(created.state, WAVE6_DEPS);
    if (!result.outcome) continue;
    const played = replay(result.session.log, WAVE6_DEPS);
    if (!played.ok) throw new Error("replay failed");
    // The replay of the log must reach the identical final state.
    expect(played.state).toEqual(result.session.state);
    const force = instancesOf(result.session.state, "34002a")[0]!;
    if (wanted(played.events, result.session.state, force)) return { result, events: played.events };
  }
  throw new Error("no seed of 1..60 ended as wanted");
};

describe.each(VARIANTS)("Phoenix vs Rhino ($label)", ({ options }) => {
  it("Phoenix Force gains power counters and flips", () => {
    // Setup puts Phoenix Force in Restrained with 4 counters; Burning Hunger or Psionic Bond take them off, and the
    // last one removed flips it Unleashed (34002a forced response). Required: a power counter placed and a flip.
    const { result, events } = findGame(options, (evs, _state, force) => {
      const placed = evs.some((e) => e.type === "counterAdded" && e.instanceId === force && e.counterType === "power");
      const flipped = evs.some((e) => e.type === "cardFlipped" && e.instanceId === force);
      return placed && flipped;
    });
    expect(result.outcome).not.toBeNull();
    expect(events.some((e) => e.type === "cardFlipped")).toBe(true);
  }, 900_000);

  it("Dark Phoenix is revealed and schemes onto Consume the World", () => {
    // Burning Hunger reveals her while Phoenix Force is Unleashed. No surgery was needed: the driver reaches it.
    const { result, events } = findGame(options, (evs, state) => {
      const code = (id: InstanceId) => state.instances[id]!.cardId as string;
      const consume = new Set(instancesOf(state, "34030"));
      return (
        evs.some((e) => e.type === "abilityResolved" && (e.abilityId as string) === "34029.when-revealed") &&
        evs.some(
          (e) => e.type === "schemeResolved" && code(e.enemyInstanceId) === "34029" && consume.has(e.schemeInstanceId),
        )
      );
    });
    expect(result.outcome).not.toBeNull();
    expect(events.some((e) => e.type === "schemeResolved")).toBe(true);
  }, 900_000);
});
