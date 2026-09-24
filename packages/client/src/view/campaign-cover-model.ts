/**
 * The Campaign cover (C01): what `scenes/campaign/cover.ts` needs to draw a box's cover — title, blurb, roster,
 * issue pips, the next issue's billing and every CTA's enabled state — from a loaded `CampaignRecord` (or none, for
 * a fresh volume that hasn't been started) plus the box's own content and story. Pure, Vitest-tested.
 */
import type { CardId } from "@mc/content";
import type { CampaignDefinition, CampaignStatus } from "@mc/engine";
import { storyFor, type CampaignStory } from "../campaign/story.js";
import type { CampaignRecord } from "../engine/campaign-storage.js";
import type { PipState } from "../ui/campaign-chrome.js";
import { ladderFieldOf, walletFieldsOf } from "./campaign-dossier-model.js";
import { FIELD_SHORT_LABEL } from "./campaign-run-model.js";

export interface CoverModel {
  readonly campaignId: string;
  readonly boxCode: string;
  readonly name: string;
  readonly blurb: string;
  readonly tagline: string;
  /** The scenario whose villain art fronts the cover — the box's final scenario (design: Red Skull for MC10). */
  readonly villainScenarioId: string;
  readonly hasRun: boolean;
  readonly rosterNames: readonly string[];
  readonly totalIssues: number;
  readonly pips: readonly PipState[];
  /** 1-based. Null with no run, or once the run has no next issue (won/lost/abandoned). */
  readonly issueNumber: number | null;
  readonly nextIssueTitle: string | null;
  readonly nextIssueVillain: string | null;
  /** The run's terminal state, for "no next issue" — null while a run is still active, or there is no run. */
  readonly finished: CampaignStatus | null;
  /** Read Issue / Sign the roster is the only enabled action while true. */
  readonly canReadIssue: boolean;
  readonly canOpenDossier: boolean;
  readonly canOpenRun: boolean;
  readonly expertUnlocked: boolean;
  /** Null for a box with no Market (`walletFieldsOf` finds no currency/card-list pair, e.g. MC10) — the Cover
   * keeps its ISSUES button in that case instead of THE MARKET. */
  readonly market: CoverMarket | null;
  /** DOSSIER's own subtitle — "Wallets · Bounty ladder" for a box that has both (found the same shape-based way
   * `market` is), else the plain "Campaign log · heroes & world" every box's Dossier always shows. */
  readonly dossierSubtitle: string;
}

const DEFAULT_DOSSIER_SUBTITLE = "Campaign log · heroes & world";

export interface CoverMarketSeat {
  readonly heroName: string;
  /** "1U" — the currency field's own short word (`FIELD_SHORT_LABEL`), first letter only, the compact form design
   * tile 16 prints beside each seat's name on the Cover's tight two-button row. */
  readonly balanceLabel: string;
}

export interface CoverMarket {
  readonly seats: readonly CoverMarketSeat[];
}

export interface CoverModelInput {
  readonly campaignId: string;
  readonly boxCode: string;
  readonly name: string;
  readonly record: CampaignRecord | null;
  readonly definition: CampaignDefinition | undefined;
  readonly expertUnlocked: boolean;
  readonly identityNameOf?: (id: CardId) => string;
}

const defaultIdentityNameOf = (id: CardId): string => id as string;

export function coverModelOf(input: CoverModelInput): CoverModel {
  const story = storyFor(input.campaignId);
  const identityNameOf = input.identityNameOf ?? defaultIdentityNameOf;
  const record = input.record;
  const definition = input.definition;

  const linearNodes = definition?.graph.kind === "linear" ? definition.graph.nodes : null;
  const total = linearNodes?.length ?? 5;
  const finalScenarioId =
    (linearNodes?.at(-1)?.scenario.kind === "fixed"
      ? (linearNodes!.at(-1)!.scenario as { scenarioId: string }).scenarioId
      : null) ??
    story?.issues.at(-1)?.nodeId ??
    input.campaignId;

  const rosterNames = record
    ? record.seats.map((seat: { readonly identityCardId: CardId }) => identityNameOf(seat.identityCardId))
    : [];

  let issueNumber: number | null = null;
  let pips: readonly PipState[] = Array.from({ length: total }, () => "empty");
  let nextIssueTitle: string | null = null;
  let nextIssueVillain: string | null = null;
  let finished: CampaignStatus | null = null;

  if (record && linearNodes) {
    const nextNodeId = record.position.nextNodeId;
    pips = linearNodes.map((node): PipState => {
      if (node.id === nextNodeId) return "current";
      if (record.position.resolved[node.id] === "completed") return "done";
      return "empty";
    });
    if (nextNodeId) {
      const index = linearNodes.findIndex((n) => n.id === nextNodeId);
      issueNumber = index >= 0 ? index + 1 : null;
      const issueStory = story?.issues.find((i) => i.nodeId === nextNodeId) ?? null;
      nextIssueTitle = issueStory?.title ?? null;
      nextIssueVillain = issueStory?.villain ?? null;
    } else {
      finished = record.status;
      if (record.status === "won") pips = linearNodes.map(() => "done");
    }
  } else if (record) {
    finished = record.status === "active" ? null : record.status;
  }

  const canReadIssue = record !== null && issueNumber !== null;
  const canOpenDossier = record !== null;
  const canOpenRun = record !== null;

  return {
    campaignId: input.campaignId,
    boxCode: input.boxCode,
    name: input.name,
    blurb: story?.blurb ?? "",
    tagline: story?.tagline ?? "A story in five issues",
    villainScenarioId: finalScenarioId,
    hasRun: record !== null,
    rosterNames,
    totalIssues: total,
    pips,
    issueNumber,
    nextIssueTitle,
    nextIssueVillain,
    finished,
    canReadIssue,
    canOpenDossier,
    canOpenRun,
    expertUnlocked: input.expertUnlocked,
    market: coverMarketOf(record, definition, identityNameOf),
    dossierSubtitle: dossierSubtitleOf(definition),
  };
}

/** "Wallets · Bounty ladder" for a box whose definition has both panels' shapes, else the default sentence — every
 * word here is a panel the Dossier Overview actually shows (`campaign-dossier-model.ts`'s `dossierWallets`/
 * `campaignDossierBountyLadder`), never invented copy. */
function dossierSubtitleOf(definition: CampaignDefinition | undefined): string {
  if (!definition) return DEFAULT_DOSSIER_SUBTITLE;
  const parts: string[] = [];
  if (walletFieldsOf(definition)) parts.push("Wallets");
  if (ladderFieldOf(definition)) parts.push("Bounty ladder");
  return parts.length > 0 ? parts.join(" · ") : DEFAULT_DOSSIER_SUBTITLE;
}

/** THE MARKET's per-seat wallet summary, or null for a box with no Market at all (`walletFieldsOf`). */
function coverMarketOf(
  record: CampaignRecord | null,
  definition: CampaignDefinition | undefined,
  identityNameOf: (id: CardId) => string,
): CoverMarket | null {
  if (!record || !definition) return null;
  const wallet = walletFieldsOf(definition);
  if (!wallet) return null;
  const shortLabel = FIELD_SHORT_LABEL[wallet.currencyField] ?? wallet.currencyField;
  const unitLetter = shortLabel.slice(0, 1).toUpperCase();
  return {
    seats: record.seats.map((seat) => {
      const balance = seat.fields[wallet.currencyField];
      const amount = balance?.kind === "number" ? balance.value : 0;
      return { heroName: identityNameOf(seat.identityCardId), balanceLabel: `${amount}${unitLetter}` };
    }),
  };
}

/** Re-exported so a scene can label a fallback issue titled purely from the story, with no definition needed. */
export type { CampaignStory };
