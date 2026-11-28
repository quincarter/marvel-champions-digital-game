/** The pool as the list takes it: every card worded, with the refusals the campaign and the deck rules give. */
import type { AnyCard, Deck } from "@mc/content";
import { artFor, artLanguageNow } from "../../art/art-source.js";
import { localizedLabelOf } from "../../view/card-text.js";
import { customCardBadgeOf } from "../../view/custom-content.js";
import { cardInspectModel } from "../../view/inspect-model.js";
import { poolRowNote, poolTypeLine, subtitleCutFrom } from "../../view/deck-builder-model.js";
import { poolGridGeometry } from "../../view/deck-pool-grid.js";
import { t } from "../../i18n/translate.js";
import type { PoolCardModel } from "../../components/deck-builder/mc-pool-cell/mc-pool-cell.types.js";
import { POOL_MAX_COLUMNS } from "../../components/deck-builder/mc-pool-list/McPoolList.js";
import type { PoolListModel } from "../../components/deck-builder/mc-pool-list/mc-pool-list.types.js";
import type { BuilderState } from "./builder-state.js";
import type { ModelEnv } from "./model-env.js";

/** A list row's controls cluster and a grid cell's side padding, as the elements lay them out. */
const ROW_CONTROLS_WIDTH = 146;
/** The rendered px size of an 11px label on desktop (the desktop bump for sizes up to 12). */
const px = (size: number, desktop: boolean): number => (desktop && size <= 12 ? Math.min(13, size + 2) : size);

/** The card's title for a tile and the line below it that carries a subtitle the tile had no room for. */
function titleOf(
  card: AnyCard,
  width: number,
  desktop: boolean,
): { readonly shown: string; readonly cut: string | null } {
  const full = localizedLabelOf(card, artLanguageNow());
  const subtitle = "subtitle" in card ? card.subtitle : null;
  const fits = full.length * px(11, desktop) * 0.58 <= width;
  const short =
    subtitle && full.endsWith(`(${subtitle})`) ? full.slice(0, full.length - subtitle.length - 2).trim() : full;
  const shown = fits ? full : short;
  return { shown, cut: subtitleCutFrom(card, shown) };
}

/** One card as the pool draws it: its words, its copies in the deck, and what the campaign and the rules refuse. */
function cardModel(
  state: BuilderState,
  env: ModelEnv,
  deck: Deck,
  card: AnyCard,
  width: number,
  grid: boolean,
): PoolCardModel {
  const cardId = card.id as string;
  const quantity = deck.cards.find((line) => line.cardId === card.id)?.quantity ?? 0;
  const campaignRow = state.campaignRowFor(cardId);
  const lang = artLanguageNow();
  const { shown, cut } = titleOf(card, width, env.desktop);
  const note = state.campaign ? null : poolRowNote(card, state.identity!, deck.aspects);
  // Card view's caption: why a card is offered, or what the campaign says of it, else its type line.
  const caption = campaignRow?.locked
    ? t("deckBuilder.campaignGrant")
    : campaignRow?.refused
      ? t("deckBuilder.removedFromCampaign")
      : cut && note
        ? `${cut} · ${note}`
        : (note ?? cut ?? poolTypeLine(card));
  // List view's lines.
  let typeLine = "";
  let rules = "";
  if (!grid) {
    const typeBase = cut ? `${cut} · ${poolTypeLine(card)}` : poolTypeLine(card);
    // A card from an installed custom pack says so in words.
    const customBadge = customCardBadgeOf(cardId);
    const typeText = customBadge ? `${typeBase} · ${customBadge}` : typeBase;
    // MC27 p. 22's Enhanced side, named on its own in front of "campaign grant".
    const faceLabel = campaignRow?.face ? ` · ${campaignRow.face} (Enhanced)` : "";
    typeLine = campaignRow?.locked
      ? `${typeText} · ${t("deckBuilder.campaignGrant")}${faceLabel}`
      : campaignRow?.refused
        ? `${typeText} · ${t("deckBuilder.removedFromCampaign")}`
        : typeText;
    rules = cardInspectModel(card, campaignRow?.face ? { kind: "flipSide" } : { kind: "front" }).rulesText ?? "";
  }
  const frozen = state.campaignModel?.editingDisabled ?? false;
  const frozenReason = state.campaignModel?.editingDisabledReason ?? undefined;
  // The rule settings (issue #531) only matter where nothing else already disables the button.
  const minusRefused = quantity > 0 ? state.ruleRefusal(deck, card.id, -1) : null;
  const plusRefused = state.ruleRefusal(deck, card.id, 1);
  // A save in flight: the deck being written must not change under it.
  const saving = state.busy;
  const minusOff = saving || !(quantity > 0 && !(campaignRow?.locked ?? false) && !frozen && minusRefused === null);
  const minusReason = frozen ? frozenReason : (campaignRow?.lockedReason ?? minusRefused ?? undefined);
  const plusOff = saving || (campaignRow?.refused ?? false) || frozen || plusRefused !== null;
  const plusReason = frozen ? frozenReason : (campaignRow?.refusedReason ?? plusRefused ?? undefined);
  return {
    cardId,
    picture: env.scan(artFor(card, { kind: "front" }), localizedLabelOf(card, lang)),
    title: shown,
    cost: "cost" in card && typeof card.cost === "number" ? card.cost : null,
    caption,
    captionStrong: Boolean(note || campaignRow),
    typeLine,
    note,
    rules,
    quantity,
    minus: { aria: t("deckBuilder.removeCopy", { name: shown }), disabled: minusOff ? (minusReason ?? true) : null },
    plus: { aria: t("deckBuilder.addCopy", { name: shown }), disabled: plusOff ? (plusReason ?? true) : null },
    face: campaignRow?.face ?? null,
  };
}

/** The list's own width as the layout gives it: what titles are fitted to (the cells' columns follow the real box). */
export function poolListModel(
  state: BuilderState,
  env: ModelEnv,
  deck: Deck,
  pool: readonly AnyCard[],
  listWidth: number,
): PoolListModel {
  const grid = state.poolView === "grid";
  // A phone's column takes three smaller cards across rather than two big ones, so a screen shows more than one row.
  const cardScale = env.cardScale * (env.layout === "phone" ? 0.8 : 1);
  const geometry = grid ? poolGridGeometry(listWidth, pool.length, false, cardScale, POOL_MAX_COLUMNS) : null;
  const width = geometry
    ? geometry.cellWidth - 8 - 12
    : listWidth - 8 - ROW_CONTROLS_WIDTH - 16 - env.rows.cardThumbWidth;
  const searched = state.filterText.trim();
  return {
    view: state.poolView,
    count: pool.length,
    cardAt: (index) => cardModel(state, env, deck, pool[index]!, width, grid),
    cardScale,
    rowHeight: env.rows.cardRowHeight,
    thumbWidth: env.rows.cardThumbWidth,
    desktop: false,
    empty:
      pool.length > 0
        ? null
        : state.poolSearch?.pending
          ? t("pause.searching")
          : searched
            ? t("deckBuilder.noMatchSearch", { text: searched })
            : t("deckBuilder.noMatch"),
  };
}
