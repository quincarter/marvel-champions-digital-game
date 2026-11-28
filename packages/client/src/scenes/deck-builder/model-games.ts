/**
 * "From your games" as the panel takes it (issue #529, C2): how this hero's finished games go, cards in this deck that
 * rarely come out (Cut), cards won with on this hero that the deck may take (Add), and the staples. Suggestions only: a
 * press on Cut or Add is the same as the deck list's - or the pool's +, and the scene checks it again.
 */
import type { AnyCard, CardId, Deck } from "@mc/content";
import { artFor } from "../../art/art-source.js";
import {
  NOTHING_STANDS_OUT,
  againstStepOf,
  againstVillainOf,
  fromYourGamesOf,
  type DeckInsights,
  type SuggestedCard,
} from "../../view/deck-insights.js";
import { globalVillainDecksOf } from "../../global-stats/global-stats-model.js";
import { readConsent } from "../../global-stats/global-consent.js";
import {
  AGAINST_LABELS,
  AGAINST_NOTE_FINISH,
  AGAINST_NOTE_NONE,
  AGAINST_NOTE_READING,
  AGAINST_NOTE_SHARE_IN_SETTINGS,
  AGAINST_NOTE_STALE,
  AGAINST_NOTE_UNAVAILABLE,
  globalRowFailed,
  shareLabel,
  shareLine,
  type AgainstSource,
} from "../../view/global-stats-ui.js";
import { POOL_STATS_NAMES } from "../../view/player-stats-names.js";
import { campaignRefusesAdd, campaignRefusesCut } from "../../view/campaign-deck-edit-model.js";
import { t } from "../../i18n/translate.js";
import type { GamesAgainstModel } from "../../components/deck-builder/mc-games-against/mc-games-against.types.js";
import type { GamesPanelModel } from "../../components/deck-builder/mc-games-panel/mc-games-panel.types.js";
import type { GamesRowModel } from "../../components/deck-builder/mc-games-row/mc-games-row.types.js";
import type { GamesSectionModel } from "../../components/deck-builder/mc-games-section/mc-games-section.types.js";
import type { BuilderState } from "./builder-state.js";
import { cardById, poolVillainNames } from "./pool-data.js";
import type { ModelEnv } from "./model-env.js";

/** The villain the Against block reads for `source`: the one the stepper rests on, else the first of its list. */
export function againstVillainFor(state: BuilderState, source: AgainstSource): string | undefined {
  const list = againstStepOf(state.insights!, poolVillainNames(), source);
  return list.includes(state.againstVillain ?? "") ? state.againstVillain! : list[0];
}

const shareLineOf = (state: BuilderState): string =>
  state.shareFailed ? `${globalRowFailed()} ${shareLine()}` : shareLine();

/** The Against block: the villain stepper, whose decks, why there is nothing to read yet, and Share. */
function againstModel(
  state: BuilderState,
  villain: string | undefined,
  theirs: ReturnType<BuilderState["againstGlobal"]["get"]>,
): GamesAgainstModel {
  const everyone = state.againstSource === "everyone";
  const faced = againstStepOf(state.insights!, poolVillainNames(), state.againstSource);
  const note =
    villain === undefined
      ? AGAINST_NOTE_FINISH
      : everyone && theirs?.kind !== "ready"
        ? theirs === undefined || theirs.kind === "reading"
          ? AGAINST_NOTE_READING
          : theirs.kind === "none"
            ? AGAINST_NOTE_NONE
            : AGAINST_NOTE_UNAVAILABLE
        : theirs?.kind === "ready" && theirs.stale
          ? AGAINST_NOTE_STALE
          : null;
  // Sharing is off: one press turns it on (the games finished so far are never sent). Turning it off stays in Settings.
  const sharing = everyone && readConsent() !== "on";
  if (sharing) state.shareShownAt ??= performance.now();
  else state.shareShownAt = null;
  return {
    stepper:
      villain === undefined
        ? null
        : {
            headline: "",
            steppable: faced.length > 1,
            previousLabel: t("deckBuilder.gamesPreviousVillain"),
          },
    sources: (["yours", "everyone"] as const).map((id) => ({
      id,
      label: AGAINST_LABELS[id],
      chosen: state.againstSource === id,
    })),
    note: sharing && note === null ? AGAINST_NOTE_SHARE_IN_SETTINGS : note,
    share: sharing ? { label: shareLabel(), line: shareLineOf(state) } : null,
  };
}

export function gamesModel(
  state: BuilderState,
  env: ModelEnv,
  deck: Deck,
  browsable: readonly AnyCard[],
): GamesPanelModel {
  const none: GamesPanelModel = {
    reading: null,
    headline: null,
    insight: null,
    first: [],
    against: null,
    then: [],
    nothing: null,
    note: null,
  };
  const insights = state.insights;
  if (!insights) return { ...none, reading: t("deckBuilder.gamesReading") };
  const pool = new Set(browsable.map((card) => card.id as string));
  // The same refusals the pool's -/+ read: a suggestion never cuts a campaign's granted card, or adds a refused one.
  const frozen = state.campaignModel?.editingDisabled ?? false;
  const canCut = (entry: SuggestedCard): boolean =>
    !campaignRefusesCut(state.campaignRowFor(entry.cardId), frozen) &&
    state.ruleRefusal(deck, entry.cardId as CardId, -1) === null;
  const canAdd = (entry: SuggestedCard): boolean =>
    pool.has(entry.cardId) &&
    !campaignRefusesAdd(state.campaignRowFor(entry.cardId), frozen) &&
    state.ruleRefusal(deck, entry.cardId as CardId, 1) === null;
  const held = deck.cards.map((line) => line.cardId as string);
  const view = fromYourGamesOf(insights, deck.identityCardId as string, held, deck.aspects, POOL_STATS_NAMES);
  const cutLabel = t("deckBuilder.gamesCutLabel");
  const addLabel = t("deckBuilder.gamesAddLabel");
  const section = (
    id: string,
    title: string,
    cards: readonly SuggestedCard[],
    action: { readonly label: string; readonly kind: "add" | "remove" } | null,
  ): GamesSectionModel => ({
    id,
    title,
    rows: cards.map((entry): GamesRowModel => {
      const card = cardById().get(entry.cardId);
      const name = card?.name ?? entry.cardId;
      return {
        cardId: entry.cardId,
        name,
        detail: entry.detail,
        picture: env.scan(card ? artFor(card, { kind: "front" }) : null, name),
        action,
      };
    }),
  });
  const first = [
    section("cut", t("deckBuilder.gamesCutTitle"), view.cut.filter(canCut), { label: cutLabel, kind: "remove" }),
    section("try", t("deckBuilder.gamesTryTitle"), view.tryCards.filter(canAdd), { label: addLabel, kind: "add" }),
  ];
  const villain = againstVillainFor(state, state.againstSource);
  const everyone = state.againstSource === "everyone";
  const theirs = everyone && villain !== undefined ? state.againstGlobal.get(villain) : undefined;
  const insightsHere: DeckInsights =
    villain !== undefined && theirs?.kind === "ready"
      ? { heroes: {}, decks: {}, villains: { [villain]: globalVillainDecksOf(theirs.data) } }
      : insights;
  const against =
    villain === undefined || (everyone && theirs?.kind !== "ready")
      ? null
      : againstVillainOf(insightsHere, villain, deck.identityCardId as string, held, deck.aspects, POOL_STATS_NAMES);
  const block = againstModel(state, villain, theirs);
  const stepper =
    block.stepper && villain !== undefined
      ? { ...block.stepper, headline: against?.headline ?? t("deckBuilder.gamesAgainst", { villain }) }
      : null;
  // A card the lists above already offer keeps its one button (and its one stop).
  const offered = new Set([...view.cut, ...view.tryCards].map((entry) => entry.cardId));
  const wins = against?.tryCards.filter((entry) => canAdd(entry) && !offered.has(entry.cardId)) ?? [];
  const losses = against?.cutCards.filter((entry) => canCut(entry) && !offered.has(entry.cardId)) ?? [];
  const then = [
    section("wins", everyone ? t("deckBuilder.gamesTryEveryone") : t("deckBuilder.gamesTryYours"), wins, {
      label: addLabel,
      kind: "add",
    }),
    section("losses", everyone ? t("deckBuilder.gamesCutEveryone") : t("deckBuilder.gamesCutYours"), losses, {
      label: cutLabel,
      kind: "remove",
    }),
    section("keep", t("deckBuilder.gamesKeepTitle"), view.keep, null),
  ];
  return {
    reading: null,
    headline: view.headline || null,
    insight: view.insight || null,
    first,
    against: { ...block, stepper },
    then,
    nothing: against ? (against.note ?? (wins.length + losses.length === 0 ? NOTHING_STANDS_OUT : null)) : null,
    note: view.note || null,
  };
}
