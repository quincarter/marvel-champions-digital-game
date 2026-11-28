/**
 * Where Take your seats leads: the clash check, Deck check and Table setup (docs/phase4-screen-gaps.md section 3, second
 * W2b pass item 1: "Deck check" opens the *active* seat's own deck, and reaches Table setup only when the table has no
 * seated deck at all, which `pruneSeats`' own fallback never allows, so it is kept as a fallback rather than assumed
 * unreachable).
 */
import type Phaser from "phaser";
import type { Deck } from "@mc/content";
import { currentCardsById } from "../../content/pool.js";
import { appSession } from "../../session.js";
import { tableRulesOf } from "../../settings.js";
import { goToScreen } from "../../ui/transitions.js";
import type { DeckOption } from "../../view/deck-list-model.js";
import { applyDeckSwaps, nameConflictsOf, unresolvedConflicts, type NameConflict } from "../../view/name-conflicts.js";
import { deckCheckDeckId, type SetupDraft } from "../../view/setup-draft.js";
import type { DeckCheckSceneData } from "../deck-check.js";
import { SCENES } from "../keys.js";
import type { CivilWarBuilderData } from "../civil-war-builder.js";
import type { ScenarioSelectData } from "../scenario-select.js";
import type { TableSetupData } from "../table-setup.js";
import type { SeatsData } from "../seats.js";

/** The seated decks with this game's replacements applied, in seat order (a seat whose deck has gone is skipped). */
export function seatedDecksOf(
  draft: SetupDraft,
  deckOptions: readonly DeckOption[],
  swapped: boolean,
): readonly Deck[] {
  return draft.seats
    .map((deckId) => deckOptions.find((option) => (option.deck.id as string) === deckId)?.deck)
    .filter((deck): deck is Deck => deck !== undefined)
    .map((deck) => (swapped ? applyDeckSwaps(deck, draft.deckSwaps) : deck));
}

/** Every card that cannot be played at this table and has not been answered (replaced or kept as a resource). */
export function unresolvedConflictsOf(draft: SetupDraft, deckOptions: readonly DeckOption[]): readonly NameConflict[] {
  const seats = seatedDecksOf(draft, deckOptions, true).map((deck) => ({ deck }));
  return unresolvedConflicts(
    nameConflictsOf(seats, currentCardsById(), tableRulesOf(appSession().settings)),
    draft.keptConflicts,
  );
}

/** Deck check over the active seat's deck; Start game there continues to Table setup (or back here with a clash open). */
export function goToDeckCheckOrTableSetup(
  scene: Phaser.Scene,
  draft: SetupDraft,
  deckOptions: readonly DeckOption[],
): void {
  const toTableSetup = (from: Phaser.Scene): void => {
    // A clash still open sends the player back to the seats, where the sheet answers it before the table is dealt.
    if (unresolvedConflictsOf(draft, deckOptions).length > 0) {
      goToScreen(from, SCENES.seats, { draft, promptConflicts: true } satisfies SeatsData);
      return;
    }
    goToScreen(from, SCENES.setup, { draft } satisfies TableSetupData);
  };
  const checkedDeckId = deckCheckDeckId(draft);
  const seated = checkedDeckId ? deckOptions.find((option) => (option.deck.id as string) === checkedDeckId) : undefined;
  if (!seated) {
    toTableSetup(scene);
    return;
  }
  goToScreen(scene, SCENES.deckCheck, {
    deck: seated.deck,
    returnTo: { scene: SCENES.seats, data: { draft } satisfies SeatsData },
    onStartGame: toTableSetup,
  } satisfies DeckCheckSceneData);
}

/** On to Table setup with the table as drafted. */
export function goToTableSetup(scene: Phaser.Scene, draft: SetupDraft): void {
  goToScreen(scene, SCENES.setup, { draft } satisfies TableSetupData);
}

/** Back to Scenario select, or the Civil War builder the draft came from. The seated saved decks go along, so coming back keeps them seated before the deck list loads (#958). */
export function goBack(
  scene: Phaser.Scene,
  draft: SetupDraft,
  savedDecks: readonly Deck[],
  backTo: SeatsData["backTo"] | null,
): void {
  const seated = new Set(draft.seats);
  const seeds = savedDecks.filter((deck) => seated.has(deck.id as string));
  const seedDecks = seeds.length > 0 ? { seedDecks: seeds } : {};
  if (backTo === "civil-war-builder") {
    goToScreen(scene, SCENES.civilWarBuilder, { draft, step: 5, ...seedDecks } satisfies CivilWarBuilderData);
    return;
  }
  goToScreen(scene, SCENES.scenarioSelect, { draft, ...seedDecks } satisfies ScenarioSelectData);
}
