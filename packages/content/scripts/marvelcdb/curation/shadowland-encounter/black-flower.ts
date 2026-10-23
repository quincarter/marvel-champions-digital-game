/**
 * Shadowland (MC65) Black Flower, a modular set (13 printed copies, collector 72A onward). Conventions in `common.ts`.
 *
 * Creeping Corruption 72A (Setup side) and 72B (OVERPOWERING side) is one double-sided upgrade. The Aka footer is
 * "BLACK FLOWER (5/13)", so positions 1 to 4 are four copies of Creeping Corruption (the insert, pp. 9, 14, puts one into
 * play under each player's control and sets the rest aside; "Max 1 per player" for up to four players). The rest of the
 * set (Aka 5, Tongue of the Beast 6, Binding Ritual 7, Roots of a Black Flower 8 to 9, Malediction 10 to 11, Invasive
 * Thoughts 12 to 13) is transcribed from the full-size scans (owner-approved 2026-10-22).
 *
 * Icons: the burst with an exclamation mark is the crisis icon (the glyph of Dead End 42 and the other scheme_crisis
 * records), the house with a plus is acceleration and the card with a plus is hazard (Strategic Positioning 65008).
 */
import type { AddedRecord } from "../types.ts";
import { added, BLACK_FLOWER as SET, HR, single, twoSided } from "./common.ts";

const CREEPING_CORRUPTION = twoSided(
  SET,
  "upgrade",
  "65072",
  1,
  {
    name: "Creeping Corruption",
    over: {
      quantity: 4,
      illustrator: "Sebastián Guidobono",
      text: "Permanent. Setup. Max 1 per player.\nIf there are at least 5 corruption counters here, remove each of them from here and flip this card.\n<b>Action</b>: Exhaust Creeping Corruption and place 1 corruption counter here → draw 1 card.",
    },
  },
  {
    name: "Creeping Corruption",
    over: {
      quantity: 4,
      traits: "Overpowering.",
      illustrator: "Sebastián Guidobono",
      text: "Permanent. Max 1 per player.\n<b>If there are at least 5 corruption counters here, you are defeated.</b>\n<b>Action</b>: Exhaust Creeping Corruption and place 1 corruption counter here → draw 2 cards, then discard 1 card from your hand.",
    },
  },
);

const AKA = single(SET, "minion", "65073", "Aka", 5, {
  traits: "Hand. Ninja.",
  is_unique: true,
  scheme: 1,
  attack: 3,
  attack_star: true,
  health: 6,
  boost: 1,
  boost_star: true,
  text: `Quickstrike. Villainous.\n[star] <b>Interrupt</b>: When Aka would attack you, you may place 1 corruption counter on your Creeping Corruption. If you do, cancel that attack.${HR}[star] <b>Boost</b>: Choose: Either place 1 corruption counter on your Creeping Corruption, or discard 1 random card from your hand.`,
});

const TONGUE_OF_THE_BEAST = single(SET, "minion", "65074", "Tongue of the Beast", 6, {
  traits: "Demon. Hand.",
  is_unique: true,
  scheme: 1,
  attack: 2,
  health: 1,
  boost_star: true,
  text: `<b>When Defeated</b>: The defeating player places 2 corruption counters on their Creeping Corruption.${HR}[star] <b>Boost</b>: Choose: Either place 1 corruption counter on your Creeping Corruption, or this card gains [boost][boost][boost].`,
});

const BINDING_RITUAL = single(SET, "side_scheme", "65075", "Binding Ritual", 7, {
  base_threat: 1,
  scheme_crisis: 1,
  boost: 2,
  flavor: '"He whom we serve shall reign supreme!"—Takashi',
  text: "<b>When Revealed</b>: Each player chooses:\n• Place 1 corruption counter on their Creeping Corruption.\n• Place 3 threat here.",
});

const ROOTS_OF_A_BLACK_FLOWER = single(SET, "side_scheme", "65076", "Roots of a Black Flower", 8, {
  quantity: 2,
  base_threat: 1,
  base_threat_fixed: true,
  scheme_acceleration: 2,
  boost_star: true,
  illustrator: "Kyle Petchock",
  text: `<b>When Defeated</b>: The defeating player places 2 corruption counters on their Creeping Corruption.${HR}[star] <b>Boost</b>: Choose: Either place 1 corruption counter on your Creeping Corruption, or place 4 threat on the main scheme.`,
});

const MALEDICTION = single(SET, "treachery", "65077", "Malediction", 10, {
  quantity: 2,
  boost: 1,
  illustrator: "Andrea Di Vito & Laura Villari",
  text: "<b>When Revealed (Alter-Ego)</b>: You may place 2 corruption counters on your Creeping Corruption. If you do not, the villain schemes with +2 SCH.\n<b>When Revealed (Hero)</b>: If your Creeping Corruption has the [[Overpowering]] trait, the villain schemes with +1 SCH; otherwise, the villain attacks you.",
});

const INVASIVE_THOUGHTS = single(SET, "treachery", "65078", "Invasive Thoughts", 12, {
  quantity: 2,
  boost_star: true,
  illustrator: "Facundo Moyano",
  text: `<b>When Revealed</b>: Place 1 corruption counter on your Creeping Corruption. If it has the [[Overpowering]] trait, place 1 threat on the main scheme; otherwise, take 1 damage.${HR}[star] <b>Boost</b>: Choose: Either place 1 corruption counter on your Creeping Corruption, or take 4 indirect damage.`,
});

export const BLACK_FLOWER_RECORDS: readonly AddedRecord[] = [
  added(
    CREEPING_CORRUPTION,
    'Scans mc65_cards_creeping_corruption_a-side.png (footer "BLACK FLOWER (1/13)", 72A, Sebastián Guidobono) and mc65_cards_creeping_corruption-overwhelming_side.png (same footer, 72B, Sebastián Guidobono). UPGRADE (side-title layout), cost box a dash on both faces (the card is put into play by the campaign instructions or Setup), no stat box, no boost icons, no resource icons. Side A, no traits: "Permanent. Setup. Max 1 per player. If there are at least 5 corruption counters here, remove each of them from here and flip this card. Action: Exhaust Creeping Corruption and place 1 corruption counter here -> draw 1 card." Side B, "OVERPOWERING.": "Permanent. Max 1 per player. If there are at least 5 corruption counters here, you are defeated. (bold) Action: Exhaust Creeping Corruption and place 1 corruption counter here -> draw 2 cards, then discard 1 card from your hand." Answers docs/phase7-shadowland.md Q8: the printed text says the player is defeated. Four copies (positions 1 to 4): the Aka footer is 5/13 (Image 65073.webp), so the four numbers before it are this card. Second check (D3, 2026-10-22): agrees (the four-copy quantity is confirmed: the set is 13 copies, and Aka 1 + Tongue 1 + Binding Ritual 1 + Roots 2 + Malediction 2 + Invasive Thoughts 2 = 9 leaves 4 for Creeping Corruption; the 72 faces themselves were not re-read in this pass).',
  ),
  added(
    AKA,
    'Image 65073.webp (footer "BLACK FLOWER (5/13)", 73, no illustrator printed). Unique star, MINION, "HAND. NINJA.", SCH 1, ATK 3 with a star, hit points 6 (orange circle), boost icons one red mark plus the star. "Quickstrike. Villainous. (star) Interrupt: When Aka would attack you, you may place 1 corruption counter on your Creeping Corruption. If you do, cancel that attack. [rule] (star) Boost: Choose: Either place 1 corruption counter on your Creeping Corruption, or discard 1 random card from your hand." Second check (D3, 2026-10-22): agrees.',
  ),
  added(
    TONGUE_OF_THE_BEAST,
    'Image 65074.webp (footer "BLACK FLOWER (6/13)", 74, no illustrator printed). Unique star, MINION, "DEMON. HAND.", SCH 1, ATK 2, hit points 1 (orange circle), boost icon is the star only. "When Defeated: The defeating player places 2 corruption counters on their Creeping Corruption. [rule] (star) Boost: Choose: Either place 1 corruption counter on your Creeping Corruption, or this card gains (three boost icons)." Second check (D3, 2026-10-22): agrees.',
  ),
  added(
    BINDING_RITUAL,
    'Image 65075.webp (landscape; footer "BLACK FLOWER (7/13)", 75, no illustrator printed). SIDE SCHEME, no traits, starting threat 1 with the per player icon, one scheme icon: the burst with an exclamation mark, the crisis icon (the glyph described for Dead End 42, which sets scheme_crisis), two boost icons. Flavor: "He whom we serve shall reign supreme!" -Takashi. "When Revealed: Each player chooses: (bullet) Place 1 corruption counter on their Creeping Corruption. (bullet) Place 3 threat here." One copy: Roots is 9/13 with two copies (8 and 9), so 7/13 is the only copy. Second check (D3, 2026-10-22): agrees.',
  ),
  added(
    ROOTS_OF_A_BLACK_FLOWER,
    'Image 65076.webp (landscape; footer "BLACK FLOWER (9/13)", 76, Kyle Petchock). SIDE SCHEME, no traits, starting threat 1 with no per player icon (fixed), two scheme icons: the house with a plus, the acceleration icon (Strategic Positioning 65008), boost icon is the star only. "When Defeated: The defeating player places 2 corruption counters on their Creeping Corruption. [rule] (star) Boost: Choose: Either place 1 corruption counter on your Creeping Corruption, or place 4 threat on the main scheme." Two copies: Binding Ritual is 7/13 and Malediction 10/13, so 8/13 and 9/13 are Roots (set_position 8, the image is the 9/13 copy). Second check (D3, 2026-10-22): agrees.',
  ),
  added(
    MALEDICTION,
    'Image 65077.webp (footer "BLACK FLOWER (10/13)", 77, Andrea Di Vito & Laura Villari). TREACHERY, no traits, one boost icon (a red mark, no star). "When Revealed (Alter-Ego): You may place 2 corruption counters on your Creeping Corruption. If you do not, the villain schemes with +2 SCH. When Revealed (Hero): If your Creeping Corruption has the OVERPOWERING trait, the villain schemes with +1 SCH; otherwise, the villain attacks you." Two copies: 10/13 and 11/13 (Invasive Thoughts is 12/13). Second check (D3, 2026-10-22): agrees.',
  ),
  added(
    INVASIVE_THOUGHTS,
    'Image 65078.webp (footer "BLACK FLOWER (12/13)", 78, Facundo Moyano). TREACHERY, no traits, boost icon is the star only. "When Revealed: Place 1 corruption counter on your Creeping Corruption. If it has the OVERPOWERING trait, place 1 threat on the main scheme; otherwise, take 1 damage. [rule] (star) Boost: Choose: Either place 1 corruption counter on your Creeping Corruption, or take 4 indirect damage." Two copies: 12/13 and 13/13. Second check (D3, 2026-10-22): agrees.',
  ),
];
