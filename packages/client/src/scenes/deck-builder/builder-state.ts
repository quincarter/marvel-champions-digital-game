/**
 * Everything the deck builder remembers while it is open, and the lists it derives from that: the pool the player may
 * browse, the rules' and the campaign's refusals, and whether there are unsaved changes. No Phaser and no drawing: the
 * scene turns this into the page's model (`builder-model.ts`) and answers the page's events (`builder-actions.ts`).
 */
import type { AnyCard, CardId, CoreAspect, Deck, HeroIdentityCard } from "@mc/content";
import { requiredIdentitySet } from "@mc/engine";
import type { GlobalVillainCards } from "@mc/sync-worker/global-protocol";
import { appSession } from "../../session.js";
import { campaignPool } from "../../content/campaign-pool.js";
import {
  DEFAULT_POOL_SORT,
  browsablePool,
  deckRuleRefusals,
  hasUnsavedChanges,
  type DeckBuildingRules,
  type PoolFilter,
  type PoolSort,
} from "../../view/deck-builder-model.js";
import type { DeckListSort } from "../../view/deck-stats.js";
import type { DeckBuilderTab } from "../../view/deck-builder-tabs.js";
import type { DeckInsights } from "../../view/deck-insights.js";
import type { AgainstSource } from "../../view/global-stats-ui.js";
import type { GlobalLoad } from "../../global-stats/global-stats-client.js";
import {
  campaignDeckEditModel,
  prohibitedCampaignCardIds,
  removedFromCampaignCardIds,
  type CampaignDeckEditModel,
  type CampaignDeckEditRow,
} from "../../view/campaign-deck-edit-model.js";
import { CardPoolSearch } from "../../view/card-pool-search.js";
import type { DeckSearchClient } from "../../view/deck-search-client.js";
import type { CampaignReturn } from "../campaign/routes.js";
import { packInfos, poolNow } from "./pool-data.js";
import type { PoolView } from "../../components/deck-builder/mc-pool-list/mc-pool-list.types.js";
import type { DeckBuilderCampaignData } from "../deck-builder.js";

/** The rule settings' verdicts for the deck last drawn (`ruleRefusal`). */
interface RefusalCache {
  readonly deck: Deck;
  readonly rules: string;
  readonly refusal: (cardId: CardId, step: 1 | -1) => string | null;
}

export class BuilderState {
  identity: HeroIdentityCard | null = null;
  deck: Deck | null = null;
  filter: PoolFilter = {};
  sort: PoolSort = DEFAULT_POOL_SORT;
  filterText = "";
  deckSort: DeckListSort = "aspect";
  poolView: PoolView = "grid";
  /** The left rail's chart on a wide screen: the cost curve, or the draw odds (issue #531). */
  chartTab: "curve" | "odds" = "curve";
  /** The odds' group (`deck-odds.ts`) and how many cards are drawn; null is the first group / the opening hand. */
  oddsGroup: string | null = null;
  oddsDraws: number | null = null;
  status: string | null = null;
  /** The id of the deck this visit last saved, so Back can hand it to Decks to select. */
  savedDeckId: string | null = null;
  /** The deck as storage holds it (null while it was never saved): what "unsaved changes" and Delete compare against. */
  savedDeck: Deck | null = null;
  /** Back was pressed once with unsaved changes: the next press leaves without saving. */
  leaveArmed = false;
  /** Delete was pressed once: the next press deletes the saved deck. */
  deleteArmed = false;
  busy = false;
  /** New deck's "Start from" step: the hero picked, while the player chooses an empty deck or one of its precons. */
  startFor: HeroIdentityCard | null = null;
  identitySearch = "";
  /** The pool search and the hero search, ranked off the main thread; new per visit. */
  poolSearch: CardPoolSearch | null = null;
  heroSearch: DeckSearchClient | null = null;
  heroRanking: ReadonlyMap<string, number> | null = null;
  returnTo: CampaignReturn | null = null;
  campaign: DeckBuilderCampaignData | null = null;
  /** Recomputed every compose from `deck` / `campaign`: the row-level marks the pool and the deck list both read. */
  campaignModel: CampaignDeckEditModel | null = null;
  campaignRows: ReadonlyMap<string, CampaignDeckEditRow> = new Map();
  /** The narrow layout's tab (issue #544); `railTab` is the wide layout's. `setTab` keeps the two in step. */
  tab: DeckBuilderTab = "pool";
  railTab: "deck" | "games" = "deck";
  /** A phone folds the pool's filters behind a Filters chip; whether it is open. */
  filtersOpen = false;
  /** Which aspect's inline tip (G10b) is open, if any. */
  aspectTipOpen: CoreAspect | null = null;
  /** What the player's finished games say about this hero's cards (issue #529 C2); null until the stats worker answers. */
  insights: DeckInsights | null = null;
  /** The villain "From your games" reads your winning decks against (a stepper); null: the most faced. */
  againstVillain: string | null = null;
  againstSource: AgainstSource = "yours";
  /** Everyone's decks by villain, read when Everyone is chosen or the stepper rests on one; absent: not asked. */
  readonly againstGlobal = new Map<string, GlobalLoad<GlobalVillainCards> | { readonly kind: "reading" }>();
  shareBusy = false;
  shareFailed = false;
  /** When Share first appeared (ms), for the 400 ms grace; null while it is not shown. */
  shareShownAt: number | null = null;
  #refusals: RefusalCache | null = null;

  /** The cards this screen builds against: everything installed, and in a campaign the run's own pack copies too. */
  pool(): readonly AnyCard[] {
    return this.campaign ? campaignPool() : poolNow();
  }

  /** `deck`'s own campaign row, by card id: null outside campaign mode or for a card with no line yet. */
  campaignRowFor(cardId: string): CampaignDeckEditRow | null {
    return this.campaignRows.get(cardId) ?? null;
  }

  /** The campaign's model for the deck as it stands; null outside campaign mode. */
  refreshCampaign(): void {
    const { campaign, deck } = this;
    this.campaignModel =
      campaign && deck ? campaignDeckEditModel(deck, this.pool(), campaign.context, campaign.grants) : null;
    this.campaignRows = new Map(this.campaignModel?.rows.map((row) => [row.cardId as string, row]));
  }

  /** The deck-building rule settings (Settings > Gameplay, issue #531). Campaign decks follow their campaign's rules. */
  rules(): DeckBuildingRules {
    const settings = appSession().settings;
    return this.campaign
      ? { signature: "free", copyLimits: false }
      : { signature: settings.deckSignatureCards, copyLimits: settings.deckCopyLimits };
  }

  /** Why the rule settings refuse adding (`1`) or removing (`-1`) one `cardId`, or null; built once per deck. */
  ruleRefusal(deck: Deck, cardId: CardId, step: 1 | -1): string | null {
    if (!this.identity) return null;
    const rules = this.rules();
    const key = rules.signature + rules.copyLimits;
    const cached = this.#refusals;
    if (!cached || cached.deck !== deck || cached.rules !== key)
      this.#refusals = { deck, rules: key, refusal: deckRuleRefusals(deck, this.identity, this.pool(), rules) };
    return this.#refusals!.refusal(cardId, step);
  }

  /** The open deck differs from what storage holds (or was never saved), so leaving would lose something. */
  isDirty(): boolean {
    return this.deck !== null && this.identity !== null && hasUnsavedChanges(this.deck, this.savedDeck);
  }

  /** Cards this screen must never offer to *add*: RRG 1.8 p. 29 removals from the campaign; null outside campaign mode. */
  removedFromCampaignIds(): ReadonlySet<string> | null {
    return this.campaign ? new Set([...removedFromCampaignCardIds(this.campaign.context)].map(String)) : null;
  }

  /** Cards this screen must never offer to *add*: MC27 p. 4's `Campaign.prohibited.cardIds`; null outside campaign mode. */
  prohibitedCampaignIds(): ReadonlySet<string> | null {
    return this.campaign ? new Set([...prohibitedCampaignCardIds(this.campaign.context)].map(String)) : null;
  }

  /**
   * `browsablePool`, narrowed for the rules and for campaign mode: a removed card the deck does not currently hold is left
   * out of what browsing turns up; one it still holds stays, so its row's own "-" can fix the deck.
   */
  browsable(deck: Deck, identity: HeroIdentityCard): readonly AnyCard[] {
    // A card the deck already holds stays listed even if its rules now refuse it (so its "-" can remove it); campaign
    // mode keeps its own marks for that (`campaignModel`), and its granted lines are never browsable.
    const held = this.campaign ? new Set<string>() : new Set(deck.cards.map((line) => line.cardId as string));
    // The text's words are still being ranked: nothing is listed, never the previous text's matches.
    if (this.poolSearch?.pending) return [];
    const ranking = this.poolSearch?.ranking ?? null;
    const listed = browsablePool(
      this.pool(),
      identity,
      deck.aspects,
      this.poolSearch?.filterFor(this.filter) ?? this.filter,
      this.sort,
      packInfos(),
      held,
      ranking ?? undefined,
    );
    // The search worker answers the text search: only its matches stay, in the chosen sort.
    const searched = ranking ? listed.filter((card) => ranking.has(card.id as string)) : listed;
    // "Hidden" signature cards stay in the deck but leave the pool list, except one the deck holds fewer of than its
    // set's count, so it can be put back.
    const hidden =
      this.rules().signature === "hidden"
        ? new Set(
            requiredIdentitySet(identity, this.pool())
              .filter((line) => (deck.cards.find((c) => c.cardId === line.cardId)?.quantity ?? 0) >= line.quantity)
              .map((line) => line.cardId as string),
          )
        : null;
    const pool = hidden ? searched.filter((card) => !hidden.has(card.id as string)) : searched;
    const removed = this.removedFromCampaignIds();
    const prohibited = this.prohibitedCampaignIds();
    if (!removed && !prohibited) return pool;
    const alreadyHeld = (cardId: AnyCard["id"]): boolean =>
      (deck.cards.find((line) => line.cardId === cardId)?.quantity ?? 0) > 0;
    return pool.filter((card) => {
      if (removed?.has(card.id as string) && !alreadyHeld(card.id)) return false;
      if (prohibited?.has(card.id as string) && !alreadyHeld(card.id)) return false;
      return true;
    });
  }
}
