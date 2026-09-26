/**
 * Shape of a MarvelCDB public-API card record
 * (`https://marvelcdb.com/api/public/cards/<pack>`), restricted to the fields
 * ingestion reads. Everything is optional/nullable because MarvelCDB omits or
 * nulls fields freely per card type — the normalizer decides what a missing
 * value means for each card type rather than trusting a default here.
 *
 * Asset/reference fields (`imagesrc`, `backimagesrc`, `meta`, `octgn_id`, `url`)
 * are kept verbatim in the raw cache. They are *references* — MarvelCDB paths,
 * an OCTGN guid, a MarvelCDB page URL — not image bytes; no art is stored in the
 * repo, which is the CLAUDE.md IP boundary. The normalized schema still models
 * art separately via `ArtRef` (see `src/schema/ids.ts`) and ingestion does not
 * copy these into the emitted card data.
 */
export interface RawCard {
  readonly code: string;
  readonly name: string;
  readonly real_name?: string | null;
  readonly subname?: string | null;
  readonly pack_code: string;
  readonly pack_name?: string;
  readonly type_code: RawTypeCode;
  readonly faction_code: string;
  readonly card_set_code?: string | null;
  readonly card_set_name?: string | null;
  readonly card_set_type_name_code?: string | null;
  readonly position: number;
  readonly set_position?: number | null;
  readonly quantity: number;
  readonly deck_limit?: number | null;
  readonly is_unique?: boolean;
  readonly hidden?: boolean;
  readonly double_sided?: boolean;
  readonly linked_to_code?: string | null;
  readonly linked_card?: RawCard | null;
  readonly duplicated_by?: readonly string[] | null;
  /**
   * The code of the card this one is a reprint of (e.g. The Rise of Red Skull's Avengers Tower, 04021, names
   * Captain America's 03024) — the inverse of `duplicated_by`. Recorded on `CardProvenance.duplicateOfCardId` so
   * a MarvelCDB decklist naming either code can resolve to the same card (Phase 9 deck import); ingestion itself
   * still emits the reprint as its own card, matching the wave 1 reprint-art policy.
   */
  readonly duplicate_of_code?: string | null;

  readonly text?: string | null;
  readonly real_text?: string | null;
  readonly flavor?: string | null;
  readonly traits?: string | null;
  readonly real_traits?: string | null;
  readonly errata?: string | null;
  /**
   * A double-sided *player* card's back face, sent inline on the front record itself (no `linked_card`) — Vision's
   * Intangible/Dense (`vision` 26002, docs/phase7-wave4.md §1.2). Distinct from the `linked_card`-nested back face
   * an encounter card or the Hydra Campaign upgrades use (`readFlipSide` in `normalize/single-cards.ts`).
   */
  readonly back_name?: string | null;
  readonly back_text?: string | null;

  readonly cost?: number | null;
  readonly cost_per_hero?: boolean;
  readonly attack?: number | null;
  readonly attack_cost?: number | null;
  readonly attack_star?: boolean;
  readonly thwart?: number | null;
  readonly thwart_cost?: number | null;
  readonly thwart_star?: boolean;
  readonly defense?: number | null;
  readonly defense_star?: boolean;
  readonly recover?: number | null;
  readonly recover_star?: boolean;
  readonly scheme?: number | null;
  readonly scheme_star?: boolean;
  readonly health?: number | null;
  readonly health_per_hero?: boolean;
  readonly health_per_group?: boolean;
  readonly health_star?: boolean;
  readonly hand_size?: number | null;

  readonly base_threat?: number | null;
  readonly base_threat_fixed?: boolean;
  readonly base_threat_per_group?: boolean;
  readonly threat?: number | null;
  readonly threat_fixed?: boolean;
  readonly threat_per_group?: boolean;
  readonly escalation_threat?: number | null;
  readonly escalation_threat_fixed?: boolean;
  readonly scheme_crisis?: number | null;
  readonly scheme_acceleration?: number | null;
  readonly scheme_hazard?: number | null;
  /** The printed amplify icon count (`BaseCard.amplifyIcons`, `CardFlipSide.amplifyIcons`). docs/phase7-wave3.md §1.2. */
  readonly scheme_amplify?: number | null;
  readonly stage?: string | null;

  readonly boost?: number | null;
  readonly boost_star?: boolean;

  readonly resource_energy?: number | null;
  readonly resource_mental?: number | null;
  readonly resource_physical?: number | null;
  readonly resource_wild?: number | null;

  /** MarvelCDB-relative path to the card front image (e.g. `/bundles/cards/01001a.png`). */
  readonly imagesrc?: string | null;
  /** MarvelCDB-relative path to the back-face image of a double-sided card. */
  readonly backimagesrc?: string | null;
  /** Free-form MarvelCDB metadata blob; shape varies per card. */
  readonly meta?: unknown;
  /** OCTGN card guid, for cross-referencing other community tools. */
  readonly octgn_id?: string | null;
  /** Canonical MarvelCDB page for the card. */
  readonly url?: string | null;
}

export type RawTypeCode =
  | "hero"
  | "alter_ego"
  | "ally"
  | "event"
  | "support"
  | "upgrade"
  | "resource"
  | "villain"
  | "main_scheme"
  | "side_scheme"
  | "minion"
  | "attachment"
  | "treachery"
  | "obligation"
  | "environment"
  | "player_side_scheme"
  // Seen in the full 63-pack survey (2026-09-13), not present in Core:
  // "leader" — Civil War / Synthezoid multiplayer "team" villain-side cards
  // (card_set_type_name_code "leader"); faction_code "encounter" like a
  // villain, but a distinct type_code MarvelCDB doesn't fold into "villain".
  // "evidence_means"/"evidence_motive"/"evidence_opportunity" — Agents of
  // S.H.I.E.L.D.'s investigation-board encounter cards (card_set_code
  // "executive_board_evidence"). Neither has a schema shape yet; see the
  // card-data-pipeline survey report for the gap-matrix entry.
  | "leader"
  | "evidence_means"
  | "evidence_motive"
  | "evidence_opportunity";
