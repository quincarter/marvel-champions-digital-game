import type { ArtRef, ImageRef } from "./ids.js";

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
  /**
   * A value printed with the per group icon (Trickster Takeover's God of Lies scenario: Door Between Worlds 55046's
   * starting threat "7 per group", Worlds Collide 55028b's target threat "2 per group"): the printed numeral times the
   * number of groups. Absent on every other value (the committed data carries no `perGroup: 0`). When present, `base`
   * and `perPlayer` are 0: a value is flat, per player or per group, never a mix.
   *
   * MC55 insert p. 4: "If the per group icon is on a card in a group's game area, that icon multiplies the value it
   * is next to by the number of groups in the respective pod. If the icon is on a card that is not in a specific
   * group's game area (such as the Worlds Collide main scheme), that icon multiplies the value it is next to by the
   * total number of groups in the game." In single-table play (Single Group Mode, insert p. 10: "the only group in your
   * pod is your own group") a group is the whole table, so the count of groups is 1 and `perGroup` is the numeral
   * itself. Epic Multiplayer Mode (several groups) is not built.
   */
  readonly perGroup?: number;
}

export const flat = (base: number): ScalingValue => ({ base, perPlayer: 0 });
export const perPlayerOnly = (perPlayer: number): ScalingValue => ({ base: 0, perPlayer });
/** A value printed with the per group icon ("2 per group" → `perGroupOnly(2)`). */
export const perGroupOnly = (perGroup: number): ScalingValue => ({ base: 0, perPlayer: 0, perGroup });
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

export type { ArtRef, ImageRef };

/**
 * Upstream artwork for a card, one reference per printed face.
 *
 * `front` and `back` are the two sides of one physical card. A single-faced
 * card has only `front`. What counts as the "back" depends on the card:
 *
 * - a double-sided encounter or scheme card: the printed reverse
 *   (MarvelCDB's `backimagesrc`);
 * - a hero identity: the alter-ego face, which MarvelCDB publishes as a
 *   *linked card* rather than a back image — the faces also carry their own
 *   `image`, so a consumer never has to know which side is which.
 *
 * Cards whose faces the schema models separately (villain stages, main scheme
 * A/B sides) put the reference on the face instead, since each of those is its
 * own printed card rather than a side of this one.
 */
export interface CardImages {
  readonly front?: ImageRef;
  readonly back?: ImageRef;
}
