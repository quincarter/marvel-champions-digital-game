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
  /**
   * Every seat option's deck id, precons and saved decks alike (PLAN.md
   * Phase 9, "seats become any legal deck") — still keyed `hero:<deckId>`,
   * since the control each one takes focus on is still one hero seat tile.
   */
  readonly deckIds: readonly string[];
  /** The link to the Decks screen (PLAN.md Phase 9) — see `scenes/decks.ts`. Optional only so `titleFocusOrder`'s existing callers/tests don't have to name it. */
  readonly manageDecks?: boolean;
}

/**
 * The Title screen, top to bottom: Continue (when there is a game to pick up),
 * each scenario, each difficulty, each hero seat, "Manage decks", the seed
 * field, New seed, and Start game.
 *
 * A hero that can't be seated (already at the table, or an unseatable deck)
 * still takes focus: its reason is read with `I`, the same rule that gives an
 * unusable action-bar button focus on the Board.
 */
export function titleFocusOrder(input: TitleFocusInput): readonly string[] {
  return [
    ...(input.continuable ? ["continue"] : []),
    ...input.scenarioIds.map((id) => `scenario:${id}`),
    ...input.difficulties.map((id) => `difficulty:${id}`),
    ...input.deckIds.map((id) => `hero:${id}`),
    ...(input.manageDecks ? ["manage-decks"] : []),
    "seed",
    "new-seed",
    "start",
  ];
}

export interface DecksFocusInput {
  /** Import by MarvelCDB URL/id is dev/preview-only (PLAN.md Phase 9); paste always shows. */
  readonly showMarvelCdbImport: boolean;
  /** Deck rows currently on screen (the virtualized list's visible window), in order. */
  readonly visibleDeckIds: readonly string[];
  /** A row whose deck can be edited/deleted (a saved deck) gets those two extra stops; a precon's row does not. */
  readonly editableDeckIds: ReadonlySet<string>;
  /** The list can be scrolled further in that direction. */
  readonly canScrollUp: boolean;
  readonly canScrollDown: boolean;
}

/**
 * The Decks screen: Back, the paste importer, the MarvelCDB importer (dev
 * only), New deck, a scroll-up stepper when the list is scrolled down, each
 * visible deck row (and its Edit/Delete when it has them), then scroll-down.
 *
 * Only the *visible* rows of the virtualized deck list ever take a stop —
 * exactly the rows that have a live control to focus (`view/list-scroll.ts`);
 * the scroll steppers are how a keyboard/pad user reaches the rest, the same
 * job the log's "newer" chip does for the game log.
 */
export function decksFocusOrder(input: DecksFocusInput): readonly string[] {
  return [
    "back",
    "paste-field",
    "paste-import",
    ...(input.showMarvelCdbImport ? ["marvelcdb-field", "marvelcdb-import"] : []),
    "new-deck",
    ...(input.canScrollUp ? ["scroll-up"] : []),
    ...input.visibleDeckIds.flatMap((id) =>
      input.editableDeckIds.has(id) ? [`deck:${id}`, `deck:${id}:edit`, `deck:${id}:delete`] : [`deck:${id}`],
    ),
    ...(input.canScrollDown ? ["scroll-down"] : []),
  ];
}

export interface DeckBuilderFocusInput {
  /** True once an identity is chosen and the full builder (name, aspects, pool) shows; false while only the identity picker does. */
  readonly identityChosen: boolean;
  readonly identityIds: readonly string[];
  readonly aspectIds: readonly string[];
  readonly visiblePoolCardIds: readonly string[];
  readonly canScrollUp: boolean;
  readonly canScrollDown: boolean;
}

/**
 * The deck builder: Back first, then either the identity picker alone, or —
 * once an identity is chosen — the aspect picker, the name field, and the
 * pool browser's visible rows (each row both adds and removes, one stop each,
 * the same "only visible rows take a stop" rule `decksFocusOrder` uses), then
 * Save.
 */
export function deckBuilderFocusOrder(input: DeckBuilderFocusInput): readonly string[] {
  if (!input.identityChosen) return ["back", ...input.identityIds.map((id) => `identity:${id}`)];
  return [
    "back",
    ...input.aspectIds.map((id) => `aspect:${id}`),
    "name",
    "filter-text",
    ...(input.canScrollUp ? ["scroll-up"] : []),
    ...input.visiblePoolCardIds.map((id) => `card:${id}`),
    ...(input.canScrollDown ? ["scroll-down"] : []),
    "save",
  ];
}

/**
 * The villain-phase walkthrough: Continue first once the phase has finished,
 * because it is what the player is there to press, then Skip.
 */
export function villainPhaseFocusOrder(finished: boolean): readonly string[] {
  return [...(finished ? ["continue"] : []), "skip"];
}
