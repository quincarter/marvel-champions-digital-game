import type { CardText, ScalingValue, Trait } from "../common.js";
import type { KeywordInstance } from "../keywords.js";
import type { AbilityReference } from "../abilities.js";
import type { EncounterSetId, ImageRef } from "../ids.js";
import type { BaseCard } from "./base.js";

/** A villain stat that can be printed as "—". A villain has no THW, DEF or REC to print. */
export type VillainDashStat = "atk" | "sch";

export interface VillainStage {
  /**
   * The stage's position in the villain deck, used for ordering and for difficulty ranges.
   * For a stage printed with a numeral (I/II/III) it is that numeral: standard uses I–II, expert II–III.
   * For a stage printed with a version letter instead (see `stageLabel`) it is the letter's position
   * (A = 1, B = 2), and the card has no printed stage number.
   */
  readonly stageNumber: number;
  /**
   * The printed stage label when it is not a roman numeral. The Wrecking Crew prints villain versions "A" and
   * "B". The insert, "Adjustable Difficulty": "To play in standard mode, put each version-A villain into play
   * during setup. To play in expert mode, put each version-B villain into play during setup instead. [...] For an
   * extreme challenge, start with each version-A villain in play and put each villain's version B under it. When
   * the version A of a villain is defeated, its version B enters play, and the game is won only after all
   * version-B villains are defeated." So A and B are consecutive stages of one villain deck, not faces.
   * Either every stage of a side has a label or none does.
   */
  readonly stageLabel?: string;
  readonly hp: ScalingValue;
  /** Printed ATK. 0 when `dashedStats` lists `"atk"`. */
  readonly atk: number;
  /** Printed SCH. 0 when `dashedStats` lists `"sch"`. */
  readonly sch: number;
  /**
   * Stats printed as "—" (RRG 1.8 "Dash (Value)": the character "cannot exhaust to use that power", and a
   * referenced dash "is treated as an unmodifiable 0"). Norman Osborn prints no ATK and Risky Business's Green
   * Goblin no SCH; the Green Goblin insert, Risky Business "New Rules": "Norman Osborn does not have an attack
   * power value". The matching numeric field holds 0.
   *
   * Kept beside `atk`/`sch` instead of widening them to `PrintedStat`, so existing readers keep compiling; the
   * engine must read it (docs/phase7-wave1.md §3.3).
   */
  readonly dashedStats?: readonly VillainDashStat[];
  readonly text: CardText;
  readonly traits: readonly Trait[];
  readonly keywords: readonly KeywordInstance[];
  readonly abilities: readonly AbilityReference[];
  /** Upstream artwork. Each stage is its own printed card, so the ref lives here. */
  readonly image?: ImageRef;
}

/**
 * One face of a villain deck.
 *
 * A villain with one side is a deck of single-faced stage cards. A villain with two sides is a deck of
 * double-sided stage cards: `sides[0].stages[i]` and `sides[1].stages[i]` are the two faces of one physical card,
 * so both sides list the same stage numbers. A card ability changes which face is up during play ("flip Norman
 * Osborn and Criminal Enterprise").
 *
 * The Green Goblin insert, Risky Business "New Rules": "After the villain changes form, all attachment cards,
 * status cards, boost cards, damage, and other game elements associated with the villain remain as they are.
 * Changing form will trigger Green Goblin's 'When Revealed' ability." and "After a villain stage is defeated, the
 * next stage of the villain deck enters play on the same side as the just defeated stage."
 *
 * Not to be confused with a hero identity's faces, and not with `VillainStage.stageLabel` versions.
 */
export interface VillainSide {
  readonly side: "A" | "B";
  /** The face's title. Usually the card's name; a two-sided villain's faces differ ("Norman Osborn" / "Green Goblin"). */
  readonly name: string;
  readonly stages: readonly [VillainStage, ...VillainStage[]];
}

export interface VillainCard extends BaseCard {
  readonly type: "villain";
  readonly encounterSetIds: readonly EncounterSetId[];
  /** One side, or the two faces of double-sided stage cards (see `VillainSide`). */
  readonly sides: readonly [VillainSide, ...VillainSide[]];
  /**
   * The face that is up when the villain enters play at setup. Absent means `"A"`. Risky Business main scheme
   * 1A, "Contents": "Norman Osborn (I) and Norman Osborn (II)" (MarvelCDB lists the Green Goblin faces as the
   * top-level records and nests Norman Osborn as the hidden linked card, the other way round).
   */
  readonly startingSide?: "A" | "B";
}
