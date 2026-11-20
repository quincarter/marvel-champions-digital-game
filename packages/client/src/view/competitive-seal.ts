/**
 * The Civil War builder in "for the other team" mode (issue #883, plan M8): while a Competitive room's player builds the
 * scenario their team seals for the other team, the builder offers only their side's leaders and sets, hides the
 * difficulty (the lobby agreed it, Q13 A) and ends in Seal instead of the seats screen.
 *
 * Module state like `view/room-table-setup.ts`: a reload leaves the mode, which is right (the room does not survive one
 * either).
 */
import type { PlayableScenarioOffer } from "@mc/cards";
import type { SealedScenario } from "../live/competitive-start.js";
import type { TeamId } from "../live/room-state.js";
import { effectiveSetIds } from "./civil-war-builder-model.js";
import type { SetupDraft } from "./setup-draft.js";

let sealing: TeamId | null = null;

/** The side whose scenario is being built for the other team, or null in every ordinary builder. */
export const sealingFor = (): TeamId | null => sealing;

export function startSealing(team: TeamId): void {
  sealing = team;
}

export function stopSealing(): void {
  sealing = null;
}

/**
 * What a builder draft seals for the other team: the leader, the modular sets and the two main scheme stages, the plain
 * data `parseSealedScenario` (`live/competitive-start.ts`) reads back at Start. Null when the draft is no Civil War build.
 */
export function sealedScenarioOf(draft: SetupDraft, offer: PlayableScenarioOffer): SealedScenario | null {
  if (!draft.civilWar) return null;
  return {
    leaderScenarioId: draft.scenarioId,
    modularSetIds: effectiveSetIds(draft, offer),
    mainSchemeStageIds: draft.civilWar.stageIds,
    ...(draft.extraModularSetIds.length > 0 ? { extraModularSetIds: draft.extraModularSetIds } : {}),
  };
}
