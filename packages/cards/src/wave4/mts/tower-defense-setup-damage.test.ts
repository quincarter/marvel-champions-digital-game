/**
 * Tower Defense's optional setup damage (MC21 p. 11, "Modular Difficulty"; docs/phase7-wave4.md §4 Q4, decided
 * 2026-09-25): an option, off by default, that places the printed recommendation for the mode being played —
 * "Standard Mode: Place 1[per_hero] damage. Expert Mode: Place 2[per_hero] damage. Heroic Mode: Place 3[per_hero]
 * damage." — on the Avengers Tower environment during setup.
 */
import { cardId, type PlayModes, type ScenarioSetupOptions } from "@mc/content";
import { createGame, type GameEvent, type GameState } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { playableScenario } from "../../playable/index.js";
import { applyOk, firstLegal } from "../../testing/harness.js";
import { WAVE4_DEPS } from "../index.js";
import { wave4Scenario } from "../setup.js";
import { towerDefenseScenario } from "./tower-defense-setup.js";

const TWO_SEATS = [{ starterDeckId: "spectrum-leadership" }, { starterDeckId: "adam-warlock-all-aspects" }] as const;
const DAMAGE: ScenarioSetupOptions = { towerDefenseSetupDamage: true };
const AVENGERS_TOWER_ENVIRONMENT = cardId("21100a");

function setUp(
  over: { readonly modes?: PlayModes; readonly setupOptions?: ScenarioSetupOptions; readonly seats?: number } = {},
): { readonly state: GameState; readonly events: readonly GameEvent[] } {
  const config = towerDefenseScenario({
    seed: 11,
    players: TWO_SEATS.slice(0, over.seats ?? 2),
    ...(over.modes ? { modes: over.modes } : {}),
    ...(over.setupOptions ? { setupOptions: over.setupOptions } : {}),
  });
  const created = createGame(config, WAVE4_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  // `settle`, keeping every event: setup stops for the Black Order Besieger searches before the instruction runs.
  let state = created.state;
  const events: GameEvent[] = [...created.events];
  for (let guard = 0; state.pendingChoice && state.step.phase !== "player"; guard++) {
    if (guard > 200) throw new Error("setup did not settle");
    const choice = state.pendingChoice;
    const step = applyOk(
      state,
      {
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: firstLegal(state),
      },
      WAVE4_DEPS,
    );
    state = step.state;
    events.push(...step.events);
  }
  return { state, events };
}

/** Damage on the Avengers Tower environment (one copy, in play by the end of setup). */
const towerDamage = (state: GameState): number => {
  const ids = Object.keys(state.instances).filter((id) => state.instances[id]?.cardId === AVENGERS_TOWER_ENVIRONMENT);
  expect(ids).toHaveLength(1);
  return state.instances[ids[0]!]!.damage;
};
/** Only the damage the option placed: `damagePlaced` on the tower (the game itself may already damage it in setup). */
const placedOnTower = (state: GameState, events: readonly GameEvent[]): number => {
  const tower = Object.keys(state.instances).find((id) => state.instances[id]?.cardId === AVENGERS_TOWER_ENVIRONMENT);
  return events
    .filter((event) => event.type === "damagePlaced" && event.targetInstanceId === tower)
    .reduce((n, event) => n + (event.type === "damagePlaced" ? event.amount : 0), 0);
};

describe("Tower Defense's optional setup damage (MC21 p. 11)", () => {
  it("is off by default: no instruction reaches the engine and the tower starts undamaged", () => {
    const config = towerDefenseScenario({ seed: 11, players: TWO_SEATS });
    expect(config.scenarioSetupInstructions).toBeUndefined();
    const { state, events } = setUp();
    expect(placedOnTower(state, events)).toBe(0);
    expect(events.some((event) => event.type === "scenarioSetupInstructionResolved")).toBe(false);
  });

  it.each([
    ["Standard", {}, 1],
    ["Expert", { expert: true }, 2],
    ["Heroic", { expert: true, heroic: 1 }, 3],
  ] as const)("%s mode places its printed [per_hero] damage on Avengers Tower", (label, modes, perHero) => {
    for (const seats of [1, 2]) {
      const without = setUp({ modes: modes as PlayModes, seats });
      const { state, events } = setUp({ modes: modes as PlayModes, setupOptions: DAMAGE, seats });
      // Same seed, same choices: the option is the only difference, and it adds exactly the printed amount.
      expect(placedOnTower(state, events)).toBe(perHero * seats);
      expect(towerDamage(state)).toBe(towerDamage(without.state) + perHero * seats);
      const resolved = events.find((event) => event.type === "scenarioSetupInstructionResolved");
      expect(resolved).toMatchObject({
        instructionId: "mc21.tower-defense.setup-damage",
        citation: "MC21 p. 11",
        text: `Modular Difficulty — ${label} Mode: Place ${perHero}[per_hero] damage on Avengers Tower.`,
      });
    }
  });

  it("is plain serializable setup data, carried into the game state for replay", () => {
    const config = towerDefenseScenario({ seed: 11, players: TWO_SEATS, setupOptions: DAMAGE });
    expect(JSON.parse(JSON.stringify(config.scenarioSetupInstructions))).toEqual(config.scenarioSetupInstructions);
    expect(setUp({ setupOptions: DAMAGE }).state.scenarioRules.setupInstructions).toEqual(
      config.scenarioSetupInstructions,
    );
  });

  it("reaches Tower Defense through the playable-pool builder the client uses", () => {
    const config = playableScenario("tower-defense", { seed: 11, players: TWO_SEATS, setupOptions: DAMAGE });
    expect(config.scenarioSetupInstructions).toHaveLength(1);
  });

  it("is refused at any other scenario rather than silently ignored, and in skirmish mode", () => {
    expect(() => wave4Scenario("ebony-maw", { seed: 11, players: TWO_SEATS, setupOptions: DAMAGE })).toThrow(
      /tower-defense/,
    );
    expect(() => playableScenario("rhino", { seed: 11, players: TWO_SEATS, setupOptions: DAMAGE })).toThrow(
      /tower-defense/,
    );
    expect(() => setUp({ modes: { skirmish: { villainVersion: "x" } }, setupOptions: DAMAGE })).toThrow(/skirmish/);
  });
});
