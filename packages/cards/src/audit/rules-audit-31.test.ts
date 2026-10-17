/**
 * Rules audit chunk 31 (FFG rulings Nov 19, 2024 - Jan 24, 2025, post-RRG 1.6). Audit proofs only: each `it.fails`
 * marks a place the engine does something the rulings forbid, and flips to a failure when it is fixed.
 */
import { describe, expect, it } from "vitest";
import { activeVillain, type InstanceId } from "@mc/engine";
import { identityOf, instancesOf, P1, patchInstance, stackEncounterDeck, toHero } from "../testing/harness.js";
import { driveEvents } from "../testing/staging.js";
import { wave3Scenario } from "../wave3/setup.js";
import { runWave3, startWave3Game, WAVE3_DEPS } from "../wave3/testing.js";

describe("audit 31.3: Drang III discards minions into play (Ruling 38, Nov 19, 2024)", () => {
  // "you will resolve any 'Interrupt' abilities on the minions immediately after they engage a player; and after they've
  // all engaged, resolve all Quickstrike and Teamwork abilities on those minions, then any Response abilities."
  it.fails("every discarded minion engages before the first quickstrike attack resolves", () => {
    const config = wave3Scenario("brotherhood-of-badoon", {
      difficulty: "expert",
      players: [{ starterDeckId: "groot-protection" }],
      seed: 2026,
    });
    const start = startWave3Game({
      ...config,
      encounterDeck: [...config.encounterDeck, "16134" as never, "16134" as never],
    });
    // Solo: 4 cards. Two Kree Privates (quickstrike) first, then fillers.
    const stacked = stackEncounterDeck(start, "16134", "16134", "01186", "01187");
    const hero = runWave3(stacked, toHero(P1));
    const villain = hero.villains[0]!.instanceId;
    const primed = patchInstance(hero, villain, { damage: 26 });
    const { state, events } = driveEvents(WAVE3_DEPS, primed, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(primed, P1),
      targetInstanceId: villain,
    });
    expect(activeVillain(state).stageIndex).toBe(2);
    const [first, second] = [...(instancesOf(state, "16134") as InstanceId[])].sort();
    const enteredPlay = (id: InstanceId) =>
      events.findIndex((e) => e.type === "cardMoved" && e.instanceId === id && e.to.kind === "playArea");
    const attackedBy = (id: InstanceId) =>
      events.findIndex((e) => e.type === "attackResolved" && e.enemyInstanceId === id);
    expect(attackedBy(first!)).toBeGreaterThan(-1); // setup check: the quickstrike attack happened at all
    expect(enteredPlay(second!)).toBeGreaterThan(-1);
    // Actual: the first minion's whole quickstrike attack (event 35-57 of the trace) resolves before the second minion
    // has even entered play.
    expect(enteredPlay(second!)).toBeLessThan(attackedBy(first!));
  });
});
