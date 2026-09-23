/**
 * C04 in-game beat detection (`scenes/board.ts`'s guarded hook, `scenes/campaign/beat.ts`): whether the command the
 * store just applied should open the villain-stage splash, and if so with what data — pure, so the "only in a
 * campaign game, only once per flip, only when the story has a line" contract is Vitest-tested without a scene.
 */
import { cardOf, type GameEvent, type GameState } from "@mc/engine";
import { issueStoryFor } from "../campaign/story.js";
import type { CampaignBeatData } from "../scenes/campaign/routes.js";

/** The slice of `store.state.config` this needs — narrower than the full `SessionConfig` so it's easy to fake in a test. */
export interface CampaignBeatConfig {
  readonly scenarioId: string;
  readonly campaign?: { readonly campaignId: string; readonly nodeId: string } | null;
}

/**
 * `events` is `state.lastEvents` for a *fresh* command (the caller's own guard against re-processing the same
 * events on a plain redraw — matching `#openVillainWalkthrough`'s own `fresh` contract). Returns null for a
 * standalone game, a command with no stage flip, or a stage the story has nothing to say about.
 */
export function campaignBeatFor(
  events: readonly GameEvent[],
  game: GameState,
  config: CampaignBeatConfig | null,
): CampaignBeatData | null {
  const campaign = config?.campaign;
  if (!campaign) return null;
  const flip = events.find(
    (event): event is Extract<GameEvent, { type: "villainStageAdvanced" }> => event.type === "villainStageAdvanced",
  );
  if (!flip) return null;
  const stage = flip.stageIndex + 1;
  const story = issueStoryFor(campaign.campaignId, campaign.nodeId);
  const line = story?.stageLines[stage];
  if (!line) return null;
  const villainName = cardOf(game, flip.instanceId)?.name ?? story?.villain ?? "";
  return {
    campaignId: campaign.campaignId,
    nodeId: campaign.nodeId,
    stage,
    round: game.round,
    villainName,
    scenarioId: config.scenarioId,
  };
}
