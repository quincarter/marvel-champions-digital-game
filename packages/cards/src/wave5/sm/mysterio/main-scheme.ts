import {
  chosen,
  dealAsEncounterCard,
  defineAbilities,
  draw,
  eachPlayer,
  encounterCards,
  eventPlayer,
  eventTarget,
  forEachPlayer,
  forcedInterrupt,
  moveCardsInto,
  on,
  oneCopyOf,
  putIntoPlay,
  selectCards,
  setup,
  shuffleEncounterDeck,
  thatPlayer,
  whenRevealed,
} from "../../../dsl/index.js";

/**
 * Maze of Mirrors → Edge of Reality (`sm` 27087a/b, 27088a/b, docs/phase7-wave5.md §2.2/§3.5): 1A's Setup, both
 * stages' shared Forced Interrupt, and 2A's own When Revealed. Edge of Reality's own "If this stage is completed,
 * the players lose the game" is data (`completionLoses`).
 */
const encounterCardInsteadOfDrawOrDiscard = () =>
  forcedInterrupt(
    on.encounterCardFromPlayerDeck(),
    dealAsEncounterCard(eventTarget, eventPlayer),
    draw(1, eventPlayer),
  );

export const MAZE_OF_MIRRORS = defineAbilities({
  // 1A (27087a) — Setup: Put a Shifting Apparition minion into play engaged with each player (found in the encounter
  // deck, RRG 1.8 "Find", p. 19 — a fresh copy per player, `wave1/gob/mutagen-formula.ts`'s "Goblin Thrall"
  // precedent). `oneCopyOf` re-reads the deck fresh each iteration, so each player's own copy is a card still in the
  // deck when their turn of the loop runs (`venom/main-scheme.ts`'s "Tooth and Nail" precedent for the selector
  // itself). Shuffle the encounter deck.
  "27087a.setup": setup(
    forEachPlayer(
      eachPlayer,
      selectCards("apparition", oneCopyOf(encounterCards(["deck"], { name: "Shifting Apparition" }))),
      putIntoPlay(chosen("apparition"), thatPlayer),
    ),
    shuffleEncounterDeck(),
  ),
  // 1B (27087b) — Forced Interrupt: When you would draw or discard an encounter card from your deck, deal it to
  // yourself as a facedown encounter card, then draw 1 card (docs/phase7-wave5.md §3.5's own worked example,
  // `wave5-primitives.test.ts`).
  "27087b.maze-of-mirrors-forced-interrupt": encounterCardInsteadOfDrawOrDiscard(),

  // 2A (27088a, "Edge of Reality") — When Revealed: in player order, shuffle the top 2 cards of the encounter deck
  // into each player's deck (facedown, MC27 p. 13, docs/phase7-wave5.md §3.5).
  "27088a.when-revealed": whenRevealed(
    forEachPlayer(eachPlayer, moveCardsInto(encounterCards(["deck"], undefined, 2), "deckShuffle", thatPlayer)),
  ),
  // 2B (27088b) — Forced Interrupt: as 1B.
  "27088b.edge-of-reality-forced-interrupt": encounterCardInsteadOfDrawOrDiscard(),
});
