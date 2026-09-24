/**
 * The frozen-deck screen (design tile 20, `Campaign - *.dc.html` "Deck edit — Expert"): what a seat's deck-edit
 * step becomes once MC16 p. 5's Expert Campaign freeze has locked in (`campaign-deck-edit-model.ts`'s
 * `frozenNonCampaignCardsOf`/`DECK_FREEZE_POLICY`) — a read-only summary of what's locked and what's still open,
 * in place of the ordinary deck builder (`scenes/deck-builder.ts`).
 *
 * **Nothing here re-derives legality.** The frozen/non-frozen split itself is `campaignDeckEditModel`'s own
 * `locked` mark (a campaign grant); this module only groups those same rows for display and adds the two things
 * the builder's row shape doesn't carry: which issue a campaign card was bought in (`CampaignGrant.grantedAtNodeId`,
 * read back through the definition's own node order — never a hard-coded issue count) and whether The Market is
 * reachable from here right now.
 *
 * **The Market's own next-opens issue is found the same way `campaign-dossier-model.ts`'s Wallets panel finds its
 * currency/card-list field pair** (`walletFieldsOf`) — by the shape of the definition's own `betweenGames` ops, not
 * by campaign id. A box with no such pairing (MC10) never freezes in the first place (`DECK_FREEZE_POLICY` has no
 * entry for it), so this module is only ever asked about a box that has one.
 */
import type { AnyCard, CardId, CoreAspect, DeckCardEntry } from "@mc/content";
import type { CampaignDefinition, CampaignGrant, CampaignLog, CampaignPendingChoice } from "@mc/engine";
import { issueNumberOf } from "../campaign/story.js";
import { nodesWritingField, walletFieldsOf } from "./campaign-dossier-model.js";
import { isMarketPendingChoice, marketCatalogOf, type CardOf } from "./campaign-market-model.js";
import { deckStatsOf, type DeckAspectCounts } from "./deck-stats.js";
import { aspectLabelOf } from "./seat-slots.js";
import type { CampaignDeckEditModel } from "./campaign-deck-edit-model.js";
import { campaignDeckSizeSplit } from "./campaign-deck-edit-model.js";

export interface FrozenDeckBreakdownRow {
  readonly id: "heroSet" | "aspect" | "basic" | "campaignCards";
  readonly count: number;
  readonly label: string;
  readonly sublabel: string;
  /** `LOCKED` vs `OPEN` — whether this row's cards can still change under the freeze. */
  readonly locked: boolean;
}

export interface FrozenDeckCampaignCardRow {
  readonly cardId: CardId;
  readonly name: string;
  /** `CampaignGrant.grantedAtNodeId`, read back as a 1-based issue number. Null when the log never recorded which node granted it (a pre-history-tracking save). */
  readonly boughtIssueNumber: number | null;
  readonly note: string;
  readonly citation: string;
}

export type FrozenDeckMarketStatus =
  /** The runner's very next question for this run is a Market-shaped choice — THE MARKET is live. */
  | { readonly kind: "openNow" }
  /** Something else in this issue's setup needs answering first, in the Briefing, before the Market can open. */
  | { readonly kind: "answerBriefingFirst" }
  /** The Market opens again once issue `issueNumber` is set up. */
  | { readonly kind: "opensAtIssue"; readonly issueNumber: number }
  /** No future node ever opens the Market again (or the campaign is finished). */
  | { readonly kind: "noneRemaining" };

export interface FrozenDeckMarketHint {
  readonly balanceLabel: string;
  /** The cheapest catalog card this seat could afford right now, or null if none (or nothing saved yet). */
  readonly affordableCardName: string | null;
}

export interface FrozenDeckModel {
  readonly frozenSinceIssueNumber: number;
  readonly bannerReason: string;
  readonly totalCards: number;
  readonly countedCards: number;
  readonly campaignCardCount: number;
  readonly rows: readonly FrozenDeckBreakdownRow[];
  readonly campaignCards: readonly FrozenDeckCampaignCardRow[];
  readonly market: FrozenDeckMarketStatus;
  readonly marketHint: FrozenDeckMarketHint | null;
  readonly caption: string;
}

export const FROZEN_BANNER_REASON =
  "Expert campaign rule: aspect and basic cards stay exactly as they were when the run began. Only campaign cards can still go in.";

export const FROZEN_DECK_CAPTION =
  "On Standard this screen is the normal deck builder, with campaign cards pinned. The freeze banner only appears in Expert.";

const CAMPAIGN_CARD_CITATION = "MC16 p. 5";

/** `deckStatsOf`'s per-aspect grouping, folded into the one non-basic/non-hero/non-pool aspect a frozen deck ever carries. */
function chosenAspectCountOf(counts: DeckAspectCounts): number {
  return counts.aggression + counts.justice + counts.leadership + counts.protection + counts.pool;
}

function aspectNamesOf(counts: DeckAspectCounts): readonly CoreAspect[] {
  const names: CoreAspect[] = [];
  if (counts.aggression > 0) names.push("aggression");
  if (counts.justice > 0) names.push("justice");
  if (counts.leadership > 0) names.push("leadership");
  if (counts.protection > 0) names.push("protection");
  return names;
}

export interface FrozenDeckModelInput {
  /** The seat's deck exactly as it stood when the freeze snapshot was taken (`frozenNonCampaignCardsOf`). */
  readonly frozenCards: readonly DeckCardEntry[];
  /** The seat's current deck-edit rows (`campaignDeckEditModel`) — campaign-granted lines read off here. */
  readonly editModel: CampaignDeckEditModel;
  readonly pool: readonly AnyCard[];
  readonly grants: readonly CampaignGrant[];
  readonly definition: CampaignDefinition;
  /** The node the freeze snapshot was taken at (`frozenNonCampaignCardsOf`'s own first node), for "frozen since #N". */
  readonly frozenAtNodeId: string;
  /** `record.position.nextNodeId` — the issue this seat is between-games for right now. */
  readonly nextNodeId: string | null;
  /** One `compose(record, [])` peek's result — never persisted, see `scenes/campaign/deck-edit.ts`. Null if the campaign is already finished (no next node to compose). */
  readonly nextPending: CampaignPendingChoice | null;
  readonly cardOf: CardOf;
  /** This seat's own `CampaignLog.seats[n].fields`, for the Wallet balance hint. */
  readonly seatFields: CampaignLog["seats"][number]["fields"];
  /** Every card id already granted campaign-wide (MC16 p. 5: "Only one copy of each card from The Market can be used during a campaign for the players as a group"), across every seat — excluded from the affordability hint. */
  readonly grantedCardIdsCampaignWide: ReadonlySet<CardId>;
}

function cardNameOf(pool: readonly AnyCard[], cardId: CardId): string {
  return pool.find((card) => (card.id as string) === (cardId as string))?.name ?? (cardId as string);
}

function marketStatusOf(input: FrozenDeckModelInput): FrozenDeckMarketStatus {
  if (input.nextPending) {
    return isMarketPendingChoice(input.nextPending, input.cardOf)
      ? { kind: "openNow" }
      : { kind: "answerBriefingFirst" };
  }
  if (!input.nextNodeId) return { kind: "noneRemaining" };
  const wallet = walletFieldsOf(input.definition);
  if (!wallet) return { kind: "noneRemaining" };
  const nodeIds = input.definition.graph.nodes.map((node) => node.id);
  const marketNodes = nodesWritingField(input.definition, wallet.cardListField);
  const nextIndex = nodeIds.indexOf(input.nextNodeId);
  const upcoming = marketNodes.find((node) => nodeIds.indexOf(node.id) >= nextIndex);
  return upcoming
    ? { kind: "opensAtIssue", issueNumber: issueNumberOf(nodeIds, upcoming.id) }
    : { kind: "noneRemaining" };
}

function marketHintOf(input: FrozenDeckModelInput): FrozenDeckMarketHint | null {
  const wallet = walletFieldsOf(input.definition);
  if (!wallet) return null;
  const balance = input.seatFields[wallet.currencyField];
  const units = balance?.kind === "number" ? balance.value : 0;
  const word = units === 1 ? "unit" : "units";
  const catalog = marketCatalogOf(input.pool).filter(
    (card) => !input.grantedCardIdsCampaignWide.has(card.id as string as CardId),
  );
  const affordable = catalog.find((card) => ((card as { readonly unitCost?: number }).unitCost ?? Infinity) <= units);
  return { balanceLabel: `${units} ${word} saved`, affordableCardName: affordable?.name ?? null };
}

/** The frozen-deck screen's whole view: `campaign-deck-edit-model.ts`'s row-level verdicts, folded into the summary this screen shows in place of the deck builder. */
export function frozenDeckModelOf(input: FrozenDeckModelInput): FrozenDeckModel {
  const nodeIds = input.definition.graph.nodes.map((node) => node.id);
  const frozenSinceIssueNumber = issueNumberOf(nodeIds, input.frozenAtNodeId);

  const frozenStats = deckStatsOf({ cards: input.frozenCards }, input.pool);
  const split = campaignDeckSizeSplit(input.editModel);
  const aspectNames = aspectNamesOf(frozenStats.countsByAspect);

  const rows: FrozenDeckBreakdownRow[] = [
    {
      id: "heroSet",
      count: frozenStats.countsByAspect.hero,
      label: "Hero set",
      sublabel: "This hero's own cards — always in.",
      locked: true,
    },
    {
      id: "aspect",
      count: chosenAspectCountOf(frozenStats.countsByAspect),
      label: aspectNames.length > 0 ? aspectLabelOf(aspectNames) : "Aspect",
      sublabel: "Can't swap or change aspect.",
      locked: true,
    },
    {
      id: "basic",
      count: frozenStats.countsByAspect.basic,
      label: "Basic",
      sublabel: "Can't swap.",
      locked: true,
    },
    {
      id: "campaignCards",
      count: split.pinned,
      label: "Market cards",
      sublabel: "Buy more between issues.",
      locked: false,
    },
  ];

  const campaignCards: FrozenDeckCampaignCardRow[] = input.grants.map((grant) => {
    const boughtIssueNumber = nodeIds.includes(grant.grantedAtNodeId)
      ? issueNumberOf(nodeIds, grant.grantedAtNodeId)
      : null;
    return {
      cardId: grant.cardId,
      name: cardNameOf(input.pool, grant.cardId),
      boughtIssueNumber,
      note:
        boughtIssueNumber !== null
          ? `Bought after #${boughtIssueNumber} · doesn't count toward deck size.`
          : "Doesn't count toward deck size.",
      citation: CAMPAIGN_CARD_CITATION,
    };
  });

  return {
    frozenSinceIssueNumber,
    bannerReason: FROZEN_BANNER_REASON,
    totalCards: split.counted + split.pinned,
    countedCards: split.counted,
    campaignCardCount: split.pinned,
    rows,
    campaignCards,
    market: marketStatusOf(input),
    marketHint: marketHintOf(input),
    caption: FROZEN_DECK_CAPTION,
  };
}

/** The action bar's own label/enabled state for THE MARKET, from `model.market` alone. */
export function frozenDeckMarketCta(market: FrozenDeckMarketStatus): {
  readonly enabled: boolean;
  readonly reason: string | null;
} {
  switch (market.kind) {
    case "openNow":
      return { enabled: true, reason: null };
    case "answerBriefingFirst":
      return { enabled: false, reason: "Answer this issue's setup in the Briefing first." };
    case "opensAtIssue":
      return { enabled: false, reason: `Market opens when you set up issue #${market.issueNumber}.` };
    case "noneRemaining":
      return { enabled: false, reason: "No more Market visits remain in this campaign." };
  }
}
