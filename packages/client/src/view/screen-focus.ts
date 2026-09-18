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
  /** S8's quick-filter chip ids for the Scenario roster (e.g. `product:core`), between the search field and the rows. */
  readonly scenarioChipIds?: readonly string[];
  /** S8's quick-filter chip ids for the Heroes roster (e.g. `aspect:justice`, `source:precon`, `playable-now`), between the search field and the seats. */
  readonly heroChipIds?: readonly string[];
}

/**
 * The Title screen, top to bottom: Continue (when there is a game to pick up),
 * the scenario search field, its quick-filter chips, each scenario (or
 * "Clear" when the search matched none), each difficulty, the hero search
 * field, its quick-filter chips, each hero seat (or "Clear"), "Manage decks",
 * the seed field, New seed, and Start game.
 *
 * A hero that can't be seated (already at the table, or an unseatable deck)
 * still takes focus: its reason is read with `I`, the same rule that gives an
 * unusable action-bar button focus on the Board.
 */
export function titleFocusOrder(input: TitleFocusInput): readonly string[] {
  return [
    ...(input.continuable ? ["continue"] : []),
    "scenario-search",
    ...(input.scenarioChipIds ?? []).map((id) => `scenario-chip:${id}`),
    ...(input.scenarioIds.length > 0 ? input.scenarioIds.map((id) => `scenario:${id}`) : ["scenario-clear"]),
    ...input.difficulties.map((id) => `difficulty:${id}`),
    "hero-search",
    ...(input.heroChipIds ?? []).map((id) => `hero-chip:${id}`),
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
  /** Every deck row, in list order (group headers and the trailing "+ New deck" tile excluded — see `newDeck` below) — not just the ones currently on screen. `McVirtualList` scrolls a row into view when it takes focus, so a row off-screen is still a real stop. */
  readonly deckIds: readonly string[];
  /** S8's quick-filter chip ids (aspect, source, "Legal only"), between the search field and the list. */
  readonly chipIds: readonly string[];
  /** W9b/D14: every card in the *selected* deck's own browsable pool, in grid order — not just the ones currently on screen (same "off-screen is still a stop" rule as `deckIds`). Empty with no deck selected. */
  readonly poolCardIds: readonly string[];
  /** D14's own pool filter chips (the deck's aspect(s), Basic, Hero, Cost sort), between the pool header and its grid. */
  readonly poolChipIds: readonly string[];
  /**
   * W9b (docs/phase4-screen-gaps.md §3): wide three-pane layout reaches the list, the card pool, and the selected
   * deck's stats pane, all in one route; narrow single-column layout reaches only whichever of
   * "Decks"/"Cards"/"Stats" `activeTab` names — the same tab-scoped pattern `deckCheckFocusOrder` already uses for
   * its own tabs.
   */
  readonly wide: boolean;
  readonly activeTab: "decks" | "cards" | "stats";
  /** Whether a deck is currently selected — with none, the pool grid and the stats pane have nothing to act on and contribute no stops. */
  readonly hasSelection: boolean;
  /** Whether the *selected* deck can be edited/deleted (a saved deck, not a precon). */
  readonly editable: boolean;
  /** The quick-filter chip strip is collapsed behind a "Filters" toggle by default (2026-09-18 fidelity pass, point 2) — `chipIds` only contributes stops while this is true. */
  readonly filtersExpanded: boolean;
  /** The Import/Export box's own accordion: which field (if either) is open — `paste-field`/`paste-import` or `marvelcdb-field`/`marvelcdb-import` only contribute stops while their own button opened them. */
  readonly importOpen: "paste" | "marvelcdb" | null;
}

/**
 * The Decks screen (W9b, D14): Back, then — wide — the search field, the "Filters" toggle, its quick-filter chips
 * (only while expanded), every deck row, "+ New deck", the Import/Export box's Paste/MarvelCDB/Export buttons and
 * whichever of Paste's or MarvelCDB's own field+Import stops the accordion currently has open, then the card
 * pool's own filter chips and every pool card, then the selected deck's stats-pane actions (Check, Edit/Delete
 * when it's editable, Duplicate, Play this deck ▸). Narrow shows the same three groups behind a
 * "Decks"/"Cards"/"Stats" tab strip instead, one group at a time. Moving focus onto a deck row or a pool card
 * scrolls it into view (`scenes/decks.ts`'s `ensureVisible`), the same way a mouse would have to scroll to it first.
 */
export function decksFocusOrder(input: DecksFocusInput): readonly string[] {
  const listGroup = [
    "deck-search",
    "filters-toggle",
    ...(input.filtersExpanded ? input.chipIds.map((id) => `deck-chip:${id}`) : []),
    ...input.deckIds.map((id) => `deck:${id}`),
    "new-deck",
    "ie-paste-toggle",
    "ie-marvelcdb-toggle",
    "ie-export",
    ...(input.importOpen === "paste" ? ["paste-field", "paste-import"] : []),
    ...(input.importOpen === "marvelcdb" && input.showMarvelCdbImport ? ["marvelcdb-field", "marvelcdb-import"] : []),
  ];
  const poolGroup = input.hasSelection ? [...input.poolChipIds.map((id) => `pool-chip:${id}`), ...input.poolCardIds.map((id) => `pool-card:${id}`)] : [];
  const statsGroup = input.hasSelection
    ? ["stats-check", ...(input.editable ? ["stats-edit", "stats-delete"] : []), "stats-duplicate", "stats-play"]
    : [];
  if (input.wide) return ["back", ...listGroup, ...poolGroup, ...statsGroup];
  const tabs = ["tab:decks", "tab:cards", "tab:stats"];
  const activeGroup = input.activeTab === "decks" ? listGroup : input.activeTab === "cards" ? poolGroup : statsGroup;
  return ["back", ...tabs, ...activeGroup];
}

export interface DeckBuilderFocusInput {
  /** True once an identity is chosen and the full builder (name, aspects, pool) shows; false while only the identity picker does. */
  readonly identityChosen: boolean;
  readonly identityIds: readonly string[];
  readonly aspectIds: readonly string[];
  /** W1's type filter chips ("All, Ally, Event, Upgrade, Support, Resource"), by `PoolFilter.type` value (`"all"` for the null/no-filter case). */
  readonly typeFilterIds: readonly string[];
  /** Every pool card in filter order — not just the ones currently on screen (see `DecksFocusInput.deckIds`). */
  readonly poolCardIds: readonly string[];
}

/**
 * The deck builder: Back first, then either the identity picker alone, or —
 * once an identity is chosen — the aspect picker, the type filter chips
 * (W1), the name field, Preconstructed and Clear (W1 — always a stop, even
 * when Preconstructed has nothing to reset to and is drawn unavailable, the
 * same "dim, don't hide" rule every disabled control follows), Save, the
 * pool search field, and every pool row (each row both adds and removes, one
 * stop each).
 */
export function deckBuilderFocusOrder(input: DeckBuilderFocusInput): readonly string[] {
  if (!input.identityChosen) return ["back", ...input.identityIds.map((id) => `identity:${id}`)];
  return [
    "back",
    ...input.aspectIds.map((id) => `aspect:${id}`),
    ...input.typeFilterIds.map((id) => `type:${id}`),
    "name",
    "preconstructed",
    "clear",
    "save",
    "filter-text",
    ...input.poolCardIds.map((id) => `card:${id}`),
  ];
}

export interface DeckCheckFocusInput {
  /** Which of the three tabs is showing — only that tab's own content stops appear (`cardIds` below). */
  readonly activeTab: "curve" | "cards" | "aspect";
  /** Every row in the Cards tab's deck list, in list order — only relevant (and only present) while that tab is active. */
  readonly cardIds: readonly string[];
}

/**
 * Deck check (W1): Back, the three tabs, the active tab's own rows (today
 * only the Cards tab has any — Curve and Aspect are read-only panels), Edit
 * deck, then Start game — drawn unavailable with its reason until W2 wires a
 * setup flow to hand the finished game off to, but still a real stop so that
 * reason can be read (the "dashed = not yet real" rule, docs/phase4-screen-gaps.md §0).
 */
export function deckCheckFocusOrder(input: DeckCheckFocusInput): readonly string[] {
  return [
    "back",
    "tab:curve",
    "tab:cards",
    "tab:aspect",
    ...(input.activeTab === "cards" ? input.cardIds.map((id) => `card:${id}`) : []),
    "edit-deck",
    "start",
  ];
}

/**
 * The villain-phase walkthrough: Continue first once the phase has finished,
 * because it is what the player is there to press. When the inline interrupt
 * window (D11/P09/L02) is open, its "Play <card>" buttons and "Let it
 * resolve" come right after — the decision the player is actually there to
 * make — ahead of Skip, which never coexists with "finished" (a paused phase
 * hasn't finished).
 */
export function villainPhaseFocusOrder(finished: boolean, interruptOptionIds: readonly string[] = []): readonly string[] {
  return [
    ...(finished ? ["continue"] : []),
    ...interruptOptionIds.map((id) => `interrupt:${id}`),
    ...(interruptOptionIds.length > 0 ? ["resolve"] : []),
    "skip",
  ];
}

/**
 * Pause (docs/phase4-screen-gaps.md §3 "W4"; fidelity pass 2026-09-17, matching
 * D13/P16/L07's overlay sheet): the boxed ✕ first (top of the title bar, reads
 * before anything else), then the search field, the "Quick reference" rows
 * (Villain phase order / Keyword glossary / Scenario card list / Jump into the
 * log — the last dashed-unavailable until S7's read-only board lands), then the
 * "Table" rows (the same shared list `scenes/settings.ts` draws), then the
 * footer's three buttons in the order the sheet draws them left to right —
 * Save & quit, Concede, Resume. When the concede confirm is open, its own two
 * controls replace those three so Enter can't fire Resume or a stray Concede
 * tap by accident mid-confirm.
 */
export function pauseFocusOrder(input: {
  readonly quickReferenceIds: readonly string[];
  readonly tableRowIds: readonly string[];
  readonly confirmingConcede: boolean;
}): readonly string[] {
  return [
    "close",
    "search",
    ...input.quickReferenceIds.map((id) => `quick:${id}`),
    ...input.tableRowIds.map((id) => `table:${id}`),
    ...(input.confirmingConcede ? ["concede-confirm-yes", "concede-confirm-cancel"] : ["save-quit", "concede", "resume"]),
  ];
}

/**
 * Rules Reference (full-screen redesign, owner feedback 2026-09-18): Back, the scope
 * toggle ("All rules" / "On your table" — only a stop with a live game to scope against,
 * `showScopeToggle`), the three tabs, then the glossary's search field (glossary tab
 * only), then whatever rows the active tab is showing — the glossary's own entry (and
 * card-thumbnail) stops, the villain phase's step stops, or the card list's per-card
 * stops, whichever tab `rowIds` was built for.
 */
export function rulesFocusOrder(input: {
  readonly tabIds: readonly string[];
  readonly showScopeToggle: boolean;
  readonly showSearch: boolean;
  readonly rowIds: readonly string[];
}): readonly string[] {
  return [
    "back",
    ...(input.showScopeToggle ? ["scope:table", "scope:all"] : []),
    ...input.tabIds.map((id) => `tab:${id}`),
    ...(input.showSearch ? ["search"] : []),
    ...input.rowIds.map((id) => `row:${id}`),
  ];
}

/** Settings: Back, then one stop per toggle row, in the order they're drawn. */
export function settingsFocusOrder(rowIds: readonly string[]): readonly string[] {
  return ["back", ...rowIds.map((id) => `row:${id}`)];
}

/**
 * The Title menu (docs/phase4-screen-gaps.md §3 W2, D01): Continue (when
 * there's a game to pick up), New game, Decks & Collection, Campaign
 * (drawn locked) and Settings (drawn unavailable until W4 lands it) — both
 * still take focus so their reason reads with `I`, the same rule
 * `titleFocusOrder` already applies to a blocked hero seat.
 */
export function titleMenuFocusOrder(input: { readonly continuable: boolean }): readonly string[] {
  return [...(input.continuable ? ["continue"] : []), "new-game", "decks", "campaign", "settings"];
}

export interface ScenarioSelectFocusInput {
  /**
   * Every scenario card, in the pack-shelf roster's own reading order (shelf by shelf, left to right within a
   * shelf — `view/roster-shelves.ts`'s `flattenShelves`); already filtered by the search field and product chips
   * (S8). Empty means the search matched nothing. `view/shelf-nav.ts`'s own doc comment explains why this stays a
   * flat route rather than a real 2-axis one this pass.
   */
  readonly scenarioIds: readonly string[];
  readonly scenarioChipIds?: readonly string[];
}

/** Scenario select (D02): Back, the search field, its quick-filter chips, each scenario card (or "Clear"), then "Choose heroes ▸". */
export function scenarioSelectFocusOrder(input: ScenarioSelectFocusInput): readonly string[] {
  return [
    "back",
    "scenario-search",
    ...(input.scenarioChipIds ?? []).map((id) => `scenario-chip:${id}`),
    ...(input.scenarioIds.length > 0 ? input.scenarioIds.map((id) => `scenario:${id}`) : ["scenario-clear"]),
    "next",
  ];
}

export interface SeatsFocusInput {
  /** How many seat cards to route focus through — always `MAX_SEATS` (`view/seats-layout.ts`), listed for clarity at the call site rather than hardcoded here. */
  readonly seatCount: number;
  /** Every seat option's deck id, in the pack-shelf roster's own reading order (`flattenShelves`) — still keyed `hero:<deckId>`, matching `titleFocusOrder`'s own convention. */
  readonly deckIds: readonly string[];
  readonly heroChipIds?: readonly string[];
}

/**
 * Take your seats (D03): Back, each seat card (clicking/activating one makes it active,
 * docs/phase4-screen-gaps.md §3 W2b), "Use preconstructed for all seats", the search field, its chips, each
 * roster card (or "Clear"), then "Play N heroes ▸" / "Deck check ▸".
 */
export function seatsFocusOrder(input: SeatsFocusInput): readonly string[] {
  return [
    "back",
    ...Array.from({ length: input.seatCount }, (_, i) => `seat:${i}`),
    "use-preconstructed",
    "hero-search",
    ...(input.heroChipIds ?? []).map((id) => `hero-chip:${id}`),
    ...(input.deckIds.length > 0 ? input.deckIds.map((id) => `hero:${id}`) : ["hero-clear"]),
    "play",
    "deck-check",
  ];
}

export interface TableSetupFocusInput {
  readonly difficulties: readonly string[];
  /** Every modular set candidate's own id (`view/modular-sets.ts`'s `modularSetCandidateIdsFor`) — empty for a scenario that uses none (Breakout). */
  readonly modularSetIds: readonly string[];
  /** One stop per seat index plus "Random" (`view/seed.ts`'s `rollFirstPlayerIndex`). */
  readonly firstPlayerOptionIds: readonly string[];
}

/** Table setup (D05): Back, difficulty, the modular set picker, seating/first player, the seed field, Reroll, then "Deal it out". */
export function tableSetupFocusOrder(input: TableSetupFocusInput): readonly string[] {
  return [
    "back",
    ...input.difficulties.map((id) => `difficulty:${id}`),
    ...input.modularSetIds.map((id) => `modular:${id}`),
    ...input.firstPlayerOptionIds.map((id) => `first-player:${id}`),
    "seed",
    "reroll",
    "deal-it-out",
  ];
}

export interface SetupWalkthroughFocusInput {
  /**
   * The deciding seat's own hand, already in display order
   * (`view/choice-focus.ts`'s `cardChoiceDisplayOrder`, the same one the
   * generic sheet walks) — empty while no seat's mulligan is the open choice
   * (a different decision during setup has the choice instead, and the
   * generic `ChoiceOverlay` owns focus for that one).
   */
  readonly optionIds: readonly string[];
}

/**
 * Setup deal & mulligan (W3, docs/phase4-screen-gaps.md §3 — D06, P13, L05):
 * the deciding seat's own hand, then "Mulligan" then "Keep all". Unlike the
 * generic sheet's `choiceFocusOrder` — which only adds a "decline" stop when
 * `PendingChoice.minSelections` allows it — a mulligan's `minSelections` is
 * always 0 (RRG 1.8 Appendix II step 15: "discard any number of cards,
 * including none"), so "Keep all" is always legal and always its own stop.
 */
export function setupWalkthroughFocusOrder(input: SetupWalkthroughFocusInput): readonly string[] {
  return [...input.optionIds.map((id) => `option:${id}`), "confirm", "decline"];
}
