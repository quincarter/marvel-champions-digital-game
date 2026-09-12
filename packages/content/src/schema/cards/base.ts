import type { ArtRef, CardId, CycleId, SetCode } from "../ids.js";
import type { CardImages, ErrataStatus } from "../common.js";

export type CardType =
  | "hero_identity"
  | "ally"
  | "event"
  | "support"
  | "upgrade"
  | "resource"
  | "player_side_scheme"
  | "villain"
  | "minion"
  | "attachment"
  | "main_scheme"
  | "side_scheme"
  | "treachery"
  | "obligation"
  | "environment";

/**
 * `art` is a lookup key into a gitignored *local* asset folder; `images` points
 * at the artwork where the source publishes it. Neither is image bytes, and no
 * art is stored in this repo (CLAUDE.md "Content & IP boundaries").
 */
export interface BaseCard {
  readonly id: CardId;
  readonly type: CardType;
  readonly name: string;
  readonly subtitle?: string;
  readonly setCode: SetCode;
  readonly cycleId: CycleId;
  readonly collectorNumber: string;
  readonly quantityInSet: number;
  readonly unique: boolean;
  readonly art?: ArtRef;
  /**
   * Upstream artwork, by printed face. Absent for a card whose faces the schema
   * models separately — a villain's stages and a main scheme's A/B sides each
   * carry their own `image`, because each is its own printed card.
   */
  readonly images?: CardImages;
  readonly errata?: ErrataStatus;
}
