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
  | "environment"
  | "evidence";

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
  /**
   * Printed amplify icons, a positive whole number when present. RRG 1.8 "Amplify Icon" (p. 7): "When a boost card is
   * turned faceup during an enemy activation, add one additional boost icon to that card for each amplify icon in
   * play", and "Each amplify icon is equivalent to the following constant ability: 'Each boost card gains [boost].'"
   *
   * On `BaseCard` rather than in `SchemeIcon`, because the icon is printed on many card types and the rule counts it
   * wherever it is in play: side schemes (Vendetta 16054), an attachment (The Beyonder's Blazer 16124), a minion
   * (`bp` 51034), allies (`deadpool` 44014, 44016), an upgrade (`fne` 60031), a player side scheme (`deadpool` 44024),
   * an environment (`mojo` 39041) and an obligation (`synthezoid` 57072). MarvelCDB's field is `scheme_amplify` on
   * all of them. docs/phase7-wave3.md §1.2.
   */
  readonly amplifyIcons?: number;
}
