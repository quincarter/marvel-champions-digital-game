/**
 * Focus routes for the screens around the table: Title/Setup, the villain-phase
 * walkthrough and Game Over.
 *
 * Same principle as the Board's route (`focus.ts`) and the choice sheet's
 * (`choice-focus.ts`): a canvas has no tab order, so the order is stated here,
 * as data, rather than falling out of whatever order a scene's draw calls run in.
 * A stop is a string key; the scene maps each key to the control it drew.
 */

export interface TitleFocusInput {
  /** A saved game is offered as "Continue". */
  readonly continuable: boolean;
  readonly scenarioIds: readonly string[];
  readonly difficulties: readonly string[];
  readonly deckIds: readonly string[];
}

/**
 * The Title screen, top to bottom: Continue (when there is a game to pick up),
 * each scenario, each difficulty, each hero seat, the seed field, New seed, and
 * Start game.
 *
 * A hero that can't be seated (already at the table) still takes focus: its
 * reason is read with `I`, the same rule that gives an unusable action-bar
 * button focus on the Board.
 */
export function titleFocusOrder(input: TitleFocusInput): readonly string[] {
  return [
    ...(input.continuable ? ["continue"] : []),
    ...input.scenarioIds.map((id) => `scenario:${id}`),
    ...input.difficulties.map((id) => `difficulty:${id}`),
    ...input.deckIds.map((id) => `hero:${id}`),
    "seed",
    "new-seed",
    "start",
  ];
}

/**
 * The villain-phase walkthrough: Continue first once the phase has finished,
 * because it is what the player is there to press, then Skip.
 */
export function villainPhaseFocusOrder(finished: boolean): readonly string[] {
  return [...(finished ? ["continue"] : []), "skip"];
}
