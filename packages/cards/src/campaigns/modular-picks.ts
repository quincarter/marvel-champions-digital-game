import type { Campaign, EncounterSet, Scenario } from "@mc/content";
import { modularPickProblem } from "../modular-pool.js";

/**
 * `modularPickProblem` for a game played inside a campaign: a set the box's `Campaign.prohibited.encounterSetIds` bars
 * is never a modular pick there, whatever the scenario would otherwise allow. Shadowland's Black Flower (MC65 p. 5:
 * "Cards from the Black Flower modular set are required by some Campaign Instructions, so it cannot be included as a
 * modular set in any scenario while playing the campaign") is a modular set of Shadows in the Night and Shadow
 * Labyrinth
 * on its own, so a picker that filters by `modularPickProblem` alone offers it; the campaign picker asks this.
 * Returns the reason, or null when the set may be picked.
 */
export function campaignModularPickProblem(
  campaign: Pick<Campaign, "name" | "prohibited">,
  scenario: Scenario,
  setId: string,
  encounterSets: readonly EncounterSet[],
): string | null {
  if (campaign.prohibited?.encounterSetIds?.some((id) => id === setId))
    return `${setId} cannot be a modular set in any scenario while playing the ${campaign.name} campaign`;
  return modularPickProblem(scenario, setId, encounterSets);
}
