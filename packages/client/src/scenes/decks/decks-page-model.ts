/** The whole Decks & Collection page model: the header, the tab rail, and the three sections, from the screen state. */
import type Phaser from "phaser";
import type { AnyCard } from "@mc/content";
import type { DecksHeaderModel, DecksPageModel, DecksTab } from "../../components/decks/decks.types.js";
import { currentPool } from "../../content/pool.js";
import type { ControlGlyphs } from "../../dom/control-glyphs.js";
import { t } from "../../i18n/translate.js";
import { hit } from "../../tokens.js";
import { decksLayout } from "../../view/decks-layout.js";
import type { DeckOption } from "../../view/deck-list-model.js";
import type { CommunityOffer } from "../../view/community-decks-model.js";
import type { DecksBook } from "./decks-book.js";
import { listModelOf } from "./decks-list-model.js";
import { cardsModelOf } from "./decks-pool-model.js";
import type { DecksState } from "./decks-state.js";
import { statsModelOf } from "./decks-stats-model.js";

const COMPACT_ROW = 28;

export interface PageInput {
  readonly scene: Phaser.Scene;
  readonly st: DecksState;
  readonly book: DecksBook;
  readonly glyphs: ControlGlyphs;
  readonly width: number;
  readonly height: number;
}

export interface PageBuild {
  readonly page: DecksPageModel;
  readonly wide: boolean;
  readonly deckIds: readonly string[];
  readonly cards: readonly AnyCard[];
  readonly selected: DeckOption | null;
  readonly offer: CommunityOffer | null;
  readonly ownOptions: readonly DeckOption[];
  readonly offers: readonly CommunityOffer[];
}

function headerOf(phone: boolean, glyphs: ControlGlyphs): DecksHeaderModel {
  return {
    backLabel: t("decks.back"),
    backGlyph: glyphs.glyph("back", ["cancel"], "ink", hit.target),
    title: t("decks.title"),
    poolMeta: phone ? null : t("decks.poolMeta", { count: currentPool().length }),
    statsLabel: t("decks.yourStats"),
    statsGlyph: glyphs.glyph("player-stats", ["guide"], "ink", hit.target),
  };
}

export function buildDecksPage(input: PageInput): PageBuild {
  const { st, book, glyphs, width, height } = input;
  glyphs.reset();
  const layout = decksLayout({ width, height });
  const wide = layout.wide;
  const phone = layout.formFactor === "phone";
  const row = wide ? COMPACT_ROW : hit.target;
  book.askStatuses();
  const ownOptions = book.deckOptions();
  const offers = book.communityOffers();
  const allOptions = [...ownOptions, ...offers.map((offer) => offer.option)];
  const { selected, offer } = book.settleSelection(allOptions, offers);
  book.syncDocuments(allOptions);
  const rows = book.buildRows(
    ownOptions,
    offers,
    { precon: t("decks.group.precon"), build: t("decks.group.build"), community: t("decks.group.community") },
    t("decks.noMatch"),
  );
  const listWidth = layout.listPane?.width ?? layout.content?.width ?? width;
  const list = listModelOf({ st, rows, ownOptions, selected, width: listWidth });
  const cards = cardsModelOf({ st, book, selected, deckListOnly: offer !== null, phone });
  const stats = statsModelOf({ st, book, glyphs, selected, offer, wide, row });
  const tab: DecksTab = st.activeTab;
  const page: DecksPageModel = {
    wide,
    phone,
    tab,
    tabs: [
      { id: "decks", label: t("decks.tab.decks") },
      { id: "cards", label: t("decks.tab.cards") },
      { id: "stats", label: t("decks.tab.stats") },
    ],
    tabsGlyph: wide ? undefined : glyphs.glyph("tab-step", ["zonePrevious", "zoneNext"], "paper", 14),
    header: headerOf(phone, glyphs),
    list: list.model,
    cards: cards.model,
    stats,
  };
  glyphs.settled();
  return {
    page,
    wide,
    deckIds: list.deckIds,
    cards: cards.cards,
    selected,
    offer,
    ownOptions,
    offers,
  };
}
