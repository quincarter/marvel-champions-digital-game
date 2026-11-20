/**
 * The Civil War builder in "for the other team" mode (issue #883, plan M8): while a Competitive room's player builds the
 * scenario their team seals for the other team, the builder offers only their side's leaders and sets, hides the
 * difficulty (the lobby agreed it, Q13 A) and ends in Seal instead of the seats screen.
 *
 * Module state like `view/room-table-setup.ts`: a reload leaves the mode, which is right (the room does not survive one
 * either).
 */
import type { PlayableScenarioOffer } from "@mc/cards";
import { titleSharedWithLeader, type SealedScenario } from "../live/competitive-start.js";
import type { TeamId } from "../live/room-state.js";
import { effectiveSetIds } from "./civil-war-builder-model.js";
import type { AnyCard } from "@mc/content";
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

/**
 * The first hero among `heroes` (a team's seat decks' identity card ids, null for a seat with no deck) whose name is the title of the
 * team's own leader, or null. A team cannot field an identity that shares a title with its own leader (MC56 pp. 14, 16);
 * the engine refuses it at Start, and this tells the team before it seals.
 */
export function heroSharingLeaderTitle(
  heroes: readonly (string | null)[],
  leaderName: string,
  cards: ReadonlyMap<string, AnyCard>,
): string | null {
  for (const cardId of heroes) {
    // As the engine compares (`civilWarCompetitive`): the card's name and both faces' names (MC56 pp. 14, 16).
    const clash = cardId === null ? null : titleSharedWithLeader(cards.get(cardId), leaderName);
    if (clash) return clash;
  }
  return null;
}
