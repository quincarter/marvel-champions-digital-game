/**
 * Guided mode before the game: a coach step for each setup screen (Scenario select, Take your seats, Table setup,
 * the deal and mulligan), plus the seat-count warning.
 *
 * **The seat warning is numbers, not a scare.** Every extra seat scales the villain's hit points and the main
 * scheme's threat by the printed per-player icon (RRG 1.8 "Per Player Icon", p. 32), adds another obligation to
 * the encounter deck, deals one more encounter card each villain phase, and gives the villain one more activation.
 * Here every seat is played by you, so more seats is more to keep track of, not a free extra hero. The numbers come
 * from the same `scale` Table setup's "the game you'll get" uses (`view/table-setup-preview.ts`).
 */
import type { AnyCard, Scenario } from "@mc/content";
import { scale } from "@mc/engine";
import type { SetupDifficulty } from "../setup-draft.js";
import { villainTotalHp } from "../table-setup-preview.js";

export type SetupScreen = "scenarioSelect" | "seats" | "tableSetup" | "setupDeal";

export interface SetupGuideStep {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  /** A warning to draw beneath the body in the caution colour, when there is one. */
  readonly warning: string | null;
}

/** The villain-side numbers for one seat count. */
export interface SeatScaling {
  readonly players: number;
  readonly villainHp: number;
  readonly schemeTarget: number;
}

export function seatScalingOf(
  scenario: Scenario,
  difficulty: SetupDifficulty,
  cardsById: ReadonlyMap<string, AnyCard>,
  players: number,
): SeatScaling | null {
  const scheme = cardsById.get(scenario.mainSchemeCardId as string);
  if (!scheme || scheme.type !== "main_scheme") return null;
  const stage = scheme.stages[0];
  if (!stage) return null;
  return {
    players,
    villainHp: villainTotalHp(scenario, difficulty, cardsById, players),
    schemeTarget: scale(stage.targetThreat, players),
  };
}

/**
 * "With 2 heroes, …": null for a single seat, where there's nothing to warn about. `villainName` is the display
 * name setup screens already use (`ScenarioDetail.displayName`).
 */
export function seatWarningOf(
  scenario: Scenario,
  difficulty: SetupDifficulty,
  cardsById: ReadonlyMap<string, AnyCard>,
  seats: number,
  villainName: string,
): string | null {
  if (seats <= 1) return null;
  const solo = seatScalingOf(scenario, difficulty, cardsById, 1);
  const now = seatScalingOf(scenario, difficulty, cardsById, seats);
  if (!solo || !now) return null;
  return (
    `With ${seats} heroes, ${villainName} has ${now.villainHp} hit points in all (${solo.villainHp} solo) and the ` +
    `scheme needs ${now.schemeTarget} threat (${solo.schemeTarget} solo). Each villain phase deals at least ` +
    `${seats} encounter cards and the villain activates ${seats} times. You play every seat yourself.`
  );
}

export interface SetupGuideContext {
  /** Seats filled so far (Take your seats). */
  readonly seats?: number;
  /** The seat warning for the current draft, from `seatWarningOf`. */
  readonly seatWarning?: string | null;
}

export function setupGuideStep(screen: SetupScreen, context: SetupGuideContext = {}): SetupGuideStep {
  switch (screen) {
    case "scenarioSelect":
      return {
        id: "setup:scenarioSelect",
        title: "Pick a villain",
        body:
          "Each scenario is a villain, their main scheme and an encounter deck of their cards. The panel shows " +
          "the villain's hit points per stage and the scheme's threat. New to the game? Rhino, in the Core Set, " +
          "is the classic first fight.",
        warning: null,
      };
    case "seats": {
      const seats = context.seats ?? 1;
      return {
        id: "setup:seats",
        title: "Choose your heroes",
        body:
          "Each seat is one hero with their own deck, and you play them all. Pick a seat, then a hero for it. " +
          "The preconstructed deck is ready to play. For a first game, one hero is the easiest table to learn on." +
          (seats > 1 ? "" : " Adding a seat makes the villain tougher, too."),
        warning: context.seatWarning ?? null,
      };
    }
    case "tableSetup":
      return {
        id: "setup:tableSetup",
        title: "Set the table",
        body:
          "Standard is the difficulty to start with; Expert adds harder cards and a tougher villain stage. The " +
          "modular set is a small group of extra encounter cards shuffled in: the recommended one is already " +
          "chosen. When you're ready, Deal it out.",
        warning: context.seatWarning ?? null,
      };
    case "setupDeal":
      return {
        id: "setup:setupDeal",
        title: "Your opening hand",
        body:
          "Before round 1 you get one mulligan: discard any cards you don't want and draw back up to your hand " +
          "size. Look for cards you can afford early, like allies and upgrades. Keep them all if you like the hand.",
        warning: null,
      };
  }
}
