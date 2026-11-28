/**
 * Take your seats' whole page model, from the draft and the engine's seat options: the one place the sections' models are put
 * together. It reads state and returns data; the scene sets it on the page and sorts out the focus route.
 */
import type Phaser from "phaser";
import type { SeatsHintsModel, SeatsPageModel } from "../../components/seats/seats.types.js";
import type { ControlGlyphs } from "../../dom/control-glyphs.js";
import { t, tPlural } from "../../i18n/translate.js";
import { earnedPromoSets } from "../../progression/progression.js";
import { appSession } from "../../session.js";
import { estimateBangersWidth, sheetThemeFor } from "../../ui/campaign-chrome.js";
import { heroArtInForce, heroPromoShown } from "../../view/hero-art-choice.js";
import { formFactorFor } from "../../view/layout.js";
import { conflictNoticeOf } from "../../view/name-conflicts.js";
import { recommendedStartsCollapsed } from "../../view/seat-prefs.js";
import { MAX_SEATS, rosterColumnWidthFor } from "../../view/seats-layout.js";
import type { PackLeases } from "../../art/pack-art.js";
import { decksSheetOf } from "./seats-decks-model.js";
import { filtersModelOf } from "./seats-filters-model.js";
import { unresolvedConflictsOf } from "./seats-flow.js";
import { padGlyphsShown } from "./seats-paging.js";
import { rosterModelOf, type RosterKeys } from "./seats-roster-model.js";
import type { SeatsState } from "./seats-state.js";
import { detailModelOf, footerModelOf, pairModelsOf, seatModelsOf, summaryModelOf } from "./seats-table-model.js";
import type { SeatInsights } from "../../view/seat-recommendations.js";

export interface PageInput {
  readonly scene: Phaser.Scene;
  readonly st: SeatsState;
  readonly leases: PackLeases;
  readonly glyphs: ControlGlyphs;
  readonly width: number;
  readonly height: number;
  readonly phone: boolean;
  /** The chips are behind the Filters button (narrow, or a pad in use), and folded away now. */
  readonly behindButton: boolean;
  readonly folded: boolean;
  /** What is typed in the search field now (its debounce lags behind the keys), or null. */
  readonly typed: string | null;
  /** The focused shelf's paging glyphs (a pad only). */
  readonly paging: Pick<SeatsPageModel["roster"], "pagingHintShelf" | "pagingGlyphs">;
  /** The wide layout heading and key hints, asked for after the glyphs are reset. */
  readonly hints: () => SeatsHintsModel;
}

export interface PageBuild {
  readonly page: SeatsPageModel;
  readonly keys: RosterKeys;
  readonly shelfOfKey: ReadonlyMap<string, string>;
  readonly insights: SeatInsights;
  readonly conflicts: number;
  readonly wide: boolean;
  /** Where focus starts on arrival: the topmost hero tile on screen (a recommended pick when that shelf leads). */
  readonly firstTileKey: string | null;
}

/** The header bar's words fitted to the width: the step line gives way to its shorter forms, the title clears the dark mode tab. */
function headerOf(
  scene: Phaser.Scene,
  width: number,
  seatCount: number,
  backGlyph: SeatsPageModel["header"]["backGlyph"],
): SeatsPageModel["header"] {
  const titleSize = width < 768 ? 22 : 28;
  const title = t("seats.title");
  const titleX = 16 + 140 + 16;
  const stepRight = width - 16;
  const stepWidth = (text: string): number => text.length * 8.4;
  const titleWidth = estimateBangersWidth(title, titleSize);
  const fits = (text: string): boolean => titleX + titleWidth + 12 + stepWidth(text) <= stepRight;
  let step = tPlural("seats.stepFilled", seatCount);
  if (!fits(step)) step = t("seats.stepCount", { count: seatCount });
  if (!fits(step)) step = t("seats.step");
  const room = stepRight - stepWidth(step) - titleX - 12;
  const { drop, maxRight } = sheetThemeFor(scene, {
    width,
    textLeft: titleX,
    textRight: titleX + Math.min(titleWidth, room),
    textTop: 32 - titleSize / 2,
    textHeight: titleSize,
    barHeight: 64,
  });
  return {
    backLabel: t("seats.backToScenarios"),
    title,
    step,
    ...(backGlyph ? { backGlyph } : {}),
    titleDrop: drop,
    titleMaxRight: maxRight,
  };
}

export function buildSeatsPage(input: PageInput): PageBuild {
  const { st, leases, glyphs, width, height } = input;
  const { book, draft } = st;
  const factor = formFactorFor(width, height);
  const wide = factor === "desktop" || factor === "tabletLandscape";
  const options = book.deckOptions();
  const earned = earnedPromoSets();
  const { settings } = appSession();
  book.tileArt = { choice: heroArtInForce(settings.heroArt, heroPromoShown(earned, settings.promoArtOn)), earned };
  const seating = book.seating(options);
  const insights = book.insights(options, seating);
  const active = book.activeRoster(options);
  const { model: roster, keys } = rosterModelOf({
    book,
    draft,
    deckOptions: options,
    insights,
    active,
    packShelves: book.shelves(options, seating, active),
    drill: st.drill,
    recCollapsed: recommendedStartsCollapsed(st.recCollapsed, input.phone),
    leases,
  });
  const shelfOfKey = new Map<string, string>();
  for (const shelf of roster.shelves) for (const tile of shelf.tiles) shelfOfKey.set(tile.key, shelf.id);
  const conflicts = unresolvedConflictsOf(draft, options).length;
  const footer = footerModelOf(draft, book.tableLock(options));
  glyphs.reset();
  const playGlyph =
    padGlyphsShown(glyphs.snapshot) && footer.playBlocked === null
      ? glyphs.glyph("play", ["pause"], "ink", 52)
      : undefined;
  const backGlyph = glyphs.glyph("back", ["cancel"], "ink", 44, "inside");
  const group = st.decksKey === null ? undefined : book.heroGroups.get(st.decksKey);
  if (st.decksKey !== null && !group) st.decksKey = null;
  const activeDeckId = draft.seats[draft.activeSeatIndex];
  const page: SeatsPageModel = {
    header: headerOf(input.scene, width, draft.seats.length, backGlyph),
    seats: seatModelsOf(
      draft,
      options,
      leases,
      (rosterColumnWidthFor(width, height) - (MAX_SEATS - 1) * 6) / MAX_SEATS,
    ),
    pairs: pairModelsOf(insights),
    summary: wide
      ? null
      : summaryModelOf(
          draft,
          options.find((o) => (o.deck.id as string) === activeDeckId),
          st.detailsOpen,
        ),
    filters: filtersModelOf({
      draft,
      deckOptions: options,
      narrow: !wide,
      behindButton: input.behindButton,
      folded: input.folded,
      searchOpen: st.searchOpen,
      typed: input.typed,
      tipAspect: st.tipAspect,
      heroArt: book.tileArt.choice,
      randomAvailable: book.randomCandidates(options, seating, st.search.rankedFor).length > 0,
      rankedFor: st.search.rankedFor,
    }),
    roster: { ...roster, ...input.paging },
    detail: detailModelOf(draft, options, insights, st.hoverDeckId ?? st.focusDeckId),
    footer: playGlyph ? { ...footer, playGlyph } : footer,
    decks: group ? decksSheetOf(book, group, active, leases) : null,
    wide,
    hints: wide ? input.hints() : null,
    notice: conflicts > 0 ? `${conflictNoticeOf(conflicts)} ▸` : null,
  };
  glyphs.settled();
  const firstTileKey =
    keys.recIds[0] !== undefined
      ? `hero-rec:${keys.recIds[0]}`
      : keys.cardIds[0] !== undefined
        ? `hero:${keys.cardIds[0]}`
        : null;
  return { page, keys, shelfOfKey, insights, conflicts, wide, firstTileKey };
}
