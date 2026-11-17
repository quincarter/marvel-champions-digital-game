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
  /**
   * The names widened with a game's own embedded packs (`SessionConfig.packs`), so a pack's hero or precon is named
   * after the pack is uninstalled. Optional: names without it serve the base pool only.
   */
  readonly forPacks?: (packs: readonly unknown[]) => ContinueLabelNames;
}

/** `names` widened with the config's own packs, when it carries any and the names know how. */
export function labelNamesFor<N extends ContinueLabelNames>(config: SessionConfig, names: N): N {
  const packs = config.packs;
  return (packs && packs.length > 0 && names.forPacks ? names.forPacks(packs) : names) as N;
}

export function continueLabelOf(
  save: { readonly config: SessionConfig; readonly round: number },
  names: ContinueLabelNames,
): string {
  return `Continue — ${gameLabelOf(save.config, names)} · round ${save.round}`;
}

/** "Rhino · Spider-Man": what a game is, without its round — the name a sync conflict prompt shows. */
export function gameLabelOf(config: SessionConfig, names: ContinueLabelNames): string {
  names = labelNamesFor(config, names);
  const scenario =
    describeCivilWar(config) ??
    // A pack's scenario is named by the packs the save carries, installed or not.
    config.packs?.flatMap((pack) => pack.scenarios ?? []).find((s) => (s.id as string) === config.scenarioId)?.name ??
    names.scenarioName(config.scenarioId) ??
    config.scenarioId;
  const heroes = config.players
    .map((player) => {
      if (!("starterDeckId" in player)) {
        return names.identityName(player.identityCardId as string) ?? player.identityCardId;
      }
      return names.starterDeckName(player.starterDeckId)?.split(/ — | \/ /)[0] ?? player.starterDeckId;
    })
    .join(", ");
  return `${scenario} · ${heroes}`;
}
