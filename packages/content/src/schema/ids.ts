/**
 * Branded (nominal) string identifiers. Plain strings would let a CardId and an
 * AbilityId be swapped by accident anywhere they're used as map keys or foreign
 * references between packages — branding catches that at the type level for
 * free, at zero runtime cost.
 */
type Brand<T, B extends string> = T & { readonly __brand: B };

export type CardId = Brand<string, "CardId">;
export type SetCode = Brand<string, "SetCode">;
export type CycleId = Brand<string, "CycleId">;
export type EncounterSetId = Brand<string, "EncounterSetId">;
export type ScenarioId = Brand<string, "ScenarioId">;
export type CampaignId = Brand<string, "CampaignId">;
export type AbilityId = Brand<string, "AbilityId">;
export type ArtRef = Brand<string, "ArtRef">;

export const cardId = (value: string): CardId => value as CardId;
export const setCode = (value: string): SetCode => value as SetCode;
export const cycleId = (value: string): CycleId => value as CycleId;
export const encounterSetId = (value: string): EncounterSetId => value as EncounterSetId;
export const scenarioId = (value: string): ScenarioId => value as ScenarioId;
export const campaignId = (value: string): CampaignId => value as CampaignId;
export const abilityId = (value: string): AbilityId => value as AbilityId;

/**
 * An art reference is a local lookup key (e.g. a content-hash or a path key
 * into a gitignored local asset folder) — never raw image bytes, never a
 * public URL. See CLAUDE.md "Content & IP boundaries": art is a separate,
 * non-redistributed concern from this structured card data.
 */
export const artRef = (value: string): ArtRef => value as ArtRef;
