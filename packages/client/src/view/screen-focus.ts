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
  /** Every deck row, in list order (headers excluded — they aren't stops) — not just the ones currently on screen. `McVirtualList` scrolls a row into view when it takes focus, so a row off-screen is still a real stop. */
  readonly deckIds: readonly string[];
  /** S8's quick-filter chip ids (aspect, source, "Legal only"), between the search field and the list. */
  readonly chipIds: readonly string[];
  /**
   * W9 (docs/phase4-screen-gaps.md §3): wide two-pane layout reaches the list and the selected deck's stats pane
   * both, in one route; narrow single-column layout reaches only whichever of "Decks"/"Stats" `activeTab` names —
   * the same tab-scoped pattern `deckCheckFocusOrder` already uses for its own tabs.
   */
  readonly wide: boolean;
  readonly activeTab: "decks" | "stats";
  /** Whether a deck is currently selected — with none, the stats pane has no deck to act on and contributes no stops. */
  readonly hasSelection: boolean;
  /** Whether the *selected* deck can be edited/deleted (a saved deck, not a precon). */
  readonly editable: boolean;
}

/**
 * The Decks screen: Back, then — wide — the search field, its quick-filter chips, every deck row, the paste
 * importer, the MarvelCDB importer (dev only) and New deck, followed by the selected deck's stats-pane actions
 * (Check, Duplicate, Export, Edit/Delete when it's editable, Play this deck ▸); narrow shows the same two groups
 * behind a "Decks"/"Stats" tab strip instead, one group at a time. Moving focus onto a deck row scrolls it into
 * view (`scenes/decks.ts`'s `ensureVisible`), the same way a mouse would have to scroll to it first.
 */
export function decksFocusOrder(input: DecksFocusInput): readonly string[] {
  const listGroup = [
    "deck-search",
    ...input.chipIds.map((id) => `deck-chip:${id}`),
    ...input.deckIds.map((id) => `deck:${id}`),
    "paste-field",
    "paste-import",
    ...(input.showMarvelCdbImport ? ["marvelcdb-field", "marvelcdb-import"] : []),
    "new-deck",
  ];
  const statsGroup = input.hasSelection
    ? ["stats-check", "stats-duplicate", "stats-export", ...(input.editable ? ["stats-edit", "stats-delete"] : []), "stats-play"]
    : [];
  if (input.wide) return ["back", ...listGroup, ...statsGroup];
  return ["back", "tab:decks", "tab:stats", ...(input.activeTab === "decks" ? listGroup : statsGroup)];
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
 * Pause (docs/phase4-screen-gaps.md §3 "W4"): Resume first (the control a
 * player pressing Escape almost always wants), then Save & quit, Rules
 * reference, Settings, then every visible "jump to a moment" row (empty until
 * S7's read-only board lands — see `scenes/pause.ts`), then Concede last. When
 * the concede confirm is open, its own two controls replace the single
 * Concede stop so Enter can't fire the real button by accident mid-confirm.
 */
export function pauseFocusOrder(input: { readonly momentIds: readonly string[]; readonly confirmingConcede: boolean }): readonly string[] {
  return [
    "resume",
    "save-quit",
    "rules",
    "settings",
    ...input.momentIds.map((id) => `moment:${id}`),
    ...(input.confirmingConcede ? ["concede-confirm-yes", "concede-confirm-cancel"] : ["concede"]),
  ];
}

/**
 * Rules Reference: the three tabs, then the glossary's search field (glossary
 * tab only), then whatever rows the active tab is showing.
 */
export function rulesFocusOrder(input: { readonly tabIds: readonly string[]; readonly showSearch: boolean; readonly rowIds: readonly string[] }): readonly string[] {
  return ["back", ...input.tabIds.map((id) => `tab:${id}`), ...(input.showSearch ? ["search"] : []), ...input.rowIds.map((id) => `row:${id}`)];
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
  /** Every scenario row, in roster order — already filtered by the search field (S8); empty means the search matched nothing. */
  readonly scenarioIds: readonly string[];
  readonly scenarioChipIds?: readonly string[];
}

/** Scenario select (D02): Back, the search field, its quick-filter chips, each scenario row (or "Clear"), then "Choose heroes ▸". */
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
  /** Every seat option's deck id, already filtered by the hero search field (S8) — still keyed `hero:<deckId>`, matching `titleFocusOrder`'s own convention. */
  readonly deckIds: readonly string[];
  readonly heroChipIds?: readonly string[];
}

/** Take your seats (D03): Back, "Use preconstructed for all seats", the search field, its chips, each roster row (or "Clear"), "Deck check ▸", then "Take these seats ▸". */
export function seatsFocusOrder(input: SeatsFocusInput): readonly string[] {
  return [
    "back",
    "use-preconstructed",
    "hero-search",
    ...(input.heroChipIds ?? []).map((id) => `hero-chip:${id}`),
    ...(input.deckIds.length > 0 ? input.deckIds.map((id) => `hero:${id}`) : ["hero-clear"]),
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
