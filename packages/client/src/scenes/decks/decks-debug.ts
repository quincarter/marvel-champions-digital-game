/**
 * Dev e2e hook (never referenced by product code): the decks the list offers (as imported decks, with the status chip words and
 * the card total), the community decks, the status line, and every control current rect by focus key. The specs read it through
 * `window.__mcDecksDebug`; it exists only in a dev build.
 */
import { deckStatusOf } from "../../view/deck-status.js";
import { communityStatusText } from "../../view/community-decks-model.js";
import type { FocusStop } from "../focus-route.js";
import type { PageBuild } from "./decks-page-model.js";
import type { DecksStatus } from "./decks-state.js";

export interface DecksDebugSource {
  readonly stops: () => ReadonlyMap<string, FocusStop>;
  readonly build: () => PageBuild | null;
  readonly status: () => DecksStatus | null;
  readonly hoverShown: () => string | null;
  readonly selectedId: () => string | null;
}

export function installDecksDebug(source: DecksDebugSource): void {
  if (!import.meta.env.DEV) return;
  (window as unknown as { __mcDecksDebug?: unknown }).__mcDecksDebug = {
    stops: () =>
      [...source.stops()].map(([key, stop]) => ({
        key,
        ...(typeof stop.rect === "function" ? stop.rect() : stop.rect),
      })),
    community: () =>
      (source.build()?.offers ?? []).map((offer) => ({
        id: offer.option.deck.id as string,
        marvelcdbId: offer.entry.marvelcdbId,
        name: offer.entry.name,
        hero: offer.entry.heroName,
        author: offer.entry.author,
        url: offer.entry.url,
        status: communityStatusText(offer),
        lock: offer.lock,
        added: offer.added,
        selected: (offer.option.deck.id as string) === source.selectedId(),
      })),
    decks: () =>
      (source.build()?.ownOptions ?? []).map((o) => ({
        id: o.deck.id as string,
        name: o.deck.name,
        source: o.deck.source.kind,
        selected: (o.deck.id as string) === source.selectedId(),
        status: deckStatusOf(o).text,
        legal: o.legal,
        problems: o.problems.map((p) => p.message),
        warning: o.warning,
        cardCount: o.deck.cards.reduce((sum, entry) => sum + entry.quantity, 0),
      })),
    status: () => source.status(),
    /** The card the hover popover is showing, or null (a mouse over a deck row thumbnail or a pool card). */
    hoverShown: () => source.hoverShown(),
    /** The tab shown on a phone or tablet; null on desktop, where every pane is up. */
    tab: () => {
      const build = source.build();
      return build && !build.wide ? build.page.tab : null;
    },
    /** True while any listed deck status is still on its way from the worker. */
    checking: () => {
      const build = source.build();
      return [...(build?.ownOptions ?? []), ...(build?.offers.map((o) => o.option) ?? [])].some(
        (o) => o.checking === true,
      );
    },
  };
}
