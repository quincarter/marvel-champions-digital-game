import type { ArtRef, CardId, CycleId, SetCode } from "../ids.js";
import type { ErrataStatus } from "../common.js";

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

/** Art is an `ArtRef` lookup key only — never bytes or a URL (CLAUDE.md IP boundary). */
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
  readonly errata?: ErrataStatus;
}
