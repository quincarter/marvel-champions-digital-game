import type { CardText, Trait } from "../common.js";
import type { KeywordInstance } from "../keywords.js";
import type { AbilityReference } from "../abilities.js";
import type { ArtRef, CardId, EncounterSetId } from "../ids.js";
import type { BaseCard } from "./base.js";

export interface HeroFace {
  readonly faceName: string;
  readonly atk: number;
  readonly thw: number;
  readonly def: number;
  readonly handSize: number;
  /** Keywords are per face (Black Panther's Retaliate 1 is hero-side only). */
  readonly keywords: readonly KeywordInstance[];
  readonly text: CardText;
  readonly flavor?: string;
  readonly abilities: readonly AbilityReference[];
  readonly art?: ArtRef;
}

export interface AlterEgoFace {
  readonly faceName: string;
  readonly rec: number;
  readonly handSize: number;
  readonly keywords: readonly KeywordInstance[];
  readonly text: CardText;
  readonly flavor?: string;
  readonly abilities: readonly AbilityReference[];
  readonly art?: ArtRef;
}

/**
 * One double-sided card, modeled as one record. HP is on the identity, not a
 * face: damage persists across a flip (RRG "Identity"), so it's shared state.
 * Traits and keywords are per-face — e.g. the hero side is AVENGER but the
 * alter-ego is not.
 */
export interface HeroIdentityCard extends BaseCard {
  readonly type: "hero_identity";
  readonly hp: number;
  readonly hero: HeroFace & { readonly traits: readonly Trait[] };
  readonly alterEgo: AlterEgoFace & { readonly traits: readonly Trait[] };
  /** The hero's obligation card, shuffled into the encounter deck at setup. */
  readonly obligationCardId: CardId;
  /** The hero's nemesis encounter set, set aside at setup. */
  readonly nemesisEncounterSetId: EncounterSetId;
}
