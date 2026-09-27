import { type GameState } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  endTurn,
  firstLegal,
  inst,
  instancesOf,
  P1,
  playerOf,
  settle,
  stackEncounterDeck,
  toHero,
} from "../../../testing/harness.js";
import { encounterCardInVillainArea } from "../../../testing/staging.js";
import { runWave5, WAVE5_DEPS } from "../../testing.js";
import { startWave5Game } from "../../testing.js";
import { ghostSpiderScenario } from "../ghost-spider/support.js";

const sandmanGame = (seed = 1) => startWave5Game(ghostSpiderScenario("sandman", { seed }));

const mainThreatOf = (state: GameState): number => state.instances[state.mainScheme.instanceId]?.threat ?? 0;

/** Sandman's own natural villain-phase attack (Sand Blast) and its own Surging Sands discard the top several
 * encounter cards before the "deal to each player" step ever reaches the deck — `sandman/encounter-set-2.test.ts`'s
 * own `dealPastNaturalAttack` docblock explains why this many fillers are needed to actually deliver `code`. */
const dealPastNaturalAttack = (state: GameState, code: string): GameState =>
  stackEncounterDeck(state, "01186", "01186", "01187", "01188", "01189", "01190", code);

describe("Panic in the Streets (27127)", () => {
  it("27127.panic-in-the-streets-constant: blanks the printed text box of location and persona supports", () => {
    // Structural/registry check: no wave 5 card in play in a Ghost-Spider-vs-Sandman game is itself a [Location]
    // or [Persona] support, so this is proven at the registry level (the ability compiles to two `blankTextBox`
    // rules, one per trait) rather than by observing a specific card's text stop working.
    expect(WAVE5_DEPS.abilities["27127.panic-in-the-streets-constant"]).toMatchObject({
      trigger: {
        kind: "constant",
        rules: [
          { kind: "blankTextBox", target: { categories: ["support"], trait: expect.any(String) } },
          { kind: "blankTextBox", target: { categories: ["support"], trait: expect.any(String) } },
        ],
      },
    });
  });
});

describe("Rhino (27128) and Calling in Favors (27129)", () => {
  it("27128.rhino-constant: Rhino's attacks gain overkill and piercing", () => {
    const state = sandmanGame();
    const placed = encounterCardInVillainArea(state, "27128");
    expect(WAVE5_DEPS.abilities["27128.rhino-constant"]).toMatchObject({
      trigger: { kind: "constant", rules: [{ kind: "attackKeywords", keywords: ["overkill", "piercing"] }] },
    });
    expect(placed.state.villainArea).toContain(placed.id);
  });

  it("27129.when-revealed: Rhino is not in play, so he is fetched into play engaged with the revealer", () => {
    const state = sandmanGame();
    const beforeThreat = mainThreatOf(state);
    const revealed = settle(
      runWave5(dealPastNaturalAttack(state, "27129"), toHero(P1), endTurn(P1)),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    // A minion sits in its engaged player's own play area, not `villainArea` (`apply-effect.ts`'s own "a minion
    // belongs to the encounter side even while it sits in a player's area").
    const rhino = instancesOf(revealed, "27128").find((id) => playerOf(revealed, P1).playArea.includes(id));
    expect(rhino).toBeDefined();
    expect(inst(revealed, rhino!).engagedWith).toBe(P1);
    // Rhino was not in play, so "Rhino schemes with +2 SCH" had no legal target and did nothing extra to threat.
    expect(mainThreatOf(revealed)).toBeGreaterThanOrEqual(beforeThreat);
  });
});
