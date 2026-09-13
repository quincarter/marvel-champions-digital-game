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
export type ImageRef = Brand<string, "ImageRef">;
export type StarterDeckId = Brand<string, "StarterDeckId">;
/** A player deck of any origin (precon, imported, user-built); see `Deck` in `./decks.ts`. */
export type DeckId = Brand<string, "DeckId">;

export const cardId = (value: string): CardId => value as CardId;
export const setCode = (value: string): SetCode => value as SetCode;
export const cycleId = (value: string): CycleId => value as CycleId;
export const encounterSetId = (value: string): EncounterSetId => value as EncounterSetId;
export const scenarioId = (value: string): ScenarioId => value as ScenarioId;
export const campaignId = (value: string): CampaignId => value as CampaignId;
export const abilityId = (value: string): AbilityId => value as AbilityId;
export const starterDeckId = (value: string): StarterDeckId => value as StarterDeckId;
export const deckId = (value: string): DeckId => value as DeckId;

/**
 * An art reference is a local lookup key (e.g. a content-hash or a path key
 * into a gitignored local asset folder) — never raw image bytes, never a
 * public URL. See CLAUDE.md "Content & IP boundaries": art is a separate,
 * non-redistributed concern from this structured card data.
 */
export const artRef = (value: string): ArtRef => value as ArtRef;

/**
 * A reference to a card's artwork *upstream*, as the source publishes it — for
 * MarvelCDB, a site-relative path such as `/bundles/cards/01001a.png`.
 *
 * This is a pointer, not a picture: no image bytes are stored in this repo, and
 * nothing here is a licence to redistribute the art (CLAUDE.md "Content & IP
 * boundaries"). It exists so a client can show a card without the user first
 * sourcing their own scans, and so a local scan can be matched to the printed
 * face it belongs to.
 *
 * `ArtRef` is the other half of the story and keeps its own meaning: a key into
 * a gitignored *local* asset folder. A client should prefer a local `ArtRef`
 * when it has one and fall back to the `ImageRef` otherwise.
 */
export const imageRef = (value: string): ImageRef => value as ImageRef;
