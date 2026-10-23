/**
 * Shadowland (MC65) Heart of Shadow, the scenario #3 set (17 printed copies, collector 57 to 71). Conventions in
 * `common.ts`.
 *
 * Every collector number 57 to 71 is transcribed (15 cards, 17 copies). Krahllak 57 to 59 are three separate one-sided
 * villain cards (stages I, II and III; the site has no 65057B), recorded as three single records the way the Fear No
 * Evil villains are (`fne-encounter/villains-a.ts`: one record per stage numeral): the normalizer groups them by name
 * into one villain with stages 1 to 3. Krahllak I (57), Mark of the Wicked 64, Pull of Power 65, Hellbride 67, Snakeroot
 * Elders 69 and Submit or Suffer 71 are from the Hall of Heroes previews; 58 to 63, 66, 68 and the recheck of 70 are from
 * the full-size scans. Veil of Nightmares 70 (14/17 and 15/17) and
 * Submit or Suffer 71 (16/17 and 17/17) have two copies each.
 */
import type { AddedRecord } from "../types.ts";
import { added, HEART_OF_SHADOW as SET, HR, single, twoSided } from "./common.ts";

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

const KRAHLLAK_II = single(SET, "villain", "65058", "Krahllak", 2, {
  stage: "II",
  health: 21,
  health_per_hero: true,
  scheme: 2,
  attack: 4,
  attack_star: true,
  traits: "Demon. Hand.",
  is_unique: true,
  illustrator: "Bruno Frenda & Sara Cuomo",
  text: "Steady. Toughness.\n[star] Krahllak's attacks gain overkill.\n[star] <b>Interrupt</b>: When Krahllak attacks you, you may place 1 corruption counter on your Creeping Corruption. If you do, Krahllak gets -3 ATK for this attack.",
});

const KRAHLLAK_III = single(SET, "villain", "65059", "Krahllak", 3, {
  stage: "III",
  health: 25,
  health_per_hero: true,
  scheme: 3,
  attack: 4,
  attack_star: true,
  traits: "Demon. Hand.",
  is_unique: true,
  illustrator: "Bruno Frenda & Sara Cuomo",
  text: "Retaliate 1. Steady. Toughness.\n[star] Krahllak's attacks gain overkill and piercing.\n[star] <b>Interrupt</b>: When Krahllak attacks you, you may place 1 corruption counter on your Creeping Corruption. If you do, Krahllak gets -3 ATK for this attack.",
});

// Main schemes: the A face (Contents and Setup, or flavor and When Revealed) and the B face (threshold in the top-left
// circle, escalation in the upper box, starting threat in the lower box, all with the per player icon).
const DARK_INVITATION = twoSided(
  SET,
  "main_scheme",
  "65060",
  4,
  {
    name: "Dark Invitation",
    over: {
      stage: "1A",
      illustrator: "Andrea Di Vito & Laura Villari",
      text: "<b>Contents</b>: Krahllak (I) and Krahllak (II). <i>(Krahllak (II) and Krahllak (III) instead for expert mode.)</i> Heart of Shadow, Black Flower, and Standard encounter sets. One modular encounter set <i>(Ninja Swarm)</i>.\n<b>Setup</b>: Each player puts a Creeping Corruption upgrade into play. Set the rest aside.",
    },
  },
  {
    name: "Dark Invitation",
    over: {
      stage: "1B",
      threat: 6,
      base_threat: 2,
      escalation_threat: 1,
      illustrator: "Andrea Di Vito & Laura Villari",
      text: "<b>Forced Interrupt</b>: When this stage would be completed, instead remove all threat from here and each player chooses:\n• Place 2 corruption counters on their Creeping Corruption.\n• Take 3 damage and deal themself 1 facedown encounter card.\n<b>Forced Response</b>: After Krahllak is defeated, advance this scheme to stage 2A.",
    },
  },
);

const BEAST_BE_PRAISED = twoSided(
  SET,
  "main_scheme",
  "65061",
  5,
  {
    name: "Beast Be Praised",
    over: {
      stage: "2A",
      flavor: "An inferno erupts in the throne room, punishing those who have yet to succumb to Krahllak's dark will.",
      text: "<b>When Revealed</b>: Each player whose Creeping Corruption has the [[Overpowering]] trait discards 1 random card from their hand. Each other player discards a card they control from play. In expert mode, deal each player 1 facedown encounter card.",
    },
  },
  {
    name: "Beast Be Praised",
    over: {
      stage: "2B",
      threat: 9,
      base_threat: 2,
      escalation_threat: 1,
      escalation_threat_star: true,
      text: "[star] <b>Forced Response</b>: After resolving step one of the villain phase, each player chooses:\n• Place 1 corruption counter on their Creeping Corruption.\n• Place 3 threat here.\n<b>If this stage is completed, the players lose the game.</b>",
    },
  },
);

const DARK_SHROUD = single(SET, "attachment", "65062", "Dark Shroud", 6, {
  traits: "Spell.",
  attack: 1,
  boost: 1,
  illustrator: "Eduardo Mello",
  text: "Attach to Krahllak.\n<b>Interrupt</b>: When you or an ally you control would deal 4 or more damage to Krahllak with an attack, instead prevent all of that damage, place 1 corruption counter on your Creeping Corruption, and discard this card.",
});

const FEAR_PROJECTION = single(SET, "attachment", "65063", "Fear Projection", 7, {
  traits: "Spell.",
  boost: 1,
  text: "Attach to Krahllak.\nKrahllak gains retaliate 1.\n<b>Hero Action</b>: Place 2 corruption counters on your Creeping Corruption → discard this card.\n<b>Alter-Ego Action</b>: Spend [mental][mental][mental] resources → discard this card. Remove 1 corruption counter from your Creeping Corruption.",
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

const FIST = single(SET, "minion", "65066", "Fist", 10, {
  traits: "Hand. Undead.",
  is_unique: true,
  scheme: 2,
  attack: 2,
  health: 6,
  boost: 2,
  flavor:
    "A half-dead monstrosity brought to life by the mystical arts of the Hand, Fist won't stop until its mission is complete.",
  text: "Patrol. Retaliate 2.\n<b>Hero Action</b>: Place 1 corruption counter on your Creeping Corruption → deal 4 damage to Fist.",
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

const RETAINER = single(SET, "minion", "65068", "Retainer", 12, {
  traits: "Brute. Demon. Hand.",
  is_unique: true,
  scheme: 1,
  attack: 4,
  attack_star: true,
  health: 9,
  boost: 3,
  flavor: "Krahllak's avatar, summoned to exact vengeance.",
  text: "[star] Retainer's attacks gain overkill.\n[star] <b>Interrupt</b>: When Retainer attacks you, you may place 1 corruption counter on your Creeping Corruption. If you do, Retainer gets -3 ATK for this attack.",
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
    'Scan mc65_cards_krahllak.png (footer "HEART OF SHADOW (1/17) / HIT POINTS 18" with the per player icon, 57, Bruno Frenda & Sara Cuomo). Unique star, VILLAIN, stage numeral I (top right), SCH 2, ATK 3 with a star, "DEMON. HAND." "Steady. (star) Interrupt: When Krahllak attacks you, you may place 1 corruption counter on your Creeping Corruption. If you do, Krahllak gets -3 ATK for this attack." (the printed minus is an en dash, recorded -3). Flavor: "There is only the Beast!" One-sided; stages II and III are the separate cards 65058 and 65059. UNCERTAIN: no full-size scan of 65057 exists (the preview is the only source), and stages II and III both print "Toughness" and "attacks gain overkill" that the preview transcription of stage I lacks; recheck 65057 against a full scan.',
  ),
  added(
    KRAHLLAK_II,
    'Image 65058.webp (footer "HEART OF SHADOW (2/17) / HIT POINTS 21" with the per player icon, 58, Bruno Frenda & Sara Cuomo). Unique star, VILLAIN, stage numeral II, SCH 2, ATK 4 with a star, "DEMON. HAND." "Steady. Toughness. (star) Krahllak\'s attacks gain overkill. (star) Interrupt: When Krahllak attacks you, you may place 1 corruption counter on your Creeping Corruption. If you do, Krahllak gets -3 ATK for this attack." One-sided; recorded as its own code with stage "II", grouped with 65057 and 65059 by name and numeral. Second check (D3, 2026-10-22): agrees.',
  ),
  added(
    KRAHLLAK_III,
    'Image 65059.webp (footer "HEART OF SHADOW (3/17) / HIT POINTS 25" with the per player icon, 59, Bruno Frenda & Sara Cuomo). Unique star, VILLAIN, stage numeral III, SCH 3, ATK 4 with a star, "DEMON. HAND." "Retaliate 1. Steady. Toughness. (star) Krahllak\'s attacks gain overkill and piercing. (star) Interrupt: When Krahllak attacks you, you may place 1 corruption counter on your Creeping Corruption. If you do, Krahllak gets -3 ATK for this attack." One-sided; stage "III". Second check (D3, 2026-10-22): agrees.',
  ),
  added(
    DARK_INVITATION,
    'Images 65060A.webp and 65060B.webp (footer "HEART OF SHADOW (4/17)", 60A/60B, Andrea Di Vito & Laura Villari). MAIN SCHEME stage 1A: "Contents: Krahllak (I) and Krahllak (II). (Krahllak (II) and Krahllak (III) instead for expert mode.) Heart of Shadow, Black Flower, and Standard encounter sets. One modular encounter set (Ninja Swarm). Setup: Each player puts a Creeping Corruption upgrade into play. Set the rest aside." Stage 1B: top-left circle 6 with the per player icon (threshold), upper box +1 with the per player icon (escalation), lower box 2 with the per player icon (starting threat). "Forced Interrupt: When this stage would be completed, instead remove all threat from here and each player chooses: (bullet) Place 2 corruption counters on their Creeping Corruption. (bullet) Take 3 damage and deal themself 1 facedown encounter card. Forced Response: After Krahllak is defeated, advance this scheme to stage 2A." Second check (D3, 2026-10-22): agrees.',
  ),
  added(
    BEAST_BE_PRAISED,
    'Images 65061A.webp and 65061B.webp (footer "HEART OF SHADOW (5/17)", 61A/61B, no illustrator printed). MAIN SCHEME stage 2A: italic flavor "An inferno erupts in the throne room, punishing those who have yet to succumb to Krahllak\'s dark will." "When Revealed: Each player whose Creeping Corruption has the OVERPOWERING trait discards 1 random card from their hand. Each other player discards a card they control from play. In expert mode, deal each player 1 facedown encounter card." Stage 2B: top-left circle 9 with the per player icon (threshold), upper box +1 with the per player icon and a star (escalation, `escalation_threat_star`), lower box 2 with the per player icon (starting threat). "(star) Forced Response: After resolving step one of the villain phase, each player chooses: (bullet) Place 1 corruption counter on their Creeping Corruption. (bullet) Place 3 threat here. If this stage is completed, the players lose the game." (bold). Second check (D3, 2026-10-22): agrees.',
  ),
  added(
    DARK_SHROUD,
    'Image 65062.webp (footer "HEART OF SHADOW (6/17)", 62, Eduardo Mello). ATTACHMENT (side-title layout), "SPELL.", stat box +1 ATK (no star), one boost icon. "Attach to Krahllak. Interrupt: When you or an ally you control would deal 4 or more damage to Krahllak with an attack, instead prevent all of that damage, place 1 corruption counter on your Creeping Corruption, and discard this card." Second check (D3, 2026-10-22): agrees.',
  ),
  added(
    FEAR_PROJECTION,
    'Image 65063.webp (footer "HEART OF SHADOW (7/17)", 63, no illustrator printed). ATTACHMENT (side-title layout), "SPELL.", no stat box, one boost icon. "Attach to Krahllak. Krahllak gains retaliate 1. Hero Action: Place 2 corruption counters on your Creeping Corruption -> discard this card. Alter-Ego Action: Spend (three resource icons) resources -> discard this card. Remove 1 corruption counter from your Creeping Corruption." The three resource glyphs are the node-and-link (molecule) cluster, the glyph of [mental] (Media Coverage 02049; there is no "scientific" resource), transcribed [mental][mental][mental]. Second check (D3, 2026-10-22): agrees.',
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
    FIST,
    'Image 65066.webp (footer "HEART OF SHADOW (10/17)", 66, no illustrator printed). Unique star, MINION, "HAND. UNDEAD.", SCH 2, ATK 2, hit points 6 (orange circle), two boost icons. "Patrol. Retaliate 2. Hero Action: Place 1 corruption counter on your Creeping Corruption -> deal 4 damage to Fist." Flavor: "A half-dead monstrosity brought to life by the mystical arts of the Hand, Fist won\'t stop until its mission is complete." Second check (D3, 2026-10-22): agrees.',
  ),
  added(
    HELLBRIDE,
    'Scan mc65_cards__hellbride.png (footer "HEART OF SHADOW (11/17)", 67, no illustrator printed). Unique star, MINION, "DEMON. HAND.", SCH 1, ATK 3, hit points 7, three boost icons. "When Defeated: The defeating player places 2 corruption counters on their Creeping Corruption, then heals 6 damage from their identity. Hero Action: If Hellbride has 2 or fewer remaining hit points, exhaust your hero -> discard Hellbride. Remove 1 corruption counter from your Creeping Corruption."',
  ),
  added(
    RETAINER,
    'Image 65068.webp (footer "HEART OF SHADOW (12/17)", 68, no illustrator printed). Unique star, MINION, "BRUTE. DEMON. HAND.", SCH 1, ATK 4 with a star, hit points 9 (orange circle), three boost icons. "(star) Retainer\'s attacks gain overkill. (star) Interrupt: When Retainer attacks you, you may place 1 corruption counter on your Creeping Corruption. If you do, Retainer gets -3 ATK for this attack." Flavor: "Krahllak\'s avatar, summoned to exact vengeance." Second check (D3, 2026-10-22): agrees.',
  ),
  added(
    SNAKEROOT_ELDERS,
    'Scan mc65_cards_snakeroot_elders.png (footer "HEART OF SHADOW (13/17)", 69, no illustrator printed). Unique star, MINION, "HAND. MYSTIC. NINJA.", SCH 1, ATK 2, hit points 8, three boost icons. "While there is at least 1 corruption counter here, Snakeroot Elders gains guard and patrol. When Revealed: You may place 1 corruption counter on your Creeping Corruption. If you do not, place 1 corruption counter here."',
  ),
  added(
    VEIL_OF_NIGHTMARES,
    'Image 65070.webp (landscape; footer "HEART OF SHADOW (14/17)", 70, Kyle Petchock; rechecked against the full scan, the preview transcription stands). SIDE SCHEME, no traits, starting threat 5 with the per player icon, one scheme icon (a card with a plus: hazard, as printed on Strategic Positioning 65008; not the house-and-plus acceleration icon), two boost icons. Flavor: "Krahllak\'s dark magic can tap into a person\'s deepest fears." "Hero Action: Place 1 corruption counter on your Creeping Corruption -> remove 5 threat from this scheme." Two copies: the next card (Submit or Suffer, collector 71) is footer 16/17, so 15/17 is a second copy (not seen). Second check (D3, 2026-10-22): agrees.',
  ),
  added(
    SUBMIT_OR_SUFFER,
    'Scan mc65_cards_submit_or_suffer.png (footer "HEART OF SHADOW (16/17)", 71, no illustrator printed). TREACHERY, no traits, boost icon is the star only. "When Revealed: Choose: Either place 1 corruption counter on your Creeping Corruption, or remove 1 corruption counter from your Creeping Corruption and Krahllak attacks you. [rule] (star) Boost: Choose: Either place 1 corruption counter on your Creeping Corruption, or stun your identity." Two copies: footer 16/17 and the set total 17 (17/17 is the second copy, not seen).',
  ),
];
