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

const BARRICADE_OF_BLADES = twoSided(
  SET,
  "main_scheme",
  "65001",
  1,
  {
    name: "A Barricade of Blades",
    over: {
      stage: "1A",
      text: "<b>Contents</b>: Shadows in the Night, Dark Protégé, and Standard encounter sets. One modular encounter set <i>(Ninja Swarm)</i>.\n<b>Setup</b>: Put each The Streets Below environment into play. Set the Dark Protégé encounter set aside. Choose 1 random villain from that set and reveal its side A, then shuffle each card linked to that villain into the encounter deck.",
    },
  },
  {
    name: "A Barricade of Blades",
    over: {
      stage: "1B",
      threat: 7,
      base_threat: 2,
      escalation_threat: 1,
      text: "In expert mode, the villain gets +1 SCH and +3[per_hero] hit points.\n<b>Forced Interrupt</b>: When the villain would be defeated on side A, instead flip it to side B, reset its hit points, and change the villain's position. Deal each player 1 facedown encounter card.\n<b>If the villain is defeated on side B, the players win the game.</b>",
    },
  },
);

const FORTRESS_LOCKDOWN = twoSided(
  SET,
  "main_scheme",
  "65002",
  2,
  {
    name: "Fortress Lockdown",
    over: {
      stage: "2A",
      illustrator: "Facundo Moyano",
      text: "<i>While the forces on the outside hold the heroes back, ninjas on the inside lock every door and window.</i>\nIn expert mode, the villain gets +3[per_hero] hit points.\n<b>When Revealed</b>: Change the villain's position. Each player searches the encounter deck and discard pile for a minion and reveals it. <i>(Shuffle.)</i>",
    },
  },
  {
    name: "Fortress Lockdown",
    over: {
      stage: "2B",
      threat: 8,
      base_threat: 2,
      escalation_threat: 1,
      illustrator: "Facundo Moyano",
      text: "In expert mode, the villain gets +1 SCH and +3[per_hero] hit points.\n<b>Forced Interrupt</b>: When the villain would be defeated on side A, instead flip it to side B, reset its hit points, and change the villain's position. Deal each player 1 facedown encounter card.\n<b>If the villain is defeated on side B, the players win the game.</b>\n<b>If this stage is completed, the players lose the game.</b>",
    },
  },
);

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

const GHOST_MAKER = single(SET, "minion", "65006", "Ghost Maker", 6, {
  traits: "Hand. Ninja.",
  is_unique: true,
  scheme: 1,
  attack: 2,
  health: 4,
  boost_star: true,
  illustrator: "Kyle Petchock",
  text: `<b>When Defeated</b>: Change the villain's position if it has not changed this phase. If the villain's position is Atop the Tenshu, discard 1 card you control; otherwise, take 2 indirect damage.${HR}[star] <b>Boost</b>: If an ally is defending against this attack, reveal this minion.`,
});

const SEALED_ENTRANCES = single(SET, "side_scheme", "65007", "Sealed Entrances", 7, {
  base_threat: 4,
  base_threat_fixed: true,
  scheme_crisis: 1,
  boost: 2,
  illustrator: "Eduardo Mello",
  text: "Assault. <i>(Basic thwarts against this scheme use ATK instead of THW.)</i>\n<b>When Defeated</b>: Change the villain's position if it has not changed this phase.",
});

const STRATEGIC_POSITIONING = single(SET, "side_scheme", "65008", "Strategic Positioning", 8, {
  base_threat: 3,
  boost: 2,
  flavor: "Under Shadowland, the Hand rules the streets.",
  text: "While the villain's position is The Streets Below, this scheme gains 1 acceleration icon ([acceleration]).\nWhile the villain's position is Atop the Tenshu, this scheme gains 1 hazard icon ([hazard]).",
});

const SURROUND_THE_FORTRESS = single(SET, "side_scheme", "65009", "Surround the Fortress", 9, {
  base_threat: 2,
  scheme_crisis: 1,
  boost: 1,
  text: "<b>When Revealed</b>: Change the villain's position if it has not changed this phase. If the villain's position is Atop the Tenshu, place 1[per_hero] threat on the main scheme; otherwise, place 1[per_hero] threat here.",
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
    BARRICADE_OF_BLADES,
    'Image 65001A.webp and Image 65001B.webp (footer "SHADOWS IN THE NIGHT (1/13)", 1A and 1B, no illustrator printed). MAIN SCHEME, stage 1A (top right). Side A: "Contents: Shadows in the Night, Dark Protégé, and Standard encounter sets. One modular encounter set (italic: Ninja Swarm). Setup: Put each The Streets Below environment into play. Set the Dark Protégé encounter set aside. Choose 1 random villain from that set and reveal its side A, then shuffle each card linked to that villain into the encounter deck." Side B (stage 1B): top-left circle 7 with the per player icon (threshold); lower right box 2 with the per player icon (starting threat); upper box +1 with the per player icon (escalation). "In expert mode, the villain gets +1 SCH and +3 (per player) hit points. Forced Interrupt: When the villain would be defeated on side A, instead flip it to side B, reset its hit points, and change the villain\'s position. Deal each player 1 facedown encounter card. If the villain is defeated on side B, the players win the game." (last line bold). Second check (D3, 2026-10-22): read from the card image, every field agrees with the record.',
  ),
  added(
    FORTRESS_LOCKDOWN,
    'Image 65002A.webp and Image 65002B.webp (footer "SHADOWS IN THE NIGHT (2/13)", 2A and 2B, Facundo Moyano on both). MAIN SCHEME, stage 2A. Side A: italic flavor "While the forces on the outside hold the heroes back, ninjas on the inside lock every door and window." "In expert mode, the villain gets +3 (per player) hit points. When Revealed: Change the villain\'s position. Each player searches the encounter deck and discard pile for a minion and reveals it. (italic: Shuffle.)" Side B (stage 2B): top-left circle 8 with the per player icon (threshold); lower right box 2 with the per player icon (starting threat); upper box +1 with the per player icon (escalation). "In expert mode, the villain gets +1 SCH and +3 (per player) hit points. Forced Interrupt: When the villain would be defeated on side A, instead flip it to side B, reset its hit points, and change the villain\'s position. Deal each player 1 facedown encounter card. If the villain is defeated on side B, the players win the game. If this stage is completed, the players lose the game." (last two lines bold). Second check (D3, 2026-10-22): read from the card image, every field agrees with the record.',
  ),
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
    GHOST_MAKER,
    'Image 65006.webp (footer "SHADOWS IN THE NIGHT (6/13)", 6, Kyle Petchock). Unique star, MINION, "HAND. NINJA.", SCH 1, ATK 2, hit points 4 (no per player icon), boost icon is the star only. "When Defeated: Change the villain\'s position if it has not changed this phase. If the villain\'s position is Atop the Tenshu, discard 1 card you control; otherwise, take 2 indirect damage. [rule] (star) Boost: If an ally is defending against this attack, reveal this minion." Second check (D3, 2026-10-22): read from the card image, every field agrees with the record.',
  ),
  added(
    SEALED_ENTRANCES,
    'Image 65007.webp (landscape; footer "SHADOWS IN THE NIGHT (7/13)", 7, Eduardo Mello). SIDE SCHEME, no traits, starting threat 4 with no per player icon (fixed), one crisis icon (the burst with an exclamation mark, as on Dead End 65042), two boost icons. "Assault. (italic reminder: Basic thwarts against this scheme use ATK instead of THW.) When Defeated: Change the villain\'s position if it has not changed this phase." Second check (D3, 2026-10-22): read from the card image, every field agrees; the two red marks at the lower left are the two boost icons; the burst with an exclamation mark is the crisis icon, confirmed against the RRG v1.8 icon key (p. 22) and Crisis Icon entry (p. 14).',
  ),
  added(
    STRATEGIC_POSITIONING,
    'Scan mc65_cards_strategic-positioning.png (landscape; footer "SHADOWS IN THE NIGHT (8/13)", 8, no illustrator printed). SIDE SCHEME, starting threat 3 with the per player icon, no scheme icons printed in the corner (the two icons are in the text), two boost icons. Flavor: "Under Shadowland, the Hand rules the streets." Text: "While the villain\'s position is The Streets Below, this scheme gains 1 acceleration icon ([acceleration]). While the villain\'s position is Atop the Tenshu, this scheme gains 1 hazard icon ([hazard])." The two in-text icons were zoomed: the first is the house-and-plus acceleration icon, the second the card-and-plus hazard icon.',
  ),
  added(
    SURROUND_THE_FORTRESS,
    'Image 65009.webp (landscape; footer "SHADOWS IN THE NIGHT (9/13)", 9, no illustrator printed). SIDE SCHEME, no traits, starting threat 2 with the per player icon, one crisis icon (burst with an exclamation mark), one boost icon. "When Revealed: Change the villain\'s position if it has not changed this phase. If the villain\'s position is Atop the Tenshu, place 1 (per player) threat on the main scheme; otherwise, place 1 (per player) threat here." Second check (D3, 2026-10-22): read from the card image, every field agrees; the burst with an exclamation mark is the crisis icon, confirmed against the RRG v1.8 icon key (p. 22) and Crisis Icon entry (p. 14).',
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
