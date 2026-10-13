/**
 * The Title's Continue row: "Continue — Rhino · Spider-Man · round 4". Names come from content, never from the save's
 * own text. A Civil War game says what it is through `describeCivilWar` ("Custom Civil War: Iron Man, A then B, 3
 * sets"), so a built or rolled game does not read like the ready-made one.
 */
import type { SessionConfig } from "../engine/host.js";
import { describeCivilWar } from "./civil-war-label.js";

export interface ContinueLabelNames {
  /** The scenario's display name, or undefined when the pool does not know the id. */
  readonly scenarioName: (scenarioId: string) => string | undefined;
  /** A hero seat's display name for a stored identity card id, or undefined when unknown. */
  readonly identityName: (identityCardId: string) => string | undefined;
  /** A starter deck's display name ("Tigra — Aggression"), or undefined when unknown. */
  readonly starterDeckName: (starterDeckId: string) => string | undefined;
}

export function continueLabelOf(
  save: { readonly config: SessionConfig; readonly round: number },
  names: ContinueLabelNames,
): string {
  const scenario =
    describeCivilWar(save.config) ?? names.scenarioName(save.config.scenarioId) ?? save.config.scenarioId;
  const heroes = save.config.players
    .map((player) => {
      if (!("starterDeckId" in player)) {
        return names.identityName(player.identityCardId as string) ?? player.identityCardId;
      }
      return names.starterDeckName(player.starterDeckId)?.split(/ — | \/ /)[0] ?? player.starterDeckId;
    })
    .join(", ");
  return `Continue — ${scenario} · ${heroes} · round ${save.round}`;
}
