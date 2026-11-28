/**
 * "Pick a deck" (GitHub #219) as the plain model `mc-hero-decks-sheet` takes: a row per deck a hero tile stands for, worded
 * from the facts the shelf tile already used. It decides nothing: the scene seats the picked deck with the very code a
 * single-deck tile's tap runs, so blocked reasons, locked decks and name conflicts behave exactly as before.
 */
import { deckDisplayName, identityLabelOf } from "../../view/deck-names.js";
import { artLanguageNow } from "../../art/art-source.js";
import type { PackLeases } from "../../art/pack-art.js";
import { currentCardsById } from "../../content/pool.js";
import type { DecksSheetModel } from "../../components/seats/seats.types.js";
import { heroTilePictureOf } from "../../dom/hero-picture.js";
import { sheetColor } from "../../dom/sheet-builder.js";
import { t } from "../../i18n/translate.js";
import { surface } from "../../tokens.js";
import { aspectStampsOf, titleWithoutAspects } from "../../view/aspect-stamp.js";
import { testedSubtitleOf } from "../../view/community-decks-model.js";
import { shortWarningOf, type DeckOption } from "../../view/deck-list-model.js";
import { reasonLabelOf } from "../../view/deck-status.js";
import { heroDeckRowOf, type HeroDeckGroup } from "../../view/hero-deck-groups.js";
import { cardStampOf } from "../../view/seats-panel-model.js";
import { testedCatalog } from "../../view/seatable-decks.js";
import type { ActiveSeatRosterEntry } from "../../view/seat-slots.js";
import { deckLockOf, type SeatsBook } from "./seats-book.js";

/** A blocked reason worded for this screen, or null. */
const reasonOrNull = (reason: string | null): string | null =>
  reason === null ? null : reasonLabelOf(reason, artLanguageNow());

export function decksSheetOf(
  book: SeatsBook,
  group: HeroDeckGroup<DeckOption>,
  active: ReadonlyMap<string, ActiveSeatRosterEntry>,
  leases: PackLeases,
): DecksSheetModel {
  const identityId = group.rep.deck.identityCardId as string;
  const shown = heroTilePictureOf(book.heroPictureFor(identityId), currentCardsById().get(identityId), leases);
  const picture = {
    src: shown.src,
    fill: sheetColor(surface.parchment.hex, "fill"),
    cover: shown.cover,
    ...(shown.retry !== undefined ? { retry: shown.retry } : {}),
  };
  const decks = group.decks.map((option) => {
    const entry = active.get(option.deck.id as string);
    const deck = option.deck;
    const row = heroDeckRowOf({
      deckId: deck.id as string,
      name: titleWithoutAspects(deckDisplayName(deck).split(" — ")[0]!, deck.aspects),
      sourceKind: deck.source.kind,
      testedCredit: testedSubtitleOf(deck, testedCatalog()),
      cardCount: deck.cards.reduce((sum, card) => sum + card.quantity, 0),
      blockedBy: reasonOrNull(entry?.blockedBy ?? option.blockedReason),
      lock: deckLockOf(deck),
      warning: shortWarningOf(entry?.warning ?? option.warning, artLanguageNow()),
      activeSeat: entry?.isActiveSeat ?? false,
      otherSeat:
        entry?.seatIndex !== null && entry?.seatIndex !== undefined && !entry.isActiveSeat ? entry.seatIndex + 1 : null,
    });
    return {
      deckId: row.deckId,
      name: row.title,
      source: `${row.source} · ${row.cards}`,
      stamps: aspectStampsOf(deck.aspects, artLanguageNow()).map(cardStampOf),
      verdict: row.status,
      legal: row.statusKind === "ok",
      picture,
      seatLabel: row.action,
      disabled: row.enabled ? null : row.status,
      status: row.statusKind,
      ...(row.statusKind === "locked" ? { mark: t("seats.lockedMark") } : {}),
      cardId: identityId,
    };
  });
  return {
    title: identityLabelOf(group.rep) ?? deckDisplayName(group.rep.deck),
    subtitle: t("seats.decksSheetSubtitle", { count: decks.length }),
    backLabel: t("common.back"),
    decks,
  };
}
