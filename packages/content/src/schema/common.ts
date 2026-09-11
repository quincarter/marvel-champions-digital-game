import type { ArtRef } from "./ids.js";

/**
 * Many printed values ("10 threat", "1 per player") scale with player count.
 * `total = base + perPlayer * playerCount`. This mirrors how FFG prints a flat
 * number plus a "per player" qualifier — encode both parts explicitly instead
 * of pre-baking a player count into the data (the engine knows player count
 * at runtime, content data shouldn't).
 */
export interface ScalingValue {
  readonly base: number;
  readonly perPlayer: number;
}

export const flat = (base: number): ScalingValue => ({ base, perPlayer: 0 });
export const perPlayerOnly = (perPlayer: number): ScalingValue => ({ base: 0, perPlayer });
/** A fixed part plus a per-player part, e.g. "2 + 1 per player" → `scaling(2, 1)`. */
export const scaling = (base: number, perPlayer: number): ScalingValue => ({ base, perPlayer });

/**
 * A printed stat that can be a dash or an X:
 * - a number is the printed value;
 * - `"X"` is defined by the card's own ability (the engine treats the base as 0
 *   and the card's constant ability supplies the value — Titania: "X is equal
 *   to Titania's remaining hit points");
 * - `null` is a printed "—": the character has no such stat and cannot use that
 *   power at all (Hulk's THW), which is not the same as a 0.
 */
export type PrintedStat = number | "X" | null;

export type ResourceIconType = "physical" | "mental" | "energy" | "wild";

/** Icon counts printed on a Resource card, or required by a Requirement keyword. */
export type ResourceIconCounts = Partial<Record<ResourceIconType, number>>;

/**
 * Printed (original) text is retained forever for historical/reference
 * purposes; `current` is what the engine should actually execute against and
 * reflects the latest errata/FAQ wording. If a card has never been errata'd,
 * `current` is identical to `printed` (never silently overwritten — this is
 * the two are stored side by side on purpose per CLAUDE.md's rules-source
 * hierarchy: RRG/FAQ/errata outranks the original print).
 */
export interface CardText {
  readonly printed: string;
  readonly current: string;
}

export const unerrataedText = (printed: string): CardText => ({ printed, current: printed });

/** A single errata/FAQ/taboo revision that touched this card. */
export interface ErrataRecord {
  /** e.g. "FAQ 1.9", "Errata 2023-11", "Taboo List 2022" — free-form version tag. */
  readonly version: string;
  readonly changedFields: readonly string[];
  readonly note?: string;
}

/**
 * A card's overall errata/taboo status. `currentVersion` is the version tag
 * this card's `current` text/stats reflect as of ingestion; `history` is the
 * ordered trail of revisions for audit purposes (not required to be
 * exhaustive on day one, but the slot exists so it never has to be bolted on
 * later).
 */
export interface ErrataStatus {
  readonly currentVersion: string;
  readonly history?: readonly ErrataRecord[];
  readonly tabooListed?: boolean;
}

/**
 * Traits (AVENGER, S.H.I.E.L.D., ...) are printed in ALL CAPS on cards and the
 * set keeps growing every cycle — an enum would need editing forever. Model
 * as a normalized nominal string instead of a closed union.
 */
type Brand<T, B extends string> = T & { readonly __brand: B };
export type Trait = Brand<string, "Trait">;
export const trait = (value: string): Trait => value.trim().toUpperCase() as Trait;

export type { ArtRef };
