/**
 * The card pool section view model: the selected deck own browsable pool (its aspect or aspects, Basic and Hero cards), filtered
 * by one of those (radio-style, "all" clears it), sortable by cost, searched by the fuzzy worker plus `field:value` terms, and
 * shown as the windowed grid. Read-only browsing: editing a deck contents is the deck builder job.
 */
import type { AnyCard, CoreAspect, Deck, HeroIdentityCard } from "@mc/content";
import type { DecksCardsModel, DecksPoolCard, FilterChip } from "../../components/decks/decks.types.js";
import { artFor, artLanguageNow } from "../../art/art-source.js";
import { currentPool, currentPoolKey, packNameOf } from "../../content/pool.js";
import { t } from "../../i18n/translate.js";
import { inputDevice } from "../../platform/input-device.js";
import { appSession } from "../../session.js";
import { cardSizeFactor } from "../../settings.js";
import { surface } from "../../tokens.js";
import { aspectStampOf } from "../../view/aspect-stamp.js";
import { localizedLabelOf } from "../../view/card-text.js";
import { createPoolDocumentCache, poolSearchDocuments } from "../../view/card-pool-search.js";
import { browsablePool, subtitleCutFrom, typeWordOf, type PoolFilter } from "../../view/deck-builder-model.js";
import type { SearchDocument } from "../../view/deck-search.js";
import type { DeckOption } from "../../view/deck-list-model.js";
import type { DecksBook } from "./decks-book.js";
import type { DecksState } from "./decks-state.js";

/** `cardSearchDocumentOf` per card id: the rules text is built once, not per selected deck. */
const poolDocs = createPoolDocumentCache();

const css = (hex: number): string => `#${hex.toString(16).padStart(6, "0")}`;

/** D14 own pool filter chips: the deck chosen aspect(s), Basic, Hero (one active at a time, press again to clear), then a Cost sort. */
export function poolChipsOf(st: DecksState, deck: Deck): readonly FilterChip[] {
  const tintOf = (aspect: CoreAspect | "basic"): { fill: string; ink: string } => {
    const stamp = aspectStampOf(aspect);
    return { fill: css(stamp.fill), ink: css(stamp.ink) };
  };
  const chips: FilterChip[] = deck.aspects.map((aspect) => ({
    id: `aspect:${aspect}`,
    label: aspectStampOf(aspect).label,
    selected: st.poolAspectFilter === aspect,
    tint: tintOf(aspect),
  }));
  chips.push({
    id: "basic",
    label: aspectStampOf("basic").label,
    selected: st.poolAspectFilter === "basic",
    tint: tintOf("basic"),
  });
  // Hero has no printed frame color of its own: an ink stamp, so it never reads as one of the aspects.
  chips.push({
    id: "hero",
    label: t("decks.poolHero"),
    selected: st.poolAspectFilter === "identity",
    tint: { fill: css(surface.ink.hex), ink: css(surface.paper.hex) },
  });
  chips.push({ id: "cost", label: t("decks.poolCost"), selected: st.poolSortByCost });
  return chips;
}

/** What a press on a pool chip does to the filter state; the scene redraws after. */
export function pressPoolChip(st: DecksState, id: string): void {
  if (id === "cost") st.poolSortByCost = !st.poolSortByCost;
  else {
    const value = id === "basic" ? "basic" : id === "hero" ? "identity" : (id.slice("aspect:".length) as CoreAspect);
    st.poolAspectFilter = st.poolAspectFilter === value ? null : value;
  }
  st.poolTop += 1;
}

/** The documents the search worker ranks: every card the selected deck can browse. */
export function poolDocuments(st: DecksState): { readonly docs: readonly SearchDocument[]; readonly version: string } {
  const context = st.poolContext;
  if (!context) return { docs: [], version: "" };
  const lang = artLanguageNow();
  const { deck, identity } = context;
  return {
    docs: poolSearchDocuments(
      browsablePool(currentPool(), identity, deck.aspects, {}),
      lang,
      (code) => packNameOf(code),
      poolDocs,
    ),
    version: `${currentPoolKey()}:${identity.id as string}:${deck.aspects.join(",")}:${lang}`,
  };
}

/** The cards the selected deck pool lists now: the aspect filter, the text search and the cost sort applied. */
export function poolCardsOf(
  st: DecksState,
  deck: Deck,
  identity: HeroIdentityCard,
  deckListOnly: boolean,
): readonly AnyCard[] {
  // The text words are still being ranked: nothing is listed, never the previous text matches.
  if (st.poolSearch.pending) return [];
  const filter: PoolFilter = st.poolAspectFilter ? { aspect: st.poolAspectFilter } : {};
  const browsable = browsablePool(currentPool(), identity, deck.aspects, st.poolSearch.filterFor(filter));
  const inDeck = new Set(deck.cards.map((entry) => entry.cardId as string));
  const inScope = deckListOnly ? browsable.filter((card) => inDeck.has(card.id as string)) : browsable;
  const ranking = st.poolSearch.ranking;
  const found = ranking ? inScope.filter((card) => ranking.has(card.id as string)) : inScope;
  const pool = ranking
    ? [...found].sort((a, b) => (ranking.get(b.id as string) ?? 0) - (ranking.get(a.id as string) ?? 0))
    : found;
  if (!st.poolSortByCost) return pool;
  const costOf = (card: AnyCard): number =>
    "cost" in card ? (card as unknown as { cost: number }).cost : Number.POSITIVE_INFINITY;
  return [...pool].sort((a, b) => costOf(a) - costOf(b) || a.name.localeCompare(b.name));
}

/** A pool card as a cell shows it: its scan, name, type and how many the deck holds of its limit. */
export function poolCardView(st: DecksState, card: AnyCard, deck: Deck): DecksPoolCard {
  const cardId = card.id as string;
  const limit = ("deckLimit" in card ? (card as unknown as { deckLimit: number }).deckLimit : null) ?? null;
  const have = deck.cards.find((c) => (c.cardId as string) === cardId)?.quantity ?? 0;
  const lang = artLanguageNow();
  const title = localizedLabelOf(card, lang);
  const subtitle = subtitleCutFrom(card, title);
  const typeLabel = `${subtitle ? `${subtitle} · ` : ""}${typeWordOf(card.type, lang)}`;
  const held = st.pictures.image(artFor(card, { kind: "front" }));
  return {
    cardId,
    picture: {
      src: held.src,
      ...(held.retry !== undefined ? { retry: held.retry } : {}),
      missing: t("deckCheck.noScan"),
    },
    title,
    cost:
      "cost" in card && typeof (card as unknown as { cost: unknown }).cost === "number"
        ? (card as unknown as { cost: number }).cost
        : null,
    caption: limit !== null ? `${typeLabel} · ${t("decks.poolInDeck", { have, limit })}` : typeLabel,
    quantity: have,
    shown: st.paneCard !== null && (st.paneCard.id as string) === cardId,
  };
}

export interface CardsInput {
  readonly st: DecksState;
  readonly book: DecksBook;
  readonly selected: DeckOption | null;
  /** A community deck previews its own list (it cannot be edited here, so the rest of the pool is beside the point). */
  readonly deckListOnly: boolean;
  readonly phone: boolean;
}

/** The card pool section, and the cards it lists (for the focus route). */
export function cardsModelOf(input: CardsInput): {
  readonly model: DecksCardsModel;
  readonly cards: readonly AnyCard[];
} {
  const { st, book, selected, deckListOnly, phone } = input;
  st.poolContext = null;
  const title = deckListOnly ? t("decks.deckList") : t("decks.cardPool");
  const say = (text: string): { model: DecksCardsModel; cards: readonly AnyCard[] } => ({
    model: base({ title, empty: text }),
    cards: [],
  });
  if (!selected) return say(t("decks.poolSelectDeck"));
  const identity = book.identityOf(selected.deck);
  if (!identity) return say(t("decks.poolNoIdentity"));
  st.poolContext = { deck: selected.deck, identity };
  // The worker ranks the cards this deck can browse: they change with its hero and aspects.
  const version = `${currentPoolKey()}:${identity.id as string}:${selected.deck.aspects.join(",")}:${artLanguageNow()}`;
  if (version !== st.poolDocsVersion) {
    st.poolDocsVersion = version;
    st.poolSearch.refresh();
  }
  const cards = poolCardsOf(st, selected.deck, identity, deckListOnly);
  const steam = inputDevice().mode === "pad" && inputDevice().pad?.steam === true;
  const active = (st.poolAspectFilter ? 1 : 0) + (st.poolSortByCost ? 1 : 0);
  const searched = st.poolSearchText.trim();
  const empty =
    cards.length > 0
      ? null
      : st.poolSearch.pending
        ? t("pause.searching")
        : searched
          ? t("decks.poolNoMatchSearch", { text: searched })
          : t("decks.poolNoMatch");
  const deck = selected.deck;
  return {
    cards,
    model: base({
      title,
      chips: poolChipsOf(st, deck),
      // A phone folds the chips behind a Filters button (they would be drawn over the heading), open onto their own rows.
      foldable: phone
        ? {
            label: `${t("decks.filters")}${active > 0 ? ` · ${active}` : ""}`,
            open: st.poolFiltersOpen,
          }
        : null,
      search: {
        // The text the pool has taken, never the field live draft: the field keeps its own pending draft across a redraw
        // while this stays the same, and a covered panel puts the field back to what the pool accepted.
        text: st.poolSearchText,
        placeholder: t("decks.poolSearch"),
        clearLabel: t("decks.clearSearch"),
        ...(steam ? { focusPlaceholder: t("reader.steamKeyboard") } : {}),
      },
      empty,
      cardIds: cards.map((card) => card.id as string),
      cardAt: (index) => poolCardView(st, cards[index]!, deck),
      topKey: st.poolTop,
      cardScale: cardSizeFactor(appSession().settings.cardSize),
      version: `${version}:${deck.id as string}:${st.paneCard?.id ?? ""}:${cards.length}`,
    }),
  };
}

function base(over: Partial<DecksCardsModel> & Pick<DecksCardsModel, "title">): DecksCardsModel {
  return {
    chips: [],
    foldable: null,
    search: null,
    empty: null,
    cardIds: [],
    cardAt: () => {
      throw new Error("decks: no card in an empty pool");
    },
    topKey: 0,
    cardScale: 1,
    version: "",
    ...over,
  };
}
