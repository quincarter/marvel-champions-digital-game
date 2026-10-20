/**
 * Shadowland (MC65) Shadows in the Night, the scenario #1 set (13 printed copies, collector 1 to 11). Transcribed
 * from the Hall of Heroes previews; the conventions are in `common.ts`.
 *
 * Seen (7 of 11 collector numbers): the two double-sided environments 3A/3B and 4A/4B, Black Tarantula 5, Strategic
 * Positioning 8, Chaos in Hell's Kitchen 10 (two copies, 10/13 and 11/13) and Moonlit Silhouette 11 (two copies, 12/13
 * and 13/13). Not previewed, so not transcribed: collector 1 and 2 (the villain-side cards and main schemes: the
 * villain is chosen from Dark Protégé, so these are presumably the main scheme 1A/1B and 2A/2B), 6, 7 and 9.
 */
import type { AddedRecord } from "../types.ts";
import { added, HR, SHADOWS_IN_THE_NIGHT as SET, single, twoSided } from "./common.ts";

const VILLAIN_POSITION_TEXT =
  "If both positions are the same:\n• Each character gets +1 ATK.\nIf the positions are different:\n• Reduce the amount of damage each character takes from each attack by 1.\n• Threat cannot be removed from the main scheme.";

const STREETS_BELOW_VILLAIN = twoSided(
  SET,
  "environment",
  "65003",
  3,
  { name: "The Streets Below", over: { traits: "Villain Position.", text: VILLAIN_POSITION_TEXT } },
  { name: "Atop the Tenshu", over: { traits: "Villain Position.", text: VILLAIN_POSITION_TEXT } },
);

const STREETS_BELOW_HERO = twoSided(
  SET,
  "environment",
  "65004",
  4,
  {
    name: "The Streets Below",
    over: {
      traits: "Hero Position.",
      text: "<b>First Player Action</b>: Resolve one of the effects below, then flip this card:\n• Place 3 threat on the main scheme and stun your identity.\n• Spend [physical][physical] resources.\n• Spend 1 resource of any type and exhaust an [[Aerial]] character you control.",
    },
  },
  {
    name: "Atop the Tenshu",
    over: {
      traits: "Hero Position.",
      text: "<b>First Player Action</b>: Resolve one of the effects below, then flip this card:\n• Deal 3 damage to your identity.\n• Spend [energy][energy] resources.\n• Discard an ally or upgrade you control.",
    },
  },
);

const BLACK_TARANTULA = single(SET, "minion", "65005", "Black Tarantula", 5, {
  traits: "Brute. Hand.",
  is_unique: true,
  scheme: 2,
  attack: 2,
  health: 5,
  boost: 3,
  text: "Guard.\n<b>When Revealed</b>: Change the villain's position if it has not changed this phase. If the villain's position is Atop the Tenshu, Black Tarantula attacks you; otherwise, give the villain and Black Tarantula each a tough status card.",
});

const STRATEGIC_POSITIONING = single(SET, "side_scheme", "65008", "Strategic Positioning", 8, {
  base_threat: 3,
  boost: 2,
  flavor: "Under Shadowland, the Hand rules the streets.",
  text: "While the villain's position is The Streets Below, this scheme gains 1 acceleration icon ([acceleration]).\nWhile the villain's position is Atop the Tenshu, this scheme gains 1 hazard icon ([hazard]).",
});

const CHAOS_IN_HELLS_KITCHEN = single(SET, "treachery", "65010", "Chaos in Hell's Kitchen", 10, {
  quantity: 2,
  boost_star: true,
  illustrator: "Andrea Di Vito & Laura Villari",
  text: `<b>When Revealed</b>: Change the villain's position if it has not changed this phase. If the villain's position is Atop the Tenshu, place 2 threat on the main scheme; otherwise, take 2 damage.${HR}[star] <b>Boost</b>: Resolve this card's "<b>When Revealed</b>" ability.`,
});

const MOONLIT_SILHOUETTE = single(SET, "treachery", "65011", "Moonlit Silhouette", 12, {
  quantity: 2,
  illustrator: "Sebastián Guidobono",
  text: "<b>When Revealed (Alter-Ego)</b>: Change the villain's position if it has not changed this phase. You are confused.\n<b>When Revealed (Hero)</b>: If the villain's position is Atop the Tenshu, the villain schemes; otherwise, the villain attacks you.",
});

export const SHADOWS_IN_THE_NIGHT_RECORDS: readonly AddedRecord[] = [
  added(
    STREETS_BELOW_VILLAIN,
    'Scans mc65_cards_the_streets_below_villian.png (footer "SHADOWS IN THE NIGHT (3/13)", 3A, no illustrator printed) and mc65_cards_atop_the_tenshu_villian.png (same footer, 3B). ENVIRONMENT, "VILLAIN POSITION." on both sides, no stat box, no boost icons. Both sides print the same text: "If both positions are the same: * Each character gets +1 ATK. If the positions are different: * Reduce the amount of damage each character takes from each attack by 1. * Threat cannot be removed from the main scheme." A is "The Streets Below", B is "Atop the Tenshu".',
  ),
  added(
    STREETS_BELOW_HERO,
    'Scans mc65_cards_the_streets_below_hero.png (footer "SHADOWS IN THE NIGHT (4/13)", 4A) and mc65_cards_atop-the-tenshu_hero.png (4B). ENVIRONMENT, "HERO POSITION." Side A: "First Player Action: Resolve one of the effects below, then flip this card: * Place 3 threat on the main scheme and stun your identity. * Spend (physical) (physical) resources. * Spend 1 resource of any type and exhaust an AERIAL character you control." Side B: "... * Deal 3 damage to your identity. * Spend (energy) (energy) resources. * Discard an ally or upgrade you control." Resource icons: side A shows two fist-like blobs (the same glyph as the "Spend a [physical] resource" on the Tenacity 01093 scan) and side B two lightning bolts, so [physical][physical] and [energy][energy]. Second pass (D3) corrected a first-pass [mental][mental] on side A.',
  ),
  added(
    BLACK_TARANTULA,
    'Scan mc65_cards_black-tarantula.png (footer "SHADOWS IN THE NIGHT (5/13)", 5, no illustrator printed). Unique star, MINION, "BRUTE. HAND.", SCH 2, ATK 2, hit points 5 (no per player icon), three boost icons. "Guard. When Revealed: Change the villain\'s position if it has not changed this phase. If the villain\'s position is Atop the Tenshu, Black Tarantula attacks you; otherwise, give the villain and Black Tarantula each a tough status card."',
  ),
  added(
    STRATEGIC_POSITIONING,
    'Scan mc65_cards_strategic-positioning.png (landscape; footer "SHADOWS IN THE NIGHT (8/13)", 8, no illustrator printed). SIDE SCHEME, starting threat 3 with the per player icon, no scheme icons printed in the corner (the two icons are in the text), two boost icons. Flavor: "Under Shadowland, the Hand rules the streets." Text: "While the villain\'s position is The Streets Below, this scheme gains 1 acceleration icon ([acceleration]). While the villain\'s position is Atop the Tenshu, this scheme gains 1 hazard icon ([hazard])." The two in-text icons were zoomed: the first is the house-and-plus acceleration icon, the second the card-and-plus hazard icon.',
  ),
  added(
    CHAOS_IN_HELLS_KITCHEN,
    'Scan mc65_cards_chaos-in-hells-kitchen.png (footer "SHADOWS IN THE NIGHT (10/13)", 10, Andrea Di Vito & Laura Villari). TREACHERY, no traits, boost icon is the star only. "When Revealed: Change the villain\'s position if it has not changed this phase. If the villain\'s position is Atop the Tenshu, place 2 threat on the main scheme; otherwise, take 2 damage. [star] Boost: Resolve this card\'s "When Revealed" ability." Two copies: the next card (Moonlit Silhouette, collector 11) is footer 12/13, so 11/13 is a second copy of this card (not seen).',
  ),
  added(
    MOONLIT_SILHOUETTE,
    'Scan mc65_cards_moonlit-silhouette.png (footer "SHADOWS IN THE NIGHT (12/13)", 11, Sebastián Guidobono). TREACHERY, no traits, no boost icons. "When Revealed (Alter-Ego): Change the villain\'s position if it has not changed this phase. You are confused. When Revealed (Hero): If the villain\'s position is Atop the Tenshu, the villain schemes; otherwise, the villain attacks you." Two copies: footer 12/13 and the set total 13 (13/13 is the second copy, not seen).',
  ),
];
