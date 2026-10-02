import { cardsInPlay, createGame, replay, type GameState } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { playToOutcome } from "../../testing/driver.js";
import { driveEventsPicking, encounterCardInVillainArea } from "../../testing/staging.js";
import {
  firstLegal,
  identityOf,
  inst,
  P1,
  patchInstance,
  runWith,
  stackEncounterDeck,
  toHero,
} from "../../testing/harness.js";
import { WAVE6_DEPS, wave6Scenario } from "../index.js";
import { inEncounterPiles } from "./brotherhood-testing.js";
import { mansionAttackGame, villainTitle } from "./mansion-attack-testing.js";

/**
 * Whole Sabretooth games with the Brotherhood as the modular set (the Mystique set is another module), played by the
 * card-name-agnostic greedy driver (`../../testing/driver.ts`) with a Core hero (Spider-Man, Justice) to a real outcome;
 * the session log must replay to the identical final state.
 */
describe.each(["standard", "expert"] as const)(
  "Sabretooth with the Brotherhood modular (%s) and a Core hero",
  (difficulty) => {
    it.each([2026, 7])(
      "seed %i plays to an outcome and replays deep-equal",
      (seed) => {
        const config = wave6Scenario("sabretooth", {
          players: [{ starterDeckId: "core-spider-man-justice" }],
          seed,
          difficulty,
          modularSetIds: ["brotherhood"],
        });
        const created = createGame(config, WAVE6_DEPS);
        if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
        expect(inEncounterPiles(created.state, "32074")).toHaveLength(1);
        const result = playToOutcome(created.state, WAVE6_DEPS);
        expect(result.outcome).not.toBeNull();
        expect(result.rounds).toBeGreaterThanOrEqual(1);
        const replayed = replay(result.session.log, WAVE6_DEPS);
        expect(replayed.ok).toBe(true);
        if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
      },
      120_000,
    );
  },
);

/**
 * Mansion Attack requires the Brotherhood set, so its minions come from the scenario's own card data: a Mutant
 * Terrorists reveal puts one into play with no state surgery, and the minion's own scripted response then fires.
 */
describe("Mansion Attack: the required Brotherhood set supplies the minions", () => {
  const MINIONS = ["32073", "32074", "32075", "32076"];

  it("the four minions, Homo Superior (x2), Mutant Terrorists and The Brotherhood are in the encounter piles from setup", () => {
    const state = mansionAttackGame();
    for (const code of [...MINIONS, "32078", "32079"]) expect(inEncounterPiles(state, code), code).toHaveLength(1);
    expect(inEncounterPiles(state, "32077")).toHaveLength(2);
    for (const id of [
      "32073.avalanche-forced-response",
      "32074.blob-forced-response",
      "32075.pyro-forced-response",
      "32076.toad-forced-response",
    ])
      expect(WAVE6_DEPS.abilities[id], id).toBeDefined();
  });

  it("Mutant Terrorists reveals a Brotherhood minion engaged with you, which then attacks and its response fires", () => {
    let base: GameState = mansionAttackGame({ villain: "Avalanche" });
    expect(villainTitle(base)).toBe("Avalanche");
    base = runWith(WAVE6_DEPS, base, toHero(P1));
    // The Brotherhood side scheme already in play, so the Terrorists falls through to the minion.
    base = encounterCardInVillainArea(base, "32079").state;
    const stacked = stackEncounterDeck(base, "01186", "32078", "32074");
    // No minion is engaged before the reveal: the card data and the script put Blob there.
    expect(
      cardsInPlay(stacked).filter((id) => stacked.cardPool[stacked.instances[id]!.cardId]!.type === "minion"),
    ).toEqual([]);
    const first = driveEventsPicking(WAVE6_DEPS, stacked, firstLegal, { type: "endTurn", playerId: P1 });
    const [blob] = cardsInPlay(first.state).filter((id) => first.state.instances[id]!.cardId === "32074");
    expect(blob).toBeDefined();
    expect(inst(first.state, blob!).engagedWith).toBe(P1);
    // Next round: Blob (engaged now) attacks, and its Forced Response (from the scripted set) resolves.
    const hero = identityOf(first.state, P1);
    const healed = patchInstance(first.state, hero, { damage: 0 });
    const second = driveEventsPicking(WAVE6_DEPS, healed, firstLegal, { type: "endTurn", playerId: P1 });
    expect(second.events.some((e) => e.type === "attackResolved" && e.enemyInstanceId === blob)).toBe(true);
    expect(
      second.events.some((e) => e.type === "abilityResolved" && e.abilityId === "32074.blob-forced-response"),
    ).toBe(true);
  });
});
