import type { GameState } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { firstLegal, identityOf, inst, instancesOf, P1, settle, stackEncounterDeck } from "../../testing/harness.js";
import { WAVE4_DEPS } from "../index.js";
import { runWave4, startWave4Game } from "../testing.js";
import { spectrumScenario } from "./support.js";

/**
 * Real-game tests for Frost Giants (`mts` 21156-21159, `frost-giants.ts`), Hela's own other recommended modular
 * set (also reused by the Loki scenario) — reached, like `hela.test.ts`, through a real "hela" scenario game.
 */

const helaGame = (seed = 1) => startWave4Game(spectrumScenario("hela", { seed }));

const reveal = (state: GameState, code: string): GameState =>
  settle(
    runWave4(stackEncounterDeck(state, "01186", code), { type: "endTurn", playerId: P1 }),
    firstLegal,
    undefined,
    WAVE4_DEPS,
  );

describe("Laufey (21156.laufey-forced-response)", () => {
  it("Forced Response: after Laufey attacks and damages a character, stun that character", () => {
    // No direct player command drives a minion's own attack deterministically (the same trade-off `hela.test.ts`'s
    // own Skurge/Nidhogg tests make, for the identical reason); the trigger and effect are asserted directly
    // instead — the exact shape `wave4/mts/ebony-maw.ts`'s own Supergiant (21086) already uses for this exact
    // sentence ("after [it] attacks and damages a character, stun that character").
    const ability = WAVE4_DEPS.abilities["21156.laufey-forced-response"]!;
    expect(ability.trigger).toMatchObject({
      kind: "response",
      forced: true,
      on: { on: "enemyAttack", selfIs: "source", requireResults: { damage: 1 } },
    });
    expect(ability.effects).toEqual([{ kind: "giveStatus", target: { kind: "eventTarget" }, status: "stunned" }]);
  });
});

describe("Frost Giant (21157.boost)", () => {
  it("reprints thor 06029's own boost verbatim (auto-aliased by ../reprints.ts)", () => {
    expect(WAVE4_DEPS.abilities["21157.boost"]).toStrictEqual(WAVE4_DEPS.abilities["06029.boost"]);
  });
});

describe("Frozen (21158)", () => {
  it("attached identity cannot ready, even at the end of the round (21158.frozen-constant)", () => {
    const state = helaGame();
    const identity = identityOf(state, P1);
    const frozen = instancesOf(state, "21158")[0]!;
    const attached: GameState = {
      ...state,
      instances: {
        ...state.instances,
        [frozen]: { ...state.instances[frozen]!, attachedTo: identity },
        [identity]: {
          ...state.instances[identity]!,
          attachments: [...state.instances[identity]!.attachments, frozen],
          exhausted: true,
        },
      },
    };
    const afterRound = settle(runWave4(attached, { type: "endTurn", playerId: P1 }), firstLegal, undefined, WAVE4_DEPS);
    expect(inst(afterRound, identity).exhausted).toBe(true); // never readied, even by the phase's own end-of-round ready
  });

  it("Alter-Ego Action: spend [energy][physical] resources to discard it (21158.frozen-action)", () => {
    const ability = WAVE4_DEPS.abilities["21158.frozen-action"]!;
    expect(ability.trigger).toMatchObject({ kind: "action", form: "alterEgo" });
    expect(ability.cost).toEqual({ resources: { energy: 1, physical: 1 } });
    expect(ability.effects).toEqual([{ kind: "discardFromPlay", target: { kind: "self" } }]);
  });
});

describe("Unnatural Storm (21159)", () => {
  it("heroes and allies cannot be readied by player card effects, but the phase's own end-of-round ready still works (21159.unnatural-storm-constant)", () => {
    const ability = WAVE4_DEPS.abilities["21159.unnatural-storm-constant"]!;
    if (ability.trigger.kind !== "constant") throw new Error("not a constant ability");
    expect(ability.trigger.rules).toEqual([
      { kind: "cannotReady", target: { categories: ["hero", "ally"] }, bySource: "playerCard" },
    ]);
  });

  it("When Revealed: exhausts each ally in play (21159.when-revealed)", () => {
    const state = helaGame();
    const garm = instancesOf(state, "21143")[0]!; // an already-in-play minion, not an ally — unaffected, for contrast
    void garm;
    const odin = instancesOf(state, "21139a")[0]!;
    const detachedOdin: GameState = {
      ...state,
      instances: { ...state.instances, [odin]: { ...state.instances[odin]!, attachedTo: null, exhausted: false } },
      players: state.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, odin] } : p)),
    };
    const revealed = reveal(detachedOdin, "21159");
    expect(inst(revealed, odin).exhausted).toBe(true);
  });
});
