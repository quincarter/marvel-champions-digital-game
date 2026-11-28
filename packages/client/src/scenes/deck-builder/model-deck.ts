/** The deck's own side as the elements take it: aspects, name, verdict, rewards, charts, the list, and the buttons. */
import { DECK_MIN_CARDS } from "@mc/engine";
import type { Deck } from "@mc/content";
import { artLanguageNow } from "../../art/art-source.js";
import { cssOf } from "../../ui/theme.js";
import { aspectStampOf } from "../../view/aspect-stamp.js";
import { aspectTipContentOf } from "../../view/aspect-tip-model.js";
import { SELECTABLE_ASPECTS, aspectCountFor, legalityOf, resetToPrecon } from "../../view/deck-builder-model.js";
import { campaignDeckSizeLabel, campaignDeckSizeSplit } from "../../view/campaign-deck-edit-model.js";
import {
  costCurveBars,
  deckCountText,
  deckListGroupsOf,
  deckListSortLabel,
  deckStatsOf,
  type DeckListEntry,
} from "../../view/deck-stats.js";
import { deckCopiesOf, drawOdds, oddsGroupsOf, oddsRowsOf, percentText } from "../../view/deck-odds.js";
import { currentStarterDecks } from "../../content/pool.js";
import { cardDisplayName } from "../../view/hero-names.js";
import { t } from "../../i18n/translate.js";
import type { AspectPickerModel } from "../../components/deck-builder/mc-aspect-picker/mc-aspect-picker.types.js";
import type { BuilderActionsModel } from "../../components/deck-builder/mc-builder-actions/mc-builder-actions.types.js";
import type { SaveBarModel } from "../../components/deck-builder/mc-builder-save-bar/mc-builder-save-bar.types.js";
import type { BuilderTabsModel } from "../../components/deck-builder/mc-builder-tabs/mc-builder-tabs.types.js";
import type { DeckChartsModel } from "../../components/deck-builder/mc-deck-charts/mc-deck-charts.types.js";
import type { DeckLineModel } from "../../components/deck-builder/mc-deck-line/mc-deck-line.types.js";
import type { DeckListModel } from "../../components/deck-builder/mc-deck-list/mc-deck-list.types.js";
import type { DeckNameModel } from "../../components/deck-builder/mc-deck-name/mc-deck-name.types.js";
import type { LegalityModel } from "../../components/deck-builder/mc-legality-lines/mc-legality-lines.types.js";
import type { OddsModel } from "../../components/deck-builder/mc-odds-panel/mc-odds-panel.types.js";
import type { RewardsModel } from "../../components/deck-builder/mc-rewards-strip/mc-rewards-strip.types.js";
import { DECK_BUILDER_TABS } from "../../view/deck-builder-tabs.js";
import type { BuilderState } from "./builder-state.js";
import { cardById } from "./pool-data.js";
import type { ModelEnv } from "./model-env.js";

export function aspectsModel(state: BuilderState, deck: Deck): AspectPickerModel {
  const frozen = state.campaignModel?.editingDisabled ?? false;
  const lang = artLanguageNow();
  return {
    label: t("deckBuilder.aspectLabel", { count: aspectCountFor(state.identity!) }),
    chips: SELECTABLE_ASPECTS.map((aspect) => {
      const stamp = aspectStampOf(aspect, lang);
      return {
        aspect,
        label: stamp.label,
        fill: cssOf(stamp.fill),
        ink: cssOf(stamp.ink),
        selected: deck.aspects.includes(aspect),
        disabled: frozen ? (state.campaignModel?.editingDisabledReason ?? "") : null,
        infoLabel: aspectTipContentOf(aspect) ? t("seats.aspectInfo", { aspect: stamp.label }) : null,
        infoOpen: state.aspectTipOpen === aspect,
      };
    }),
  };
}

export const nameModel = (deck: Deck): DeckNameModel => ({
  label: t("deckBuilder.deckName"),
  text: deck.name,
  placeholder: t("deckBuilder.deckName"),
  clearLabel: t("deckBuilder.clearSearch"),
});

/** The engine's own verdict in words (or a campaign's), the frozen reason, the unsaved note and the last status. */
export function legalityModel(state: BuilderState, deck: Deck): LegalityModel {
  const verdict = state.campaignModel ? state.campaignModel.validation : legalityOf(deck, state.pool());
  // Campaign mode's own count (the Briefing's "N cards + M pinned", MC10 p. 3): granted lines don't count toward deck size.
  const count = state.campaignModel
    ? campaignDeckSizeLabel(campaignDeckSizeSplit(state.campaignModel))
    : deckCountText(deckStatsOf(deck, state.pool()), artLanguageNow());
  return {
    text: verdict.ok
      ? t("deckBuilder.legal", { count })
      : t(verdict.problems.length === 1 ? "deckBuilder.problemOne" : "deckBuilder.problems", {
          count: verdict.problems.length,
          list: verdict.problems.map((p) => p.message).join(" "),
        }),
    ok: verdict.ok,
    frozen: state.campaignModel?.editingDisabledReason ?? null,
    dirty:
      !state.status && !state.campaign && state.isDirty()
        ? state.savedDeck
          ? t("deckBuilder.unsaved")
          : t("deckBuilder.notSaved")
        : null,
    status: state.status,
  };
}

/** Campaign mode's rewards (MC45 p. 24): every reward the seat chose, in the deck or not. Null with none. */
export function rewardsModel(state: BuilderState): RewardsModel | null {
  const rewards = state.campaignModel?.rewards ?? [];
  if (rewards.length === 0) return null;
  const frozen = state.campaignModel?.editingDisabled ?? false;
  return {
    label: t("deckBuilder.rewardsLabel"),
    rewards: rewards.map((reward) => {
      const card = state.pool().find((candidate) => candidate.id === reward.cardId);
      return {
        cardId: reward.cardId as string,
        name: card ? cardDisplayName(card) : (reward.cardId as string),
        status: reward.status,
        included: reward.included,
        toggleLabel: reward.toggleLabel,
        disabled: frozen ? (state.campaignModel?.editingDisabledReason ?? true) : state.busy ? true : null,
      };
    }),
  };
}

/** The narrow tab row's words: Pool, Deck with its live count, and From your games. */
export function tabsModel(state: BuilderState, deck: Deck, env: ModelEnv): BuilderTabsModel {
  const counted = state.campaignModel
    ? campaignDeckSizeSplit(state.campaignModel).counted
    : deckStatsOf(deck, state.pool()).countedCards;
  const label = (tab: (typeof DECK_BUILDER_TABS)[number]): string =>
    tab === "pool"
      ? t("deckBuilder.tabPool")
      : tab === "games"
        ? t("deckBuilder.tabGames")
        : counted < DECK_MIN_CARDS
          ? t("deckBuilder.tabDeckOf", { count: counted, min: DECK_MIN_CARDS })
          : t("deckBuilder.tabDeck", { count: counted });
  return {
    prefix: "tab:",
    selected: state.tab,
    tabs: DECK_BUILDER_TABS.map((id) => ({ id, label: label(id) })),
    glyph: env.glyph("tabs", ["zonePrevious", "zoneNext"], "paper", 14),
  };
}

export function railModel(state: BuilderState, env: ModelEnv): BuilderTabsModel {
  return {
    prefix: "rail:",
    selected: state.railTab,
    tabs: [
      { id: "deck", label: t("deckBuilder.railDeck") },
      { id: "games", label: t("deckBuilder.railGames") },
    ],
    glyph: env.glyph("rail", ["zonePrevious", "zoneNext"], "ink", 14),
  };
}

/** The draw odds (issue #531, `view/deck-odds.ts`). */
export function oddsModel(state: BuilderState, deck: Deck): OddsModel {
  const copies = deckCopiesOf(deck, (id) => cardById().get(id));
  const groups = oddsGroupsOf(copies);
  const none = { group: "", draws: "", canFewer: false, canMore: false, line: "", atLeast: "" };
  if (groups.length === 0) return { ...none, empty: t("deckBuilder.oddsEmpty") };
  const group =
    groups[
      Math.max(
        0,
        groups.findIndex((g) => g.id === state.oddsGroup),
      )
    ]!;
  const hand = state.identity?.alterEgo.handSize ?? 6;
  const draws = Math.min(state.oddsDraws ?? hand, copies.length);
  const { rows, atLeastOne } = oddsRowsOf(drawOdds(copies.length, group.count, draws));
  return {
    empty: null,
    group: `${group.label} · ${group.count}`,
    draws:
      draws === hand ? t("deckBuilder.oddsDrawOpening", { count: draws }) : t("deckBuilder.oddsDraw", { count: draws }),
    canFewer: draws > 1,
    canMore: draws < copies.length,
    line: rows.map((row) => `${row.label}: ${percentText(row.p)}`).join("   "),
    atLeast: t("deckBuilder.oddsAtLeast", { p: percentText(atLeastOne) }),
  };
}

/** The cost curve: a bar per cost (the last "N+"), blue (spent colour for the last). */
export function chartsModel(state: BuilderState, deck: Deck): DeckChartsModel {
  const stats = deckStatsOf(deck, state.pool());
  const bars = costCurveBars(stats);
  return {
    curveLabel: t("deckBuilder.costCurveLabel"),
    curveTab: t("deckBuilder.chartCurve"),
    oddsLabel: t("deckBuilder.oddsLabel"),
    oddsTab: t("deckBuilder.chartOdds"),
    bars: bars.map((bar, index) => ({
      label: bar.label,
      count: bar.count,
      highlight: false,
      tint: index === bars.length - 1 ? "var(--mc-fill-spent)" : "var(--mc-fill-cost)",
    })),
    odds: oddsModel(state, deck),
  };
}

/** "Your deck": every line (none folded into "+ N more"), each with its own "-" while the deck can be edited. */
export function deckListModel(state: BuilderState, deck: Deck, reviewInBar: boolean): DeckListModel {
  const frozen = state.campaignModel?.editingDisabled ?? false;
  const noteOf = (entry: DeckListEntry): string | null => {
    if (!state.campaign) return null;
    const row = state.campaignRowFor(entry.cardId as string);
    const faceNote = row?.face ? `On its ${row.face} (Enhanced) side. ` : "";
    const reason = row?.lockedReason ?? row?.refusedReason ?? row?.rewardNote ?? null;
    return faceNote ? `${faceNote}${reason ?? ""}`.trim() : reason;
  };
  const line = (entry: DeckListEntry): DeckLineModel => {
    const cardId = entry.cardId as string;
    const row = state.campaignRowFor(cardId);
    const refused = state.ruleRefusal(deck, entry.cardId, -1);
    const off = (row?.locked ?? false) || frozen || refused !== null;
    return {
      cardId,
      name: entry.name,
      quantity: entry.quantity,
      note: noteOf(entry),
      minus: {
        aria: t("deckBuilder.removeCopy", { name: entry.name }),
        disabled: off
          ? frozen
            ? (state.campaignModel?.editingDisabledReason ?? true)
            : (row?.lockedReason ?? refused ?? true)
          : null,
      },
      // A campaign-granted line is otherwise a dead end for "what does this card do": a press opens Inspect on its face.
      openOnTap: state.campaign !== null && (row?.locked ?? false),
      face: row?.face ?? null,
    };
  };
  return {
    label: t("deckBuilder.yourDeck"),
    sortLabel: deckListSortLabel(state.deckSort),
    reviewLabel: reviewInBar ? null : t("deckBuilder.review"),
    reviewDisabled: state.busy,
    groups: deckListGroupsOf(deck, state.pool(), state.deckSort)
      .filter((group) => group.entries.length > 0)
      .map((group) => ({ label: `${group.label} · ${group.count}`, lines: group.entries.map(line) })),
  };
}

/** Precon / Clear / Delete and the campaign's optional freeze. A campaign's deck has neither Precon nor Clear (MC10 p. 3). */
export function actionsModel(state: BuilderState, deck: Deck): BuilderActionsModel {
  const campaign = state.campaign;
  const canDelete = !campaign && state.savedDeck !== null;
  const precon = !campaign ? resetToPrecon(deck, state.identity!, currentStarterDecks()) : null;
  return {
    precon: campaign
      ? null
      : {
          label: canDelete ? t("deckBuilder.preconShort") : t("deckBuilder.precon"),
          disabled: precon === null ? t("deckBuilder.noPrecon") : null,
        },
    clear: campaign ? null : { label: t("deckBuilder.clear"), disabled: null },
    delete: canDelete
      ? {
          label: state.deleteArmed ? t("deckBuilder.confirmDelete") : t("deckBuilder.delete"),
          armed: state.deleteArmed,
          disabled: state.busy ? true : null,
        }
      : null,
    freeze: campaign?.optionalFreeze?.eligible ? { label: t("deckBuilder.freeze"), disabled: null } : null,
  };
}

export function saveModel(state: BuilderState, reviewInBar: boolean): SaveBarModel {
  const frozen = state.campaignModel?.editingDisabled ?? false;
  return {
    save: {
      label: state.busy
        ? t("deckBuilder.saving")
        : state.campaign
          ? t("deckBuilder.saveChanges")
          : state.isDirty()
            ? t("deckBuilder.saveDeck")
            : t("deckBuilder.saved"),
      disabled: frozen ? (state.campaignModel?.editingDisabledReason ?? true) : state.busy ? true : null,
    },
    review: reviewInBar ? { label: t("deckBuilder.review"), disabled: state.busy ? true : null } : null,
  };
}
