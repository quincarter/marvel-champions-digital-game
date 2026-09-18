/**
 * "Recently changed" (W9, docs/phase4-screen-gaps.md §3 "Decks & Collection"):
 * the minimal honest version §3 asks for — `Deck.updatedAt` (`@mc/content`,
 * stamped by `view/deck-builder-model.ts`'s `touch`/`duplicateDeck` and
 * `view/deck-import-model.ts`'s two import functions, every place a deck is
 * actually persisted) and a sort by it. **There is no revision history**: one
 * timestamp, overwritten on every save, never a log of what changed — the
 * D14 canvas's own "+2 Photon Blast, −2 Toe to Toe" line is exactly the
 * feature this module deliberately does not build (docs/phase4-screen-gaps.md
 * §4 "Advice text" draws a similar line: a feature either exists honestly or
 * is left out, never faked with data the client doesn't have).
 *
 * A precon is never "recently changed" — `preconDecks()` (`view/deck-list-model.ts`)
 * derives it fresh every time and it never carries `updatedAt`, which is
 * correct: nothing about a precon is ever edited. **A deck saved before this
 * field existed has none either**, and that has to stay a normal, loadable
 * state forever (a real player's existing saved decks), not a one-time
 * migration case — `sortByRecency` puts every such deck after every deck that
 * does have a timestamp, in whatever order it was given them, rather than
 * erroring or inventing a date.
 */
import type { Deck } from "@mc/content";

/**
 * `decks`, most recently changed first. Decks with no `updatedAt` (never
 * saved under this field, including every precon) keep their relative order
 * from `decks` and sort after every timestamped deck — "unknown" is treated
 * as "not recent", never as "oldest" or "newest" by accident.
 */
export function sortByRecency(decks: readonly Deck[]): readonly Deck[] {
  return decks
    .map((deck, index) => ({ deck, index }))
    .sort((a, b) => {
      const at = a.deck.updatedAt;
      const bt = b.deck.updatedAt;
      if (at && bt) return bt.localeCompare(at) || a.index - b.index;
      if (at && !bt) return -1;
      if (!at && bt) return 1;
      return a.index - b.index;
    })
    .map(({ deck }) => deck);
}

/** The `limit` most recently changed decks that actually have a timestamp — what a "Recently changed" section lists. Empty when nothing has ever been saved under this field yet. */
export function recentlyChangedOf(decks: readonly Deck[], limit = 5): readonly Deck[] {
  return sortByRecency(decks)
    .filter((deck): deck is Deck & { readonly updatedAt: string } => deck.updatedAt !== undefined)
    .slice(0, limit);
}
