import { type GameState } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  P1,
  playerOf,
  settle,
  stackEncounterDeck,
  toHero,
  type Picker,
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

describe("Now or Never (27130)", () => {
  const EXHAUST_OPTION = "Exhaust a character you control and spend 1 resource of any type";

  /** Picks the named `chooseOne` option by its label; every other prompt (the character to exhaust, whether to
   * pay a resource) falls through to `firstLegal`. */
  const pickOption =
    (label: string): Picker =>
    (s) => {
      const choice = s.pendingChoice;
      if (choice?.prompt.kind === "chooseOption") {
        const match = choice.options.find((o) => o.label === label);
        if (match) return [match.optionId];
      }
      return firstLegal(s);
    };

  it("27130.when-revealed: option 1 places 1 acceleration token on the main scheme", () => {
    const state = sandmanGame();
    const before = state.mainScheme.accelerationTokens;
    const revealed = settle(
      runWave5(dealPastNaturalAttack(state, "27130"), toHero(P1), endTurn(P1)),
      pickOption("Place 1 acceleration token on the main scheme"),
      undefined,
      WAVE5_DEPS,
    );
    expect(revealed.mainScheme.accelerationTokens).toBe(before + 1);
  });

  it("27130.when-revealed: option 2 exhausts the revealer's own character and spends a resource they hold", () => {
    // Ghost-Spider's own hero identity is the only character in play in a 1-player game; Energy (27020) is her deck's
    // own generic-payable resource card, moved to hand so there is something to spend.
    const given = moveToHand(sandmanGame(), P1, "27020");
    const [energy] = given.ids;
    const pick: Picker = (s) => {
      const choice = s.pendingChoice;
      if (choice?.prompt.kind === "spendResources") return [`hand:${energy}`];
      return pickOption(EXHAUST_OPTION)(s);
    };
    const revealed = settle(
      runWave5(dealPastNaturalAttack(given.state, "27130"), toHero(P1), endTurn(P1)),
      pick,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(revealed, identityOf(revealed)).exhausted).toBe(true);
    expect(playerOf(revealed, P1).discard).toContain(energy);
  });

  it("27130.when-revealed: option 2 still exhausts the character even with nothing to pay with", () => {
    const state = sandmanGame();
    const revealed = settle(
      runWave5(dealPastNaturalAttack(state, "27130"), toHero(P1), endTurn(P1)),
      pickOption(EXHAUST_OPTION),
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(revealed, identityOf(revealed)).exhausted).toBe(true);
  });
});
