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
  /** Every scenario row, in roster order — already filtered by the search field (docs/phase4-screen-gaps.md §2 "S8"); empty means the search matched nothing. */
  readonly scenarioIds: readonly string[];
  readonly difficulties: readonly string[];
  /** Breakout's per-villain A/B override row (PLAN.md Phase 7 wave 1), shown only for a multi-villain scenario at standard/expert. */
  readonly villainVersionIds?: readonly string[];
  /**
   * Every seat option's deck id, precons and saved decks alike (PLAN.md
   * Phase 9, "seats become any legal deck"; S8's search), already filtered by
   * the hero search field — still keyed `hero:<deckId>`, since the control
   * each one takes focus on is still one hero seat row. The Heroes list is a
   * `McVirtualList` (wave 1 more than doubles the precon count), so a seat
   * off-screen still gets a stop; it scrolls into view when it takes focus.
   */
  readonly deckIds: readonly string[];
  /** The link to the Decks screen (PLAN.md Phase 9) — see `scenes/decks.ts`. Optional only so `titleFocusOrder`'s existing callers/tests don't have to name it. */
  readonly manageDecks?: boolean;
}

/**
 * The Title screen, top to bottom: Continue (when there is a game to pick up),
 * the scenario search field, each scenario (or "Clear" when the search
 * matched none), each difficulty, Breakout's villain-version row when it
 * applies, the hero search field, each hero seat (or "Clear"), "Manage
 * decks", the seed field, New seed, and Start game.
 *
 * A hero that can't be seated (already at the table, or an unseatable deck)
 * still takes focus: its reason is read with `I`, the same rule that gives an
 * unusable action-bar button focus on the Board.
 */
export function titleFocusOrder(input: TitleFocusInput): readonly string[] {
  return [
    ...(input.continuable ? ["continue"] : []),
    "scenario-search",
    ...(input.scenarioIds.length > 0 ? input.scenarioIds.map((id) => `scenario:${id}`) : ["scenario-clear"]),
    ...input.difficulties.map((id) => `difficulty:${id}`),
    ...(input.villainVersionIds ?? []).map((id) => `villain-version:${id}`),
    "hero-search",
    ...(input.deckIds.length > 0 ? input.deckIds.map((id) => `hero:${id}`) : ["hero-clear"]),
    ...(input.manageDecks ? ["manage-decks"] : []),
    "seed",
    "new-seed",
    "start",
  ];
}

export interface DecksFocusInput {
  /** Import by MarvelCDB URL/id is dev/preview-only (PLAN.md Phase 9); paste always shows. */
  readonly showMarvelCdbImport: boolean;
  /** Every deck row, in list order — not just the ones currently on screen. `McVirtualList` scrolls a row into view when it takes focus, so a row off-screen is still a real stop. */
  readonly deckIds: readonly string[];
  /** A row whose deck can be edited/deleted (a saved deck) gets those two extra stops; a precon's row does not. */
  readonly editableDeckIds: ReadonlySet<string>;
}

/**
 * The Decks screen: Back, the paste importer, the MarvelCDB importer (dev
 * only), New deck, then every deck row (and its Edit/Delete when it has
 * them) — the whole list, not only whatever the virtualized panel currently
 * draws. Moving focus onto a row scrolls it into view (`scenes/decks.ts`'s
 * `ensureVisible`), the same way a mouse would have to scroll to it first.
 */
export function decksFocusOrder(input: DecksFocusInput): readonly string[] {
  return [
    "back",
    "paste-field",
    "paste-import",
    ...(input.showMarvelCdbImport ? ["marvelcdb-field", "marvelcdb-import"] : []),
    "new-deck",
    ...input.deckIds.flatMap((id) =>
      input.editableDeckIds.has(id) ? [`deck:${id}`, `deck:${id}:edit`, `deck:${id}:delete`] : [`deck:${id}`],
    ),
  ];
}

export interface DeckBuilderFocusInput {
  /** True once an identity is chosen and the full builder (name, aspects, pool) shows; false while only the identity picker does. */
  readonly identityChosen: boolean;
  readonly identityIds: readonly string[];
  readonly aspectIds: readonly string[];
  /** Every pool card in filter order — not just the ones currently on screen (see `DecksFocusInput.deckIds`). */
  readonly poolCardIds: readonly string[];
}

/**
 * The deck builder: Back first, then either the identity picker alone, or —
 * once an identity is chosen — the aspect picker, the name field, and every
 * pool row (each row both adds and removes, one stop each), then Save.
 */
export function deckBuilderFocusOrder(input: DeckBuilderFocusInput): readonly string[] {
  if (!input.identityChosen) return ["back", ...input.identityIds.map((id) => `identity:${id}`)];
  return [
    "back",
    ...input.aspectIds.map((id) => `aspect:${id}`),
    "name",
    "filter-text",
    ...input.poolCardIds.map((id) => `card:${id}`),
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
