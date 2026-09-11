/**
 * Shape of a MarvelCDB public-API card record
 * (`https://marvelcdb.com/api/public/cards/<pack>`), restricted to the fields
 * ingestion reads. Everything is optional/nullable because MarvelCDB omits or
 * nulls fields freely per card type — the normalizer decides what a missing
 * value means for each card type rather than trusting a default here.
 *
 * Art/asset fields (`imagesrc`, `backimagesrc`, `meta`, `octgn_id`, `url`) are
 * deliberately absent: they are stripped before the raw cache is written (see
 * `ART_FIELDS`) so no image URL is ever committed (CLAUDE.md IP boundary).
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

  readonly text?: string | null;
  readonly real_text?: string | null;
  readonly flavor?: string | null;
  readonly traits?: string | null;
  readonly real_traits?: string | null;
  readonly errata?: string | null;

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
  readonly stage?: string | null;

  readonly boost?: number | null;
  readonly boost_star?: boolean;

  readonly resource_energy?: number | null;
  readonly resource_mental?: number | null;
  readonly resource_physical?: number | null;
  readonly resource_wild?: number | null;
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
  | "player_side_scheme";

/**
 * Fields that point at card art or third-party asset metadata. Stripped from
 * every record (and from `linked_card`) before anything is written to disk.
 */
export const ART_FIELDS = ["imagesrc", "backimagesrc", "meta", "octgn_id", "url"] as const;
