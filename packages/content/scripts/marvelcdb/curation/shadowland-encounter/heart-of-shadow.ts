/**
 * Shadowland (MC65) Heart of Shadow, the scenario #3 set (17 printed copies, collector 57 to 71). Transcribed from the
 * Hall of Heroes previews; conventions in `common.ts`.
 *
 * Seen (8 of 15 collector numbers): Krahllak 57 (villain), Mark of the Wicked 64, Pull of Power 65, Hellbride 67,
 * Snakeroot Elders 69, Veil of Nightmares 70 (two copies, 14/17 and 15/17) and Submit or Suffer 71 (two copies, 16/17 and
 * 17/17). Not previewed, so not transcribed: collector 58 to 63 (positions 2 to 7: the main scheme faces and the other
 * scenario cards) and 66 and 68 (positions 10 and 12).
 */
import type { AddedRecord } from "../types.ts";
import { added, HEART_OF_SHADOW as SET, HR, single } from "./common.ts";

const KRAHLLAK = single(SET, "villain", "65057", "Krahllak", 1, {
  stage: "I",
  health: 18,
  health_per_hero: true,
  scheme: 2,
  attack: 3,
  attack_star: true,
  traits: "Demon. Hand.",
  is_unique: true,
  illustrator: "Bruno Frenda & Sara Cuomo",
  flavor: '"There is only the Beast!"',
  text: "Steady.\n[star] <b>Interrupt</b>: When Krahllak attacks you, you may place 1 corruption counter on your Creeping Corruption. If you do, Krahllak gets -3 ATK for this attack.",
});

const MARK_OF_THE_WICKED = single(SET, "attachment", "65064", "Mark of the Wicked", 8, {
  traits: "Spell.",
  attack: 2,
  attack_star: true,
  boost: 3,
  text: "<b>When Revealed</b>: You may attach this card to your identity. If you do not, take 4 damage, stun your identity, remove 1 corruption counter from your Creeping Corruption, and discard this card.\n[star] <b>Forced Response</b>: After attached hero makes a basic attack, place 1 corruption counter on your Creeping Corruption.",
});

const PULL_OF_POWER = single(SET, "attachment", "65065", "Pull of Power", 9, {
  traits: "Spell.",
  thwart: 2,
  thwart_star: true,
  boost: 2,
  text: "<b>When Revealed</b>: You may attach this card to your identity. If you do not, take 4 damage, confuse your identity, remove 1 corruption counter from your Creeping Corruption, and discard this card.\n[star] <b>Forced Response</b>: After attached hero makes a basic thwart, place 1 corruption counter on your Creeping Corruption.",
});

const HELLBRIDE = single(SET, "minion", "65067", "Hellbride", 11, {
  traits: "Demon. Hand.",
  is_unique: true,
  scheme: 1,
  attack: 3,
  health: 7,
  boost: 3,
  text: "<b>When Defeated</b>: The defeating player places 2 corruption counters on their Creeping Corruption, then heals 6 damage from their identity.\n<b>Hero Action</b>: If Hellbride has 2 or fewer remaining hit points, exhaust your hero → discard Hellbride. Remove 1 corruption counter from your Creeping Corruption.",
});

const SNAKEROOT_ELDERS = single(SET, "minion", "65069", "Snakeroot Elders", 13, {
  traits: "Hand. Mystic. Ninja.",
  is_unique: true,
  scheme: 1,
  attack: 2,
  health: 8,
  boost: 3,
  text: "While there is at least 1 corruption counter here, Snakeroot Elders gains guard and patrol.\n<b>When Revealed</b>: You may place 1 corruption counter on your Creeping Corruption. If you do not, place 1 corruption counter here.",
});

const VEIL_OF_NIGHTMARES = single(SET, "side_scheme", "65070", "Veil of Nightmares", 14, {
  quantity: 2,
  base_threat: 5,
  scheme_hazard: 1,
  boost: 2,
  illustrator: "Kyle Petchock",
  flavor: "Krahllak's dark magic can tap into a person's deepest fears.",
  text: "<b>Hero Action</b>: Place 1 corruption counter on your Creeping Corruption → remove 5 threat from this scheme.",
});

const SUBMIT_OR_SUFFER = single(SET, "treachery", "65071", "Submit or Suffer", 16, {
  quantity: 2,
  boost_star: true,
  text: `<b>When Revealed</b>: Choose: Either place 1 corruption counter on your Creeping Corruption, or remove 1 corruption counter from your Creeping Corruption and Krahllak attacks you.${HR}[star] <b>Boost</b>: Choose: Either place 1 corruption counter on your Creeping Corruption, or stun your identity.`,
});

export const HEART_OF_SHADOW_RECORDS: readonly AddedRecord[] = [
  added(
    KRAHLLAK,
    'Scan mc65_cards_krahllak.png (footer "HEART OF SHADOW (1/17) / HIT POINTS 18" with the per player icon, 57, Bruno Frenda & Sara Cuomo). Unique star, VILLAIN, stage numeral I (top right), SCH 2, ATK 3 with a star, "DEMON. HAND." "Steady. (star) Interrupt: When Krahllak attacks you, you may place 1 corruption counter on your Creeping Corruption. If you do, Krahllak gets -3 ATK for this attack." (the printed minus is an en dash, recorded -3). Flavor: "There is only the Beast!" The card is single stage in the preview; no other stage was seen.',
  ),
  added(
    MARK_OF_THE_WICKED,
    'Scan mc65_cards_mark_of_the_wicked.png (footer "HEART OF SHADOW (8/17)", 64, no illustrator printed). ATTACHMENT (side-title layout), "SPELL.", stat box +2 ATK with a star after the numeral, three boost icons. "When Revealed: You may attach this card to your identity. If you do not, take 4 damage, stun your identity, remove 1 corruption counter from your Creeping Corruption, and discard this card. (star) Forced Response: After attached hero makes a basic attack, place 1 corruption counter on your Creeping Corruption."',
  ),
  added(
    PULL_OF_POWER,
    'Scan mc65_cards_pull_of_power.png (footer "HEART OF SHADOW (9/17)", 65, no illustrator printed). ATTACHMENT (side-title layout), "SPELL.", stat box +2 THW with a star after the numeral, two boost icons. "When Revealed: You may attach this card to your identity. If you do not, take 4 damage, confuse your identity, remove 1 corruption counter from your Creeping Corruption, and discard this card. (star) Forced Response: After attached hero makes a basic thwart, place 1 corruption counter on your Creeping Corruption."',
  ),
  added(
    HELLBRIDE,
    'Scan mc65_cards__hellbride.png (footer "HEART OF SHADOW (11/17)", 67, no illustrator printed). Unique star, MINION, "DEMON. HAND.", SCH 1, ATK 3, hit points 7, three boost icons. "When Defeated: The defeating player places 2 corruption counters on their Creeping Corruption, then heals 6 damage from their identity. Hero Action: If Hellbride has 2 or fewer remaining hit points, exhaust your hero -> discard Hellbride. Remove 1 corruption counter from your Creeping Corruption."',
  ),
  added(
    SNAKEROOT_ELDERS,
    'Scan mc65_cards_snakeroot_elders.png (footer "HEART OF SHADOW (13/17)", 69, no illustrator printed). Unique star, MINION, "HAND. MYSTIC. NINJA.", SCH 1, ATK 2, hit points 8, three boost icons. "While there is at least 1 corruption counter here, Snakeroot Elders gains guard and patrol. When Revealed: You may place 1 corruption counter on your Creeping Corruption. If you do not, place 1 corruption counter here."',
  ),
  added(
    VEIL_OF_NIGHTMARES,
    'Scan mc65_cards_veil_of_nightmares.png (landscape; footer "HEART OF SHADOW (14/17)", 70, Kyle Petchock). SIDE SCHEME, no traits, starting threat 5 with the per player icon, one scheme icon (zoomed 6x: a card with a plus, the hazard icon, not the house-and-plus acceleration icon), two boost icons. Flavor: "Krahllak\'s dark magic can tap into a person\'s deepest fears." "Hero Action: Place 1 corruption counter on your Creeping Corruption -> remove 5 threat from this scheme." Two copies: the next card (Submit or Suffer, collector 71) is footer 16/17, so 15/17 is a second copy (not seen).',
  ),
  added(
    SUBMIT_OR_SUFFER,
    'Scan mc65_cards_submit_or_suffer.png (footer "HEART OF SHADOW (16/17)", 71, no illustrator printed). TREACHERY, no traits, boost icon is the star only. "When Revealed: Choose: Either place 1 corruption counter on your Creeping Corruption, or remove 1 corruption counter from your Creeping Corruption and Krahllak attacks you. [rule] (star) Boost: Choose: Either place 1 corruption counter on your Creeping Corruption, or stun your identity." Two copies: footer 16/17 and the set total 17 (17/17 is the second copy, not seen).',
  ),
];
