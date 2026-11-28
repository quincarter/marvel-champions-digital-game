/** The deck list section view model: the rows (as `mc-deck-row` listings), the filter chips, the status banner and the Import / Export box. */
import type { Deck } from "@mc/content";
import type {
  DecksImportModel,
  DecksListModel,
  FilterChip,
  McDeckRowModel,
  PictureSource,
} from "../../components/decks/decks.types.js";
import { artFor, artLanguageNow } from "../../art/art-source.js";
import type { PictureFocus } from "../../art/focus.js";
import { packPictureFor } from "../../art/pack-art.js";
import { HERO_ART, heroArtForIdentity } from "../../art/hero-art.js";
import type { Picture } from "../../art/pictures.js";
import { currentCardsById, currentPool } from "../../content/pool.js";
import { heroPictureOf } from "../../dom/hero-picture.js";
import { t } from "../../i18n/translate.js";
import { appSession } from "../../session.js";
import { isDesktopType } from "../../ui/desktop-type.js";
import { aspectStampOf, aspectStampsOf } from "../../view/aspect-stamp.js";
import { communityMetaCandidates } from "../../view/community-decks-model.js";
import { CUSTOM_EXPORT_REASON, canExportToMarvelCdb, customBadgeOf, isCustomCard } from "../../view/custom-content.js";
import { deckRowIndexOf, type DeckOption } from "../../view/deck-list-model.js";
import { deckListChips, nextDeckList } from "../../view/deck-list-open.js";
import { deckStatusOf } from "../../view/deck-status.js";
import { cardTitleOf, deckMetaCandidates } from "../../view/deck-title.js";
import { deckKeyToString, type DeckKey } from "../../view/results-history.js";
import { deckSourcesOf, heroAspectsOf } from "../../view/roster-filter.js";
import { inputDevice } from "../../platform/input-device.js";
import type { DecksBook, DeckRow } from "./decks-book.js";
import type { DecksState } from "./decks-state.js";

/** A deck row on a phone or tablet: tall enough for a 1-line title, a 2-line precon meta and a selected row's record line. */
const ROW_HEIGHT = 84;
/** A row on desktop: its larger description still fits the full line under a two-line name. */
const DESKTOP_ROW_HEIGHT = 100;
/** A deck row hero picture, wide for its height: a cover crop of the hero face and shoulders. */
const DECK_THUMB_ASPECT = 1.25;
/** How much of a group-starting row own top is given to its small group label instead of the card. */
const GROUP_LABEL_HEIGHT = 16;

/** `deck` namespaced record key: the same one `view/results-history.ts` keys `DeckRecord` by. */
export function keyOf(deck: Deck): DeckKey {
  return deck.source.kind === "precon"
    ? { kind: "starter", starterDeckId: deck.source.starterDeckId as string }
    : { kind: "custom", deckId: deck.id as string };
}

/** The reading text sizes up here: the screen opts out of the desktop type bump to keep its card grid tight. */
const readingSize = (px: number): number => (isDesktopType() ? px + 2 : px);

const css = (hex: number): string => `#${hex.toString(16).padStart(6, "0")}`;

/** A deck row hero picture: the bundled one chosen this visit, else a pack or the identity scan, leased by its key. */
export function deckPicture(st: DecksState, identityId: string): ReturnType<typeof heroPictureOf> {
  let chosen: Picture | null | undefined;
  if (!isCustomCard(identityId)) {
    chosen = st.deckPictures.get(identityId);
    if (chosen === undefined) {
      chosen = heroArtForIdentity(HERO_ART, identityId, currentPool());
      st.deckPictures.set(identityId, chosen);
    }
  }
  return heroPictureOf(currentCardsById().get(identityId), st.pictures, "tile", chosen);
}

/** A deck row picture for the options sheet, per visit, so a redraw never reshuffles a hero with several pictures. */
export function deckArtOf(
  st: DecksState,
  identityId: string,
): { url: string | null; tileUrl?: string; focus?: PictureFocus } {
  // An installed pack hero picture arrives after the first draw, so it is not remembered here.
  if (isCustomCard(identityId)) {
    const identity = currentCardsById().get(identityId);
    return {
      url:
        packPictureFor("hero", identityId)?.url ?? (identity ? artFor(identity, { kind: "hero" })?.url : null) ?? null,
    };
  }
  let art = st.deckArt.get(identityId);
  if (!art) {
    const picture = heroArtForIdentity(HERO_ART, identityId, currentPool());
    const identity = currentCardsById().get(identityId);
    art = picture
      ? {
          url: picture.url,
          ...(picture.tileUrl ? { tileUrl: picture.tileUrl } : {}),
          ...(picture.focus ? { focus: picture.focus } : {}),
        }
      : { url: (identity ? artFor(identity, { kind: "hero" })?.url : null) ?? null };
    st.deckArt.set(identityId, art);
  }
  return art;
}

/** S8 quick-filter chips for this list: aspect, source, the list chips, and Legal only (a deck own legality, not a seating question). */
export function deckChipsOf(st: DecksState, allOptions: readonly DeckOption[]): readonly FilterChip[] {
  const decks = allOptions.map((o) => o.deck);
  const chips: FilterChip[] = [];
  for (const aspect of heroAspectsOf(decks)) {
    const stamp = aspectStampOf(aspect);
    chips.push({
      id: `aspect:${aspect}`,
      label: stamp.label,
      tint: { fill: css(stamp.fill), ink: css(stamp.ink) },
      selected: st.filter.aspect === aspect,
    });
  }
  for (const source of deckSourcesOf(decks)) {
    // The Preconstructed list chip below is the same narrowing.
    if (source === "precon") continue;
    chips.push({ id: `source:${source}`, label: t(`decks.source.${source}`), selected: st.filter.source === source });
  }
  for (const chip of deckListChips(appSession().settings.showPreconDecks)) {
    chips.push({
      id: chip.id === "community" ? "community" : `list:${chip.id}`,
      label: t(`decks.list.${chip.id}`),
      selected: st.deckList === chip.id,
    });
  }
  chips.push({ id: "legal-only", label: t("decks.legalOnly"), selected: st.filter.playableOnly === true });
  return chips;
}

/** What a press on a deck chip does to the list state; the scene redraws after. */
export function pressDeckChip(st: DecksState, book: DecksBook, id: string): void {
  if (id.startsWith("aspect:")) {
    const aspect = id.slice("aspect:".length) as NonNullable<DecksState["filter"]["aspect"]>;
    st.filter = { ...st.filter, aspect: st.filter.aspect === aspect ? null : aspect };
  } else if (id.startsWith("source:")) {
    const source = id.slice("source:".length) as NonNullable<DecksState["filter"]["source"]>;
    st.filter = { ...st.filter, source: st.filter.source === source ? null : source };
  } else if (id === "legal-only") {
    st.filter = { ...st.filter, playableOnly: !st.filter.playableOnly };
  } else {
    const list = id === "community" ? "community" : id.slice("list:".length);
    book.setList(nextDeckList(st.deckList, list as NonNullable<DecksState["deckList"]>));
    st.listTop += 1;
  }
}

interface RowInput {
  readonly st: DecksState;
  readonly row: Extract<DeckRow, { kind: "deck" }>;
  /** The list column width in px, for the thumbnail and how much of the meta line fits. */
  readonly width: number;
  readonly rowHeight: number;
}

/** One deck row as a `mc-deck-row` listing. */
export function deckRowModel({ st, row, width, rowHeight }: RowInput): McDeckRowModel {
  const option = row.option;
  const deckId = option.deck.id as string;
  const selected = deckId === st.selectedDeckId;
  const illegal = deckStatusOf(option).tone === "illegal";
  // A community deck whose hero or cards the player has not opened yet: shown, dimmed, with what opens it.
  const locked = row.offer !== undefined && row.offer.lock !== null;
  const cardTop = row.groupLabel ? GROUP_LABEL_HEIGHT : 2;
  const thumbHeight = rowHeight - 4 - cardTop - 12;
  // Capped in a narrow column (desktop left pane) so the title and meta line keep most of the row.
  const thumbWidth = Math.round(Math.min(thumbHeight * DECK_THUMB_ASPECT, (width - 8) * 0.26));
  const picture = deckPicture(st, option.deck.identityCardId as string);
  const textWidth = width - 8 - 6 - thumbWidth - 10 - 10;
  const metaOptions = row.offer ? communityMetaCandidates(row.offer) : deckMetaCandidates(option, currentPool());
  // A deck from an installed custom pack says so first, so a long line giving up its tail never loses it.
  const customBadge = row.offer ? null : customBadgeOf(option.deck);
  const candidates = customBadge ? metaOptions.map((line) => `${customBadge} · ${line}`) : metaOptions;
  // The fullest line that fits two lines of this width, by a letters-per-line estimate; a long one gives up its tail.
  const perLine = Math.max(10, Math.floor(textWidth / (readingSize(14) * 0.55)));
  const meta = candidates.find((candidate) => candidate.length <= perLine * 2) ?? candidates.at(-1)!;
  const record = st.history?.decks.find((r) => deckKeyToString(r.key) === deckKeyToString(keyOf(option.deck))) ?? null;
  const played = record && record.wins + record.losses > 0 ? record : null;
  const showRecord = selected && !row.offer;
  const source: PictureSource = {
    src: picture.src,
    ...(picture.retry !== undefined ? { retry: picture.retry } : {}),
    cover: picture.cover,
  };
  return {
    deckId,
    name: cardTitleOf(option),
    source: "",
    stamps: [],
    verdict: "",
    legal: !illegal,
    picture: source,
    seatLabel: "",
    disabled: null,
    cardId: option.deck.identityCardId as string,
    listing: {
      ...(row.groupLabel ? { group: row.groupLabel } : {}),
      look: "deck",
      heading: cardTitleOf(option),
      meta,
      src: picture.src,
      ...(picture.retry !== undefined ? { retry: picture.retry } : {}),
      focusX: picture.cover.x,
      focusY: picture.cover.y,
      ...(picture.cover.centered ? { focusCentered: true } : {}),
      fit: "cover",
      artWidth: thumbWidth,
      stamps: aspectStampsOf(option.deck.aspects, artLanguageNow()).map((stamp) => ({
        label: stamp.label,
        fill: css(stamp.fill),
        ink: css(stamp.ink),
      })),
      ...(!selected && !row.offer && played ? { badge: `${played.wins}–${played.losses}` } : {}),
      ...(showRecord
        ? {
            foot:
              record && record.gamesPlayed > 0
                ? t("decks.record", {
                    date: record.lastPlayedAt ? new Date(record.lastPlayedAt).toLocaleDateString() : "—",
                    wins: record.wins,
                    losses: record.losses,
                  })
                : t("decks.neverPlayed"),
          }
        : {}),
      selected,
      alert: illegal,
      dim: locked && !selected,
    },
  };
}

/** The Import / Export box: the text the screen has taken in each field, and why Export cannot act. */
export function importModelOf(st: DecksState, selected: DeckOption | null): DecksImportModel {
  const canExport = selected !== null && canExportToMarvelCdb(selected.deck);
  return {
    heading: t("decks.io.heading"),
    description: t("decks.io.description"),
    open: st.importExportOpen,
    pasteText: st.pasteText,
    marvelcdbText: st.marvelcdbText,
    busy: st.busy,
    pasteLabel: t("decks.io.paste"),
    cdbLabel: t("decks.io.cdbLink"),
    exportLabel: t("decks.io.export"),
    exportDisabled: canExport ? null : !selected ? t("decks.io.selectFirst") : CUSTOM_EXPORT_REASON,
    pastePlaceholder: t("decks.io.pastePlaceholder"),
    linkPlaceholder: t("decks.io.linkPlaceholder"),
    importListLabel: t("decks.io.importList"),
    importCdbLabel: t("decks.io.importCdb"),
    importingLabel: t("decks.io.importing"),
  };
}

export interface ListInput {
  readonly st: DecksState;
  readonly rows: readonly DeckRow[];
  /** The player own decks (precons and saved): the chips narrow these, not the community list. */
  readonly ownOptions: readonly DeckOption[];
  readonly selected: DeckOption | null;
  readonly width: number;
}

/** The deck list section, and the deck ids it offers as rows (for the focus route). */
export function listModelOf(input: ListInput): { readonly model: DecksListModel; readonly deckIds: readonly string[] } {
  const { st, rows, ownOptions, selected, width } = input;
  const rowHeight = isDesktopType() ? DESKTOP_ROW_HEIGHT : ROW_HEIGHT;
  const deckRows = rows.filter((r): r is Extract<DeckRow, { kind: "deck" }> => r.kind === "deck");
  const steam = inputDevice().mode === "pad" && inputDevice().pad?.steam === true;
  if (!st.focusedOnce && st.data.focusDeckId) {
    if (deckRows.some((row) => (row.option.deck.id as string) === st.data.focusDeckId)) {
      st.revealDeckId = st.data.focusDeckId;
      st.focusedOnce = true;
    }
  }
  // A deck just imported is selected and scrolled to once: it lands below every precon.
  if (st.scrollToDeckId) {
    if (deckRowIndexOf(rows, st.scrollToDeckId) >= 0) st.revealDeckId = st.scrollToDeckId;
    st.scrollToDeckId = null;
  }
  const reveal = st.revealDeckId ? { deckId: st.revealDeckId, key: ++st.revealKey } : null;
  st.revealDeckId = null;
  const message = rows.find((r) => r.kind === "message");
  const model: DecksListModel = {
    heading: t("decks.yourDecks"),
    newDeckLabel: t("decks.newDeck"),
    status: st.status,
    search: {
      text: st.filter.text,
      placeholder: t("decks.search"),
      clearLabel: t("decks.clearSearch"),
      ...(steam ? { focusPlaceholder: t("reader.steamKeyboard") } : {}),
    },
    filtersLabel: t("decks.filters"),
    filtersOpen: st.filtersExpanded,
    chips: st.filtersExpanded ? deckChipsOf(st, ownOptions) : [],
    rows: deckRows.map((row) => deckRowModel({ st, row, width, rowHeight })),
    empty: message?.kind === "message" ? message.text : null,
    rowHeight,
    reveal,
    topKey: st.listTop,
    io: importModelOf(st, selected),
  };
  return { model, deckIds: deckRows.map((row) => row.option.deck.id as string) };
}
