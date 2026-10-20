/**
 * Shadowland (MC65) Ninja Swarm, a modular set (9 printed copies, collector 28 to 36, one copy each). Transcribed from
 * the Hall of Heroes previews; conventions in `common.ts`.
 *
 * Seen (5 of 9): Black Mountain 28, Bo Staff Ninja 30, Katana Ninja 32, Dancing Shadows 35, Countless Numbers 36. Not
 * previewed, so not transcribed: collector 29, 31, 33 and 34 (the FFG article says seven Ninja minions, so these are
 * presumably the other minions).
 */
import type { AddedRecord } from "../types.ts";
import { added, HR, NINJA_SWARM as SET, single } from "./common.ts";

const DEFEATED_TEXT =
  "<b>When Defeated</b>: The defeating player discards the top 2 cards of the encounter deck and reveals the first minion with the teamwork keyword discarded this way.";

const BLACK_MOUNTAIN = single(SET, "minion", "65028", "Black Mountain", 1, {
  traits: "Brute. Hand. Ninja.",
  is_unique: true,
  scheme: 2,
  attack: 2,
  health: 5,
  boost_star: true,
  illustrator: "Andrea Di Vito & Laura Villari",
  text: `Guard.\nWhile Black Mountain is engaged with you, each other [[Ninja]] minion engaged with you cannot be attacked.${HR}[star] <b>Boost</b>: If an ally is defending against this attack, reveal this minion.`,
});

const BO_STAFF_NINJA = single(SET, "minion", "65030", "Bo Staff Ninja", 3, {
  traits: "Hand. Ninja.",
  scheme: 1,
  attack: 1,
  health: 2,
  boost: 2,
  illustrator: "Andrea Di Vito & Laura Villari",
  text: `Teamwork ([[Ninja]]). Toughness.\n${DEFEATED_TEXT}`,
});

const KATANA_NINJA = single(SET, "minion", "65032", "Katana Ninja", 5, {
  traits: "Hand. Ninja.",
  scheme: 1,
  attack: 1,
  health: 2,
  boost: 1,
  text: `Guard. Teamwork ([[Ninja]]).\n${DEFEATED_TEXT}`,
});

const DANCING_SHADOWS = single(SET, "side_scheme", "65035", "Dancing Shadows", 8, {
  base_threat: 3,
  base_threat_fixed: true,
  boost_star: true,
  text: `Each [[Ninja]] minion gets +1 hit point.\nThreat cannot be removed from this scheme while at least 1 [[Ninja]] minion is in play.${HR}[star] <b>Boost</b>: Reveal this card.`,
});

const COUNTLESS_NUMBERS = single(SET, "treachery", "65036", "Countless Numbers", 9, {
  boost: 1,
  boost_star: true,
  text: `Surge.\n<b>When Revealed</b>: Shuffle each [[Ninja]] minion in the encounter discard pile into the encounter deck.${HR}[star] <b>Boost</b>: Resolve this card's "<b>When Revealed</b>" ability.`,
});

export const NINJA_SWARM_RECORDS: readonly AddedRecord[] = [
  added(
    BLACK_MOUNTAIN,
    'Scan mc65_cards_black_mountain.png (footer "NINJA SWARM (1/9)", 28, Andrea Di Vito & Laura Villari). Unique star, MINION, "BRUTE. HAND. NINJA.", SCH 2, ATK 2, hit points 5 (no per player icon), boost icon is the star only. "Guard. While Black Mountain is engaged with you, each other NINJA minion engaged with you cannot be attacked. [rule] (star) Boost: If an ally is defending against this attack, reveal this minion."',
  ),
  added(
    BO_STAFF_NINJA,
    'Scan mc65_cards_bo_staff_ninja.png (footer "NINJA SWARM (3/9)", 30, Andrea Di Vito & Laura Villari). MINION, "HAND. NINJA.", SCH 1, ATK 1, hit points 2, two boost icons. "Teamwork (NINJA). Toughness. When Defeated: The defeating player discards the top 2 cards of the encounter deck and reveals the first minion with the teamwork keyword discarded this way."',
  ),
  added(
    KATANA_NINJA,
    'Scan mc65_cards_katana_ninja.png (footer "NINJA SWARM (5/9)", 32, no illustrator printed). MINION, "HAND. NINJA.", SCH 1, ATK 1, hit points 2, one boost icon. "Guard. Teamwork (NINJA). When Defeated: The defeating player discards the top 2 cards of the encounter deck and reveals the first minion with the teamwork keyword discarded this way."',
  ),
  added(
    DANCING_SHADOWS,
    'Scan mc65_cards_dancing_shadows.png (landscape; footer "NINJA SWARM (8/9)", 35, no illustrator printed). SIDE SCHEME, no traits, starting threat 3 with no per player icon (fixed), no scheme icons, boost icon is the star only. "Each NINJA minion gets +1 hit point. Threat cannot be removed from this scheme while at least 1 NINJA minion is in play. [rule] (star) Boost: Reveal this card."',
  ),
  added(
    COUNTLESS_NUMBERS,
    'Scan mc65_cards_countless_numbers.png (footer "NINJA SWARM (9/9)", 36, no illustrator printed). TREACHERY, no traits, boost icons star plus one. "Surge. When Revealed: Shuffle each NINJA minion in the encounter discard pile into the encounter deck. [rule] (star) Boost: Resolve this card\'s "When Revealed" ability."',
  ),
];
