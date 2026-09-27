import { encounterSetId } from "@mc/content";
import { activeEncounterDeck, activeVillain } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  patchInstance,
  settle,
  toHero,
  P1,
} from "../../../testing/harness.js";
import { startWave5Game, runWave5, WAVE5_DEPS } from "../../testing.js";
import { ghostSpiderScenario } from "../ghost-spider/support.js";

const venomGame = (seed = 1) =>
  startWave5Game(ghostSpiderScenario("venom", { seed, modularSetIds: [encounterSetId("bomb_scare")] }));

describe('"Leave Us Alone!" (27076a/b)', () => {
  it("27076a.setup: Setup puts the Bell Tower environment into play, Quiet side faceup", () => {
    const state = venomGame();
    const tower = instancesOf(state, "27077a")[0] ?? instancesOf(state, "27077b")[0];
    expect(tower).toBeDefined();
    expect(state.villainArea).toContain(tower);
    expect(inst(state, tower!).flipped).toBe(false);
  });

  it("27076b.leave-us-alone-forced-interrupt: moves each facedown boost card from your identity to Venom when he activates against you", () => {
    const state = venomGame();
    const villain = activeVillain(state).instanceId;
    const identity = identityOf(state);
    // Strip Toughness and attack once so Vengeance places a facedown boost card on the identity (27073.vengeance,
    // `villain.test.ts`).
    const stripped = patchInstance(state, villain, { statuses: { ...inst(state, villain).statuses, tough: 0 } });
    const withBoost = settle(
      runWave5(stripped, toHero(P1), {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identity,
        targetInstanceId: villain,
      }),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(withBoost, identity).boostCards.length).toBe(1);
    const boostCard = inst(withBoost, identity).boostCards[0]!;
    // End the turn: the villain phase's own step 2 activates Venom against the lone player, firing the Forced
    // Interrupt before his activation resolves — the moved card joins that activation's own boost cards and is
    // flipped and discarded with them (docs/phase7-wave5.md §3.6: "moved before an activation's flip step, they
    // resolve in it"), so by the time the phase settles it has left both the identity and Venom for the encounter
    // discard pile.
    const afterVillainPhase = settle(runWave5(withBoost, endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
    expect(inst(afterVillainPhase, identity).boostCards).not.toContain(boostCard);
    expect(inst(afterVillainPhase, villain).boostCards).not.toContain(boostCard);
    expect(activeEncounterDeck(afterVillainPhase).discard).toContain(boostCard);
  });
});
