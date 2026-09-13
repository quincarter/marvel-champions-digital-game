/**
 * Brand casts. The schema's helper functions can't be imported at runtime under Node type-stripping (schema files use
 * `.js` specifiers), and these are the same zero-cost casts.
 */
import type { AbilityReference, AnyCard, EncounterSet, ImageRef, Scenario, StarterDeck, Trait } from "../../../src/schema/index.ts";

type Branded<K extends keyof BrandMap> = BrandMap[K];
interface BrandMap {
  card: AnyCard["id"];
  ability: AbilityReference["id"];
  set: AnyCard["setCode"];
  cycle: AnyCard["cycleId"];
  encounterSet: EncounterSet["id"];
  scenario: Scenario["id"];
  deck: StarterDeck["id"];
  image: ImageRef;
}

export const brand = <K extends keyof BrandMap>(_k: K, v: string): Branded<K> => v as unknown as Branded<K>;
export const traitOf = (v: string): Trait => v.trim().toUpperCase() as Trait;
