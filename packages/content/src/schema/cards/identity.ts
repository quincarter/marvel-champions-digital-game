import type { CardText, Trait } from "../common.js";
import type { KeywordInstance } from "../keywords.js";
import type { AbilityReference } from "../abilities.js";
import type { ArtRef } from "../ids.js";
import type { BaseCard } from "./base.js";

export interface HeroFace {
  readonly faceName: string;
  readonly atk: number;
  readonly thw: number;
  readonly def: number;
  readonly handSize: number;
  readonly text: CardText;
  readonly flavor?: string;
  readonly abilities: readonly AbilityReference[];
  readonly art?: ArtRef;
}

export interface AlterEgoFace {
  readonly faceName: string;
  readonly rec: number;
  readonly handSize: number;
  readonly text: CardText;
  readonly flavor?: string;
  readonly abilities: readonly AbilityReference[];
  readonly art?: ArtRef;
}

/**
 * One double-sided card, modeled as one record. HP is on the identity, not a
 * face: damage persists across a flip (RRG "Identity"), so it's shared state.
 * Traits are per-face — e.g. the hero side is AVENGER but the alter-ego is not.
 */
export interface HeroIdentityCard extends BaseCard {
  readonly type: "hero_identity";
  readonly hp: number;
  readonly keywords: readonly KeywordInstance[];
  readonly hero: HeroFace & { readonly traits: readonly Trait[] };
  readonly alterEgo: AlterEgoFace & { readonly traits: readonly Trait[] };
}
