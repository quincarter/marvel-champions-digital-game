/**
 * The deck builder's page model: everything the page shows, computed from the builder's state and the screen's size. Every
 * number and every verdict is the engine's own (`validateDeck`, `deckStatsOf`), the campaign model's or the rules settings';
 * this decides nothing, it words and arranges.
 */
import type { AnyCard } from "@mc/content";
import { aspectTipContentOf } from "../../view/aspect-tip-model.js";
import { t } from "../../i18n/translate.js";
import type {
  AspectTipModel,
  BuildModel,
  DeckBuilderPageModel,
} from "../../views/deck-builder/mc-deck-builder-page/mc-deck-builder-page.types.js";
import type { BuilderState } from "./builder-state.js";
import {
  aspectsModel,
  chartsModel,
  actionsModel,
  deckListModel,
  legalityModel,
  nameModel,
  railModel,
  rewardsModel,
  saveModel,
  tabsModel,
} from "./model-deck.js";
import {
  foldModel,
  quickFiltersModel,
  packSortModel,
  searchModel,
  showTogglesModel,
  typeFiltersModel,
} from "./model-filters.js";
import { gamesModel } from "./model-games.js";
import { headerModel, identityRowModel, pickerModel, startModel } from "./model-identity.js";
import { poolListModel } from "./model-pool.js";
import type { ModelEnv } from "./model-env.js";

/** The wide layout's rails and gap (D04), and the page's padding, for the pool column's width. */
const LEFT_RAIL = 230;
const RIGHT_RAIL = 300;
const RAIL_GAP = 24;
const SCROLLBAR = 10;

/** How wide the pool list is, as the layout gives it: card titles are fitted to it. */
export function poolWidthOf(env: ModelEnv): number {
  const pad = env.layout === "phone" ? 16 : 40;
  if (env.layout === "wide") {
    const column = env.width - pad * 2;
    return Math.max(240, column - LEFT_RAIL - RIGHT_RAIL - RAIL_GAP * 2) - SCROLLBAR;
  }
  return Math.min(env.width - pad * 2, 720) - SCROLLBAR;
}

function tipModel(state: BuilderState): AspectTipModel | null {
  const aspect = state.aspectTipOpen;
  const content = aspect ? aspectTipContentOf(aspect) : null;
  if (!aspect || !content) return null;
  return {
    aspect,
    heading: content.title,
    tagline: content.tagline,
    body: content.tipLine,
    linkLabel: content.linkLabel,
    linkReason: content.linkReason ?? "",
    linkAvailable: content.linkAvailable,
  };
}

function buildModel(state: BuilderState, env: ModelEnv, pool: readonly AnyCard[]): BuildModel {
  const deck = state.deck!;
  const identity = state.identity!;
  const countText = t(pool.length === 1 ? "deckBuilder.cardCountOne" : "deckBuilder.cardCount", { count: pool.length });
  const reviewInBar = env.layout !== "wide" && state.tab === "deck";
  return {
    identity: identityRowModel(identity, env),
    aspects: aspectsModel(state, deck),
    name: state.campaign ? null : nameModel(deck),
    legality: legalityModel(state, deck),
    rewards: rewardsModel(state),
    tabs: tabsModel(state, deck, env),
    rail: railModel(state, env),
    tab: state.tab,
    railTab: state.railTab,
    chartTab: state.chartTab,
    types: typeFiltersModel(state),
    shows: showTogglesModel(state, countText),
    quick: quickFiltersModel(state),
    packs: packSortModel(state),
    search: searchModel(state),
    fold: env.folded ? foldModel(state) : null,
    countText,
    poolLabel: env.layout === "wide" ? t("deckBuilder.cardPoolLabel") : t("deckBuilder.poolLabel"),
    pool: poolListModel(state, env, deck, pool, poolWidthOf(env)),
    charts: chartsModel(state, deck),
    deckList: deckListModel(state, deck, reviewInBar),
    games: gamesModel(state, env, deck, pool),
    actions: actionsModel(state, deck),
    save: saveModel(state, reviewInBar),
  };
}

/** The page's model for the step the builder is on, and the cards the pool lists now (the focus route's `card:<id>` stops). */
export function pageModel(
  state: BuilderState,
  env: ModelEnv,
): { readonly model: DeckBuilderPageModel; readonly pool: readonly AnyCard[] } {
  const header = headerModel(state, env);
  if (!state.identity && state.startFor)
    return {
      model: { stage: "start", header, pick: null, start: startModel(state.startFor, env), build: null, tip: null },
      pool: [],
    };
  if (!state.identity || !state.deck)
    return {
      model: { stage: "pick", header, pick: pickerModel(state, env), start: null, build: null, tip: null },
      pool: [],
    };
  state.refreshCampaign();
  const pool = state.browsable(state.deck, state.identity);
  return {
    model: {
      stage: "build",
      header,
      pick: null,
      start: null,
      build: buildModel(state, env, pool),
      tip: tipModel(state),
    },
    pool,
  };
}
