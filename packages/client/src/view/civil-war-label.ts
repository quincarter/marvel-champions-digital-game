/**
 * The one-line name of a Civil War game, built from its stored `SessionConfig` alone (docs/phase7-wave10-client.md
 * section 9): "Civil War: Iron Man" for a leader as printed, "Custom Civil War: Iron Man, Cut Off Support then
 * Negative Zone Prison, 4 sets" for the player's own picks, "Random Civil War: ..." for a roll left as it fell. A game
 * played blind keeps its hidden pieces hidden here too: the label cannot read the log, so stage 2 and every set stay
 * hidden words and a count.
 *
 * Names come from the cards package's offer, never from the save's own text. `null` for any game that is not a
 * Civil War leader's, so callers fall back to the scenario's name.
 */
import { playableScenarioOffer, type PlayableScenarioOffer } from "@mc/cards";
import type { SessionConfig } from "../engine/host.js";

type LabelConfig = Pick<
  SessionConfig,
  "scenarioId" | "mainSchemeStageIds" | "modularSetIds" | "blind" | "randomScenario"
>;
type OfferLookup = (scenarioId: string) => PlayableScenarioOffer | null;

const defaultOffer: OfferLookup = (id) => {
  try {
    return playableScenarioOffer(id);
  } catch {
    return null;
  }
};

const plural = (count: number, one: string): string => `${count} ${one}${count === 1 ? "" : "s"}`;
const sameIds = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((id) => b.includes(id));

/** "custom" or "random" for a Civil War game the player built or rolled; "ready" for a leader as printed; null for any other scenario. */
export function civilWarKindOf(
  config: LabelConfig,
  offerFor: OfferLookup = defaultOffer,
): "ready" | "custom" | "random" | null {
  const label = describeCivilWar(config, offerFor);
  if (label === null) return null;
  return label.startsWith("Random") ? "random" : label.startsWith("Custom") ? "custom" : "ready";
}

export function describeCivilWar(config: LabelConfig, offerFor: OfferLookup = defaultOffer): string | null {
  const offer = offerFor(config.scenarioId);
  const stages = offer?.mainSchemeStages;
  if (!offer || !stages) return null;

  const leader =
    offer.sides?.flatMap((side) => side.leaders).find((l) => l.scenarioId === config.scenarioId)?.name ??
    config.scenarioId;
  const stageName = (number: number, id: string | undefined): string =>
    stages.stages.find((s) => s.stageNumber === number)?.options.find((o) => o.printedCardId === id)?.name ?? "?";
  const recommendedSets = (offer.modularSets ?? []).filter((s) => s.recommended).map((s) => s.id);

  const stageIds = config.mainSchemeStageIds ?? stages.recommended;
  const setIds = config.modularSetIds ?? recommendedSets;
  const readyMade =
    !config.randomScenario &&
    stageIds.length === stages.recommended.length &&
    stageIds.every((id, i) => id === stages.recommended[i]) &&
    sameIds(setIds, recommendedSets);

  const kind = config.randomScenario ? "Random" : readyMade ? "" : "Custom";
  const heading = `${kind ? `${kind} ` : ""}Civil War${config.blind ? " (blind)" : ""}`;
  if (readyMade && !config.blind) return `${heading}: ${leader}`;

  const picks = config.blind
    ? `${stageName(1, stageIds[0])} then a hidden stage 2, ${plural(setIds.length, "set")} hidden`
    : `${stageName(1, stageIds[0])} then ${stageName(2, stageIds[1])}, ${plural(setIds.length, "set")}`;
  return `${heading}: ${leader}, ${picks}`;
}
