import { encounterSetId } from "@mc/content";
import { activeVillain, type GameSetupConfig } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
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

const venomGame = (overrides: Partial<GameSetupConfig> = {}, seed = 1) =>
  startWave5Game({
    ...ghostSpiderScenario("venom", { seed, modularSetIds: [encounterSetId("bomb_scare")] }),
    ...overrides,
  });

/** Removes the Toughness status card so a plain basic attack actually deals damage — every Venom stage prints
 * Toughness, which would otherwise absorb the very first attack for 0 damage and never trigger Vengeance/Retribution. */
const withoutTough = (state: ReturnType<typeof venomGame>, id: ReturnType<typeof activeVillain>["instanceId"]) =>
  patchInstance(state, id, { statuses: { ...inst(state, id).statuses, tough: 0 } });

describe("Venom (27073-27075): Vengeance / Retribution", () => {
  it("27073.vengeance: attacking and damaging Venom (I) places 1 facedown boost card on your identity", () => {
    const state = venomGame();
    const villain = activeVillain(state).instanceId;
    const identity = identityOf(state);
    const stripped = withoutTough(state, villain);
    const before = inst(stripped, identity).boostCards.length;
    const after = settle(
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
    expect(inst(after, villain).damage).toBeGreaterThan(0);
    expect(inst(after, identity).boostCards.length).toBe(before + 1);
  });

  it("27074.when-revealed: Venom (II) starting stage searches for and puts Tooth and Nail into play", () => {
    const state = venomGame({ villainStartStageIndex: 1, villainLastStageIndex: 1 });
    expect(activeVillain(state).stageIndex).toBe(1);
    const toothAndNail = instancesOf(state, "27081").find((id) => state.villainArea.includes(id));
    expect(toothAndNail).toBeDefined();
  });

  it("27075.when-revealed: Venom (III) starting stage places 2 facedown boost cards on each identity", () => {
    const state = venomGame({ villainStartStageIndex: 2, villainLastStageIndex: 2 });
    expect(activeVillain(state).stageIndex).toBe(2);
    expect(inst(state, identityOf(state)).boostCards.length).toBe(2);
  });

  it("27075.retribution: the first attack this turn places 2 facedown boost cards instead of 1", () => {
    const state = venomGame({ villainStartStageIndex: 2, villainLastStageIndex: 2 });
    const villain = activeVillain(state).instanceId;
    const identity = identityOf(state);
    const stripped = withoutTough(state, villain);
    const before = inst(stripped, identity).boostCards.length; // 2, from the starting stage's own When Revealed
    const after = settle(
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
    expect(inst(after, villain).damage).toBeGreaterThan(0);
    expect(inst(after, identity).boostCards.length).toBe(before + 2);
  });
});
