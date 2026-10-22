/**
 * The name a scenario shows for a villain the table does not know yet. Two kinds draw one at random: a scenario
 * with a printed family name (`Scenario.randomVillainName`: "The Marauders") and one whose main scheme's Setup puts a
 * random villain into play (`startingVillain: "bySetup"`: Loki, God of Lies). Naming `villainCardId` for either would
 * promise a villain the board may not show, so the scenario shelf, the setup preview and the modular-sets card all
 * read this one helper.
 */
import type { AnyCard, Scenario } from "@mc/content";

/** The family a `bySetup` villain is drawn from: the shared trait of the villain and its set-aside siblings ("AVATAR OF LOKI" -> "Avatar of Loki"). */
export function bySetupVillainLabel(scenario: Scenario, cardsById: ReadonlyMap<string, AnyCard>): string | undefined {
  const ids = [scenario.villainCardId, ...(scenario.setAsideVillainCardIds ?? [])];
  const traitSets = ids.map((id) => {
    const card = cardsById.get(id as string);
    const stage = card?.type === "villain" ? card.sides[0]?.stages[0] : undefined;
    return new Set((stage?.traits ?? []).map((t) => t as string));
  });
  const shared = [...(traitSets[0] ?? [])].find((t) => traitSets.every((set) => set.has(t)));
  if (!shared) return undefined;
  return shared
    .toLowerCase()
    .split(" ")
    .map((word, i) => (i > 0 && ["of", "the"].includes(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ");
}

/**
 * A card-keyed choice drawn at random that puts the drawn villain in play (Shadows in the Night): the record's own
 * `villainCardId` is only the default option, a placeholder. One that keeps the draw set aside (Shadow Labyrinth) leaves
 * the scenario's own villain as the villain, so it is not random here.
 */
export const hasRandomChosenVillain = (scenario: Scenario): boolean => {
  const choice = scenario.villainOptions;
  return choice?.keyedBy === "card" && choice.selection === "random" && choice.chosenVillain !== "setAside";
};

/** True when the opening villain is not known until the game is dealt. */
export const hasRandomVillain = (scenario: Scenario): boolean =>
  scenario.randomVillainName !== undefined ||
  scenario.startingVillain === "bySetup" ||
  hasRandomChosenVillain(scenario);

/**
 * The label for a random opening villain, or undefined for a scenario that names its villain. `setNames` (encounter
 * set id to name) names the pool a random chosen villain comes from ("Dark Protégé").
 */
export function randomVillainLabel(
  scenario: Scenario,
  cardsById: ReadonlyMap<string, AnyCard>,
  setNames?: ReadonlyMap<string, string>,
): string | undefined {
  if (scenario.randomVillainName !== undefined) return scenario.randomVillainName;
  if (hasRandomChosenVillain(scenario)) {
    const setId = scenario.villainOptions?.defaultSetId as string | undefined;
    return (setId ? setNames?.get(setId) : undefined) ?? "Random villain";
  }
  return scenario.startingVillain === "bySetup" ? bySetupVillainLabel(scenario, cardsById) : undefined;
}
