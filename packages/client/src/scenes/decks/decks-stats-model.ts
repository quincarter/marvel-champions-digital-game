/**
 * The stats rail view model, for the selected deck: its numbers (the cost curve, the composition, Check / Edit / Delete, when it
 * last changed), what your games say about it (#529), a pool card shown in their place, and a community deck rail. Every
 * legality and record fact shown is the engine view (`view/deck-status.ts`, `view/deck-insights.ts`).
 */
import { communityDecks } from "@mc/cards";
import { DECK_MIN_CARDS } from "@mc/engine";
import type { AnyCard, Deck } from "@mc/content";
import type {
  BarChartBar,
  DecksActionButton,
  DecksCardViewModel,
  DecksCommunityModel,
  DecksDeckStatsModel,
  DecksGamesBlock,
  DecksGamesEntry,
  DecksGamesModel,
  DecksStatsModel,
} from "../../components/decks/decks.types.js";
import { artFor, artLanguageNow } from "../../art/art-source.js";
import { currentCardsById, currentPool } from "../../content/pool.js";
import type { ControlGlyphs } from "../../dom/control-glyphs.js";
import { t } from "../../i18n/translate.js";
import { aspectStampOf } from "../../view/aspect-stamp.js";
import {
  communityCredit,
  communityEntryOf,
  communityNotesOf,
  communityPublishedText,
  communityStatusText,
  type CommunityOffer,
} from "../../view/community-decks-model.js";
import { browsablePool } from "../../view/deck-builder-model.js";
import {
  NOTHING_STANDS_OUT,
  againstVillainOf,
  cardPlayOf,
  fromYourGamesOf,
  villainsFacedOf,
  type SuggestedCard,
} from "../../view/deck-insights.js";
import type { DeckOption } from "../../view/deck-list-model.js";
import { deckDisplayName, identityLabelOf, localHeroName } from "../../view/deck-names.js";
import { deckReasonText } from "../../view/deck-reason.js";
import {
  compositionTilesOf,
  costCurveBars,
  deckCountText,
  deckStatsOf,
  type CostCurveBar,
} from "../../view/deck-stats.js";
import { deckStatusOf } from "../../view/deck-status.js";
import { cardTitleOf, deckAspectsText } from "../../view/deck-title.js";
import { oneDecimal } from "../../view/number-format.js";
import { POOL_STATS_NAMES } from "../../view/player-stats-names.js";
import type { DecksBook } from "./decks-book.js";
import type { DecksState } from "./decks-state.js";

const css = (hex: number): string => `#${hex.toString(16).padStart(6, "0")}`;

/** Ink and paper as the rail draws them (CSS variables, so dark mode follows). */
const PAPER = "var(--mc-fill-paper)";
const INK = "var(--mc-text-ink)";
const RED = "var(--mc-fill-red)";

export interface StatsInput {
  readonly st: DecksState;
  readonly book: DecksBook;
  readonly glyphs: ControlGlyphs;
  readonly selected: DeckOption | null;
  readonly offer: CommunityOffer | null;
  readonly wide: boolean;
  /** A control row in px: 28 on a desktop, 44 on a touch layout (what a glyph hangs on). */
  readonly row: number;
}

/**
 * The curve D14 own way: every bar paper except the deck most-common printed costs, which are Hero Red. Ties are included
 * (every bar at either of the top two counts is highlighted) and a bar with no cards is never highlighted.
 */
export function curveBarsOf(bars: readonly CostCurveBar[]): readonly BarChartBar[] {
  const top = new Set(
    [...new Set(bars.map((bar) => bar.count))]
      .filter((count) => count > 0)
      .sort((a, b) => b - a)
      .slice(0, 2),
  );
  // The rail is ink: a bar that does not stand out is paper (ink on ink would not show).
  return bars.map((bar) => ({
    label: bar.label,
    count: bar.count,
    highlight: top.has(bar.count),
    ...(top.has(bar.count) ? {} : { tint: PAPER }),
  }));
}

function button(
  action: DecksActionButton["action"],
  label: string,
  glyph?: DecksActionButton["glyph"],
  disabled?: string | null,
): DecksActionButton {
  return { action, label, ...(glyph ? { glyph } : {}), ...(disabled ? { disabled } : {}) };
}

function entriesOf(st: DecksState, cards: readonly SuggestedCard[]): readonly DecksGamesEntry[] {
  return cards.map((entry) => {
    const card = currentCardsById().get(entry.cardId);
    const held = st.pictures.image(card ? artFor(card, { kind: "front" }) : null);
    return {
      cardId: entry.cardId,
      name: card?.name ?? entry.cardId,
      detail: entry.detail,
      picture: {
        src: held.src,
        ...(held.retry !== undefined ? { retry: held.retry } : {}),
        missing: t("rules.noScan"),
      },
    };
  });
}

/** From your games (#529): how this hero games go and what they say about this deck cards, to read. */
export function gamesModelOf(input: StatsInput, deck: Deck): DecksGamesModel {
  const { st, book } = input;
  const open = button(
    "games-open",
    deck.source.kind === "precon" ? t("decks.games.buildOwn") : t("decks.games.editWith"),
  );
  if (!st.insights) {
    return { reading: t("decks.games.reading").toUpperCase(), headline: null, insight: null, blocks: [], open };
  }
  const ids = deck.cards.map((line) => line.cardId as string);
  const view = fromYourGamesOf(st.insights, deck.identityCardId as string, ids, deck.aspects, POOL_STATS_NAMES);
  // Only cards this deck pool lists, as the builder rail shows them.
  const identity = book.identityOf(deck);
  const listed = identity
    ? new Set(browsablePool(currentPool(), identity, deck.aspects, {}).map((card) => card.id as string))
    : new Set<string>();
  const blocks: DecksGamesBlock[] = [];
  const section = (title: string, cards: readonly SuggestedCard[]): void => {
    if (cards.length > 0) blocks.push({ kind: "section", title, entries: entriesOf(st, cards) });
  };
  section(deck.source.kind === "precon" ? t("decks.games.rarely") : t("decks.games.cut"), view.cut);
  section(
    t("decks.games.try"),
    view.tryCards.filter((entry) => listed.has(entry.cardId)),
  );
  const faced = villainsFacedOf(st.insights);
  if (faced.length > 0) {
    const villain = faced.includes(st.againstVillain ?? "") ? st.againstVillain! : faced[0]!;
    const against = againstVillainOf(
      st.insights,
      villain,
      deck.identityCardId as string,
      ids,
      deck.aspects,
      POOL_STATS_NAMES,
    );
    blocks.push({
      kind: "against",
      label: `${against?.headline ?? villain}${faced.length > 1 ? " ▸" : ""}`,
      enabled: faced.length > 1,
    });
    if (against) {
      const shown = new Set([...view.cut, ...view.tryCards].map((entry) => entry.cardId));
      const wins = against.tryCards.filter((entry) => listed.has(entry.cardId) && !shown.has(entry.cardId));
      const losses = against.cutCards.filter((entry) => !shown.has(entry.cardId));
      section(t("decks.games.tryWins"), wins);
      section(t("decks.games.cutLosses"), losses);
      const nothing = against.note ?? (wins.length + losses.length === 0 ? NOTHING_STANDS_OUT : null);
      if (nothing) blocks.push({ kind: "note", text: nothing });
    }
  }
  section(t("decks.games.keep"), view.keep);
  if (view.note) blocks.push({ kind: "note", text: view.note });
  return {
    reading: null,
    headline: view.headline ? view.headline.toUpperCase() : null,
    insight: view.insight ?? null,
    blocks,
    open,
  };
}

/** A pool card in the pane: the card, what your games say about it, the decks that hold it, and Inspect. */
export function cardViewOf(input: StatsInput, card: AnyCard, deck: Deck): DecksCardViewModel {
  const { st, book, glyphs, row } = input;
  const heroId = deck.identityCardId as string;
  const hero = st.insights ? cardPlayOf(st.insights, card.id as string, heroId, POOL_STATS_NAMES) : null;
  const all = st.insights ? cardPlayOf(st.insights, card.id as string, null, POOL_STATS_NAMES) : null;
  const heroName = localHeroName(heroId, (currentCardsById().get(heroId)?.name ?? heroId).replace(/ \(.*\)$/, ""));
  const blocks: DecksCardViewModel["blocks"] = !st.insights
    ? [{ title: t("decks.card.yourPlay"), lines: null, empty: t("decks.games.reading") }]
    : [
        {
          title: t("decks.card.withHero", { hero: heroName }),
          lines: hero,
          empty: t("decks.card.notWithHero", { hero: heroName }),
        },
        { title: t("decks.card.everyHero"), lines: all, empty: t("decks.card.notYet") },
      ];
  const holding = book
    .deckOptions()
    .filter((option) => option.deck.cards.some((line) => line.cardId === card.id))
    .map((option) => deckDisplayName(option.deck));
  const held = st.pictures.image(artFor(card, { kind: "front" }));
  return {
    cardId: card.id as string,
    back: button("card-back", t("decks.card.back"), glyphs.glyph("card-back", ["cancel"], "ink", row)),
    inspect: button("card-inspect", t("decks.card.inspect"), glyphs.glyph("card-inspect", ["inspect"], "ink", row)),
    picture: { src: held.src, ...(held.retry !== undefined ? { retry: held.retry } : {}), missing: t("rules.noScan") },
    name: card.name,
    typeLine: card.type.replace(/_/g, " ").toUpperCase(),
    blocks,
    inDecksHeading: t("decks.card.inDecks").toUpperCase(),
    inDecks: [
      ...holding.slice(0, 4),
      ...(holding.length > 4 ? [t("decks.card.more", { count: holding.length - 4 })] : []),
    ],
  };
}

/** The deck own rail. */
function deckModelOf(input: StatsInput, option: DeckOption): DecksDeckStatsModel {
  const { st, glyphs, row } = input;
  const deck = option.deck;
  const stats = deckStatsOf(deck, currentPool());
  const status = deckStatusOf(option);
  const lang = artLanguageNow();
  const basedOn = communityEntryOf(deck, communityDecks());
  if (st.paneCard && st.paneCardDeckId !== (deck.id as string)) st.paneCard = null;
  const mode = st.paneCard ? "card" : st.paneTab;
  const editable = deck.source.kind !== "precon";
  // A pending Delete confirmation belongs to the deck it was pressed on; selecting another drops it.
  if (st.deleteArmedId !== null && st.deleteArmedId !== (deck.id as string)) st.deleteArmedId = null;
  const armed = st.deleteArmedId === (deck.id as string);
  const avg = stats.averageCost === null ? "" : ` · ${t("decks.stats.avg", { avg: oneDecimal(stats.averageCost) })}`;
  const canPlay = option.seatable;
  const tabGlyph = (tab: "deck" | "games") =>
    st.paneTab === tab ? undefined : glyphs.triggerGlyph(`pane:${tab}`, tab === "deck" ? "lt" : "rt", "ink", row);
  return {
    kind: "deck",
    title: cardTitleOf(option).toUpperCase(),
    // Wraps inside the pane: an imported deck line ("... LEGAL IMPORTED") is wider than one row.
    meta: `${deck.source.kind === "precon" ? "" : deckAspectsText(deck)}${deckCountText(stats).toUpperCase()} · ${t("decks.stats.min", { min: DECK_MIN_CARDS }).toUpperCase()} · ${status.text.toUpperCase()} · ${t(`decks.source.${deck.source.kind}`).toUpperCase()}`,
    credit: basedOn ? t("decks.stats.community", { credit: communityCredit(basedOn) }) : null,
    mode,
    tabs: [
      {
        action: "pane-deck",
        label: t("decks.stats.thisDeck"),
        selected: st.paneTab === "deck",
        glyph: tabGlyph("deck"),
      },
      {
        action: "pane-games",
        label: t("decks.stats.fromGames"),
        selected: st.paneTab === "games",
        glyph: tabGlyph("games"),
      },
    ],
    deck: {
      curveHeading: `${t("decks.stats.curve")}${avg}`.toUpperCase(),
      bars: curveBarsOf(costCurveBars(stats)),
      compositionHeading: t("decks.stats.composition").toUpperCase(),
      tiles: compositionTilesOf(stats, lang).map((tile) => ({ label: tile.label, count: tile.count })),
      actions: [
        button("stats-check", t("decks.stats.check")),
        button("stats-edit", editable ? t("decks.stats.edit") : t("decks.stats.editCopy")),
        ...(editable ? [button("stats-delete", armed ? t("decks.stats.confirmDelete") : t("decks.stats.delete"))] : []),
      ],
      recentlyHeading: t("decks.stats.recently").toUpperCase(),
      // W9/S1: the minimal honest version, one timestamp and no revision history.
      recently: deck.updatedAt
        ? t("decks.stats.lastChanged", { date: new Date(deck.updatedAt).toLocaleDateString() })
        : t("decks.stats.noHistory").toUpperCase(),
    },
    games: mode === "games" ? gamesModelOf(input, deck) : null,
    card: st.paneCard ? cardViewOf(input, st.paneCard, deck) : null,
    footer: {
      duplicate: button("stats-duplicate", t("decks.stats.duplicate")),
      play: button(
        "stats-play",
        t("decks.stats.play"),
        undefined,
        canPlay
          ? null
          : option.checking
            ? t("room.picker.checking")
            : (deckReasonText(option.blockedReason) ?? t("decks.stats.notLegal")),
      ),
    },
  };
}

/** A community deck rail: whose it is, that this game tested it, when it was published, the author notes, and Check / Add. */
function communityModelOf(input: StatsInput, offer: CommunityOffer): DecksCommunityModel {
  const { entry, option } = offer;
  const stats = deckStatsOf(option.deck, currentPool());
  const statusText = communityStatusText(offer);
  const problem = offer.lock !== null || !option.legal;
  const published = communityPublishedText(entry);
  const canAdd = offer.lock === null && option.legal;
  const checking = option.checking ? t("room.picker.checking") : deckReasonText(option.blockedReason);
  return {
    kind: "community",
    from: t("decks.community.from").toUpperCase(),
    name: entry.name.toUpperCase(),
    credit: communityCredit(entry),
    stamps: [
      ...entry.aspects.map((aspect) => {
        const stamp = aspectStampOf(aspect, artLanguageNow());
        return { text: stamp.label, fill: css(stamp.fill), ink: css(stamp.ink) };
      }),
      problem ? { text: `✕ ${statusText}`, fill: RED, ink: PAPER } : { text: `✓ ${statusText}`, fill: PAPER, ink: INK },
    ],
    meta: [
      identityLabelOf(option) ?? entry.heroName,
      deckCountText(stats),
      ...(published ? [published] : []),
      t("decks.community.notOfficial"),
    ]
      .join(" · ")
      .toUpperCase(),
    why: problem ? (offer.lock ?? checking ?? "") || null : null,
    notesHeading: t("decks.community.notesHeading").toUpperCase(),
    notes: communityNotesOf(entry.description).join("\n\n"),
    noNotes: t("decks.community.noNotes"),
    scrollCue: t("decks.community.scroll").toUpperCase(),
    url: entry.url.replace(/^https:\/\//, ""),
    links: [
      ...(input.wide ? [] : [button("stats-preview", t("decks.community.preview"))]),
      button("stats-copy-link", t("decks.community.copyLink")),
      button("stats-open-link", "MarvelCDB ↗"),
    ],
    check: button("stats-check", t("decks.stats.check")),
    add: button(
      "stats-add",
      offer.added ? t("decks.community.addAnother") : t("decks.community.add"),
      undefined,
      canAdd ? null : (offer.lock ?? checking ?? t("decks.stats.notLegal")),
    ),
  };
}

/** The stats rail for what is selected. */
export function statsModelOf(input: StatsInput): DecksStatsModel {
  if (!input.selected) return { kind: "empty", text: t("decks.stats.select") };
  return input.offer ? communityModelOf(input, input.offer) : deckModelOf(input, input.selected);
}
