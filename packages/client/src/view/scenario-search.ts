/**
 * What the scenario roster's search looks in (view/deck-search.ts ranks it in a worker): the scenario and villain
 * names first; then the pack, the encounter and modular set names, the villain's traits and keywords and the
 * difficulty words; and the main scheme and the villain's rules text last. Sent to the worker only when the pool
 * changes.
 */
import type { AnyCard, EncounterSet, Scenario } from "@mc/content";
import type { SearchDocument } from "./deck-search.js";
import { hasRandomChosenVillain } from "./random-villain.js";
import { scenarioDetailOf } from "./scenario-detail.js";

export function scenarioSearchDocumentOf(
  scenario: Scenario,
  cardsById: ReadonlyMap<string, AnyCard>,
  encounterSets: readonly EncounterSet[],
  packName: (packCode: string) => string,
): SearchDocument {
  // A villain drawn at random (Shadows in the Night) is not known yet: its placeholder card must not make the scenario
  // searchable by that villain's name, traits or text.
  const hidden = hasRandomChosenVillain(scenario);
  const villain = hidden ? undefined : cardsById.get(scenario.villainCardId as string);
  const stages = villain?.type === "villain" ? villain.sides.flatMap((side) => side.stages) : [];
  let detail: ReturnType<typeof scenarioDetailOf> | null = null;
  try {
    detail = scenarioDetailOf(scenario, cardsById, encounterSets);
  } catch {
    // A scenario whose villain or scheme is not in the pool still searches by its own name and pack.
  }
  const text = (value: string | undefined): string[] => (value && value.trim() !== "" ? [value] : []);
  return {
    id: scenario.id as string,
    primary: [
      scenario.name,
      ...(detail
        ? [detail.displayName, detail.tileTitle, ...(hidden ? [] : [detail.villainName]), ...detail.otherVillainNames]
        : []),
      ...text(villain?.name),
    ],
    secondary: [
      packName(scenario.packCode as string),
      ...(detail
        ? [...detail.fixedEncounterSetNames, ...detail.recommendedModularSetNames, ...text(detail.modularSummary ?? "")]
        : []),
      ...stages.flatMap((stage) => [...stage.traits.map((t) => t as string), ...stage.keywords.map((k) => k.name)]),
      "standard",
      "expert",
    ],
    notes: [...text(detail?.mainSchemeName), ...stages.flatMap((stage) => text(stage.text.current))],
  };
}
