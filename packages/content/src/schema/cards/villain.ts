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
  /**
   * True on a face that prints **no** hit points of its own — The Collector's and Hela's back faces (`gmw`
   * 16080b/16081b, `mts` 21136b/21137b), which read "cannot be defeated" and carry no hit point value at all.
   *
   * `hp` still holds the value that applies, because the hit point dial carries across the flip (RRG 1.8 "Flip",
   * p. 20; the Green Goblin insert, Risky Business "New Rules": "all attachment cards, status cards, boost cards,
   * damage, and other game elements associated with the villain remain as they are") — which is also why the back
   * face's own text has to say "set [the villain's] hit point dial to his printed hit points" when it flips back.
   * The validator checks that it repeats the same stage number's hit points from the face that does print them, so
   * the value is a *verified* carry-over rather than a number the pipeline invented, and every reader keeps working.
   *
   * Only a later side may set it. docs/phase7-wave2.md §11.2.
   */
  readonly hpNotPrinted?: boolean;
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
 * A villain face's letter. `"C"` is the inside face of a foldable, "three-sided" villain card (wave 2 schema pass,
 * docs/phase7-wave2.md §6.9): The Age of Apocalypse's Apocalypse (45184–45186) prints three forms on each stage card,
 * Biomorph (`…a`), Cyberpath (`…b`) and Giant (`…c`), which card abilities choose between by form trait ("change
 * Apocalypse to [Giant] form", Staggering Strength; "Apocalypse begins the game in [Biomorph] form", En Sabah Nur's
 * Pyramid 1A). RRG 1.8 "Flip" (p. 20): "A foldable, 'three-sided' card is considered to have flipped any time the faceup
 * side of the card changes."
 */
export type VillainSideLetter = "A" | "B" | "C";

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
  readonly side: VillainSideLetter;
  /** The face's title. Usually the card's name; a two-sided villain's faces differ ("Norman Osborn" / "Green Goblin"). */
  readonly name: string;
  readonly stages: readonly [VillainStage, ...VillainStage[]];
}

export interface VillainCard extends BaseCard {
  readonly type: "villain";
  readonly encounterSetIds: readonly EncounterSetId[];
  /**
   * One side, the two faces of double-sided stage cards, or the three faces of foldable stage cards (see `VillainSide`
   * and `VillainSideLetter`). Every side lists the same stage numbers.
   */
  readonly sides: readonly [VillainSide, ...VillainSide[]];
  /**
   * The face that is up when the villain enters play at setup. Absent means `"A"`. Risky Business main scheme
   * 1A, "Contents": "Norman Osborn (I) and Norman Osborn (II)" (MarvelCDB lists the Green Goblin faces as the
   * top-level records and nests Norman Osborn as the hidden linked card, the other way round).
   */
  readonly startingSide?: VillainSideLetter;
  /**
   * `"leader"` for a card printed with the Leader card type (Civil War's Iron Man, Captain Marvel, Captain America and
   * Spider-Woman; Synthezoid's She-Hulk and Vision; MarvelCDB `type_code: "leader"`). RRG 1.8 "Leader" (p. 26): "The
   * leader card type follows the same rules as the villain card type for all purposes." The Civil War rulebook,
   * "Leaders" (p. 3): "Leaders are used in place of villains in Civil War scenarios and they function exactly the same as
   * villains. [...] Game rules and card abilities that affect or interact with villains affect leaders the same way."
   * So it is a `VillainCard` with the printed type recorded for the card abilities that name "a leader". Each leader
   * prints stages I–IV: "Chosen leader I and II (III and IV for expert mode)" (Superhero Registration Act 1A, "Contents").
   * See docs/phase7-wave2.md §6.3.
   */
  readonly printedType?: "leader";
  /**
   * The printed activation order value (The Sinister Six: Doctor Octopus "Activation Order 1" … Vulture 6; MarvelCDB
   * prints it in the traits field). RRG 1.8 FAQ, The Sinister Six (p. 62): "Place the active counter on the villain with
   * the lowest activation order value and continue that activation." A positive whole number.
   */
  readonly activationOrder?: number;
}
