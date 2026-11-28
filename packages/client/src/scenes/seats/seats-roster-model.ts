/**
 * The hero roster of Take your seats as the plain model `mc-seats-roster` takes: the Recommended shelf first, then a shelf
 * per release wave or letter, or one pack opened as a full grid. A tile says what the engine's seat options say of its
 * deck (`ActiveSeatRosterEntry`): seated, blocked, locked, warned. Nothing here decides what may be seated.
 */
import { artLanguageNow } from "../../art/art-source.js";
import type { PackLeases } from "../../art/pack-art.js";
import { currentCardsById } from "../../content/pool.js";
import type { HeroShelfModel, HeroTileModel, SeatsRosterModel } from "../../components/seats/seats.types.js";
import { heroTilePictureOf } from "../../dom/hero-picture.js";
import { sheetColor } from "../../dom/sheet-builder.js";
import { t, tPlural } from "../../i18n/translate.js";
import { surface } from "../../tokens.js";
import { aspectStampsOf, titleWithoutAspects } from "../../view/aspect-stamp.js";
import { isCommunityDeckId, testedSubtitleOf } from "../../view/community-decks-model.js";
import { customBadge, customBadgeOf } from "../../view/custom-content.js";
import { shortWarningOf, type DeckOption } from "../../view/deck-list-model.js";
import { blockedTagOf } from "../../view/deck-status.js";
import { deckCountTagOf } from "../../view/hero-deck-groups.js";
import { formatCount } from "../../view/number-format.js";
import { testedCatalog } from "../../view/seatable-decks.js";
import type { SeatInsights } from "../../view/seat-recommendations.js";
import type { ActiveSeatRosterEntry } from "../../view/seat-slots.js";
import { cardStampOf } from "../../view/seats-panel-model.js";
import { openShelfItems, shelfFocusKeys } from "../../view/shelf-folds.js";
import type { Shelf } from "../../view/roster-shelves.js";
import type { ShelfDrillState } from "../../view/shelf-drill.js";
import type { SetupDraft } from "../../view/setup-draft.js";
import { unlockCostOf } from "../unlock-confirm.js";
import { REC_SHELF_ID, deckLockOf, type SeatsBook } from "./seats-book.js";

/** "Precon + Tested": the kinds of deck a multi-deck hero tile stands for, each once. */
function sourceWordsOf(options: readonly DeckOption[]): string {
  const word = (option: DeckOption): string =>
    isCommunityDeckId(option.deck.id as string)
      ? t("deckSource.tested")
      : option.deck.source.kind === "precon"
        ? t("deckSource.precon")
        : option.deck.source.kind === "imported"
          ? t("deckSource.imported")
          : t("deckSource.built");
  return [...new Set(options.map(word))].join(", ");
}

export interface RosterView {
  readonly book: SeatsBook;
  readonly draft: SetupDraft;
  readonly deckOptions: readonly DeckOption[];
  readonly insights: SeatInsights;
  readonly active: ReadonlyMap<string, ActiveSeatRosterEntry>;
  readonly packShelves: readonly Shelf<DeckOption>[];
  readonly drill: ShelfDrillState;
  readonly recCollapsed: boolean;
  readonly leases: PackLeases;
}

/** The focus keys the route's order is built from. */
export interface RosterKeys {
  readonly cardIds: readonly string[];
  readonly shelfStopKeys: readonly string[] | undefined;
  readonly recIds: readonly string[];
  readonly hasRecommended: boolean;
}

/** One deck's tile: the hero's tile copy of its picture, its words, and the marks that say what the roster says of it. */
export function heroTileOf(
  view: RosterView,
  option: DeckOption,
  recommended: boolean,
  keyOf: (id: string) => string,
): HeroTileModel {
  const { book, draft, active, insights } = view;
  const identityId = option.deck.identityCardId as string;
  const identity = currentCardsById().get(identityId);
  const entry = active.get(option.deck.id as string);
  const sourceText =
    testedSubtitleOf(option.deck, testedCatalog()) ??
    t(
      option.deck.source.kind === "precon"
        ? "deckSource.precon"
        : option.deck.source.kind === "imported"
          ? "deckSource.imported"
          : "deckSource.built",
    );
  const seatedElsewhere = entry?.seatIndex !== null && entry?.seatIndex !== undefined && !entry.isActiveSeat;
  // A deck seated elsewhere gets only its short "SEAT N" tag; a genuinely illegal or duplicate deck gets "AT THE TABLE"
  // instead of its own full sentence, which truncated in the caption (the full reason is one Inspect away).
  const blockedBy = seatedElsewhere ? null : (entry?.blockedBy ?? null);
  const lock = seatedElsewhere ? null : deckLockOf(option.deck);
  // A hero with several matching decks is one tile: the hero's name, every aspect its decks wear, "N decks".
  const decks = recommended ? [option] : (book.groupOf(option)?.decks ?? [option]);
  const several = decks.length > 1;
  const countTag = deckCountTagOf(decks.length, decks.filter((d) => d.deck.source.kind !== "precon").length);
  const aspects = [...new Set(decks.flatMap((d) => d.deck.aspects))];
  const tag = entry?.isActiveSeat
    ? t("seats.seatLabel", { seat: draft.activeSeatIndex + 1 })
    : seatedElsewhere
      ? t("seats.seatLabel", { seat: entry!.seatIndex! + 1 })
      : lock
        ? t("scenario.locked")
        : blockedBy
          ? blockedTagOf(blockedBy)
          : [decks.some((d) => customBadgeOf(d.deck) !== null) ? customBadge() : null, countTag]
              .filter((part) => part !== null)
              .join(" · ") || null;
  const rec = insights.analysis.get(option.deck.id as string);
  const name = option.identityName ?? option.deck.name;
  const shown = heroTilePictureOf(book.heroPictureFor(identityId), identity, view.leases);
  return {
    key: keyOf(option.deck.id as string),
    cardId: identityId,
    title: several ? name : titleWithoutAspects(option.deck.name.split(" — ")[0]!, option.deck.aspects),
    // A recommended tile says why in the line a normal tile uses for its source.
    subtitle:
      recommended && rec?.caption
        ? rec.caption
        : several
          ? t("seats.decksSummary", { count: formatCount(decks.length), sources: sourceWordsOf(decks) })
          : `${sourceText} · ${option.identityName ?? t("seats.unknownIdentity")}`,
    // Locked: the free way (the villain to beat) and the paid one (tap it to spend points), side by side.
    warning: seatedElsewhere
      ? null
      : lock
        ? t("seats.lockOrPoints", { lock, cost: unlockCostOf({ kind: "hero", identityCardId: identityId }) })
        : shortWarningOf(entry?.warning ?? null, artLanguageNow()),
    stamps: aspectStampsOf(several ? aspects : option.deck.aspects, artLanguageNow()).map(cardStampOf),
    tag,
    plate:
      rec && rec.teamUps.length > 0 && !seatedElsewhere && !entry?.isActiveSeat
        ? t("seats.teamUpWith", { names: rec.teamUps.map((link) => link.partner).join(" + ") })
        : null,
    selected: entry?.isActiveSeat ?? false,
    dim: blockedBy !== null,
    picture: {
      src: shown.src,
      fill: sheetColor(surface.parchment.hex, "fill"),
      cover: shown.cover,
      ...(shown.retry !== undefined ? { retry: shown.retry } : {}),
    },
    inspect: true,
  };
}

/** The roster model and the keys the route is ordered by. */
export function rosterModelOf(view: RosterView): { readonly model: SeatsRosterModel; readonly keys: RosterKeys } {
  const { draft, drill, packShelves, insights, deckOptions } = view;
  const common = {
    clearLabel: t("scenario.clear"),
    previousLabel: t("seats.shelfPrevious"),
    nextLabel: t("seats.shelfNext"),
    pagingHintShelf: null,
  };
  if (drill.packId !== null) {
    const shelf = packShelves.find((s) => s.id === drill.packId);
    const items = shelf?.items ?? [];
    const tiles = items.map((option) => heroTileOf(view, option, false, (id) => `hero:${id}`));
    const empty = items.length === 0;
    return {
      model: {
        ...common,
        mode: "grid",
        shelves: [{ id: shelf?.id ?? "pack", title: shelf?.title ?? "", count: "", cover: null, seeAll: "", tiles }],
        drillBack: t("scenario.allPacks"),
        emptyText: empty ? t("scenario.noMatches") : null,
      },
      keys: {
        cardIds: items.map((o) => o.deck.id as string),
        shelfStopKeys: undefined,
        recIds: [],
        hasRecommended: false,
      },
    };
  }
  // The first shelf: the heroes worth a look for this seat, with the reason as the caption. Folding it leaves its header.
  const recOptions = insights.recommended.flatMap((rec) => {
    const option = deckOptions.find((o) => (o.deck.id as string) === rec.deckId);
    return option ? [option] : [];
  });
  const recShelf: Shelf<DeckOption> | null =
    recOptions.length > 0
      ? {
          id: REC_SHELF_ID,
          title: t("seats.recommendedFor", { seat: draft.activeSeatIndex + 1 }),
          items: recOptions,
          ...(view.recCollapsed ? { collapsed: true } : {}),
        }
      : null;
  const shelves = recShelf ? [recShelf, ...packShelves] : packShelves;
  const models: HeroShelfModel[] = shelves.map((shelf) => {
    const rec = shelf.id === REC_SHELF_ID;
    const folded = shelf.collapsed === true;
    return {
      id: shelf.id,
      title: shelf.title,
      count: rec
        ? `${tPlural("seats.heroCount", shelf.items.length)}  ·  ${view.recCollapsed ? t("seats.show") : t("seats.hide")}`
        : `${tPlural("seats.identityCount", shelf.items.length)}  ·`,
      cover: null,
      open: !folded,
      seeAll: rec ? "" : `${t("scenario.seeAll")} ▸`,
      tiles: folded
        ? []
        : shelf.items.map((option) => heroTileOf(view, option, rec, (id) => `${rec ? "hero-rec" : "hero"}:${id}`)),
    };
  });
  const stopKeys = shelfFocusKeys(packShelves, "hero-shelf", "hero", (o) => o.deck.id as string);
  return {
    model: {
      ...common,
      mode: "shelves",
      shelves: models,
      drillBack: null,
      emptyText: shelves.length === 0 ? t("scenario.noMatches") : null,
    },
    keys: {
      cardIds: openShelfItems(packShelves).map((o) => o.deck.id as string),
      shelfStopKeys: stopKeys.length > 0 ? stopKeys : undefined,
      recIds: recShelf && !view.recCollapsed ? recOptions.map((o) => o.deck.id as string) : [],
      hasRecommended: recShelf !== null,
    },
  };
}
