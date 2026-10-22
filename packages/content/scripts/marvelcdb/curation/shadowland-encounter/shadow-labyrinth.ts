/**
 * Shadowland (MC65) Shadow Labyrinth, the scenario #2 set (11 printed copies, collector 37 to 45). Transcribed from the
 * full-size scans (play.marvelsimulator.com, owner-approved 2026-10-22); conventions in `common.ts`.
 *
 * All nine card numbers are transcribed: Shifting Corridors 37 (villain; it has NO B side, the site has no 65037B image),
 * the main schemes Into the Labyrinth 38A/38B (stage 1) and Chamber of Vile Secrets 39A/39B (stage 2), Whisper in the
 * Dark 40 (the TRAP! attachment), Lord Deathstrike 41, Dead End 42 and Hall of Hidden Doors 43 (side schemes), No Time to
 * Think! 44 (two copies, 8/11 and 9/11) and Sudden Shift 45 (two copies, 10/11 and 11/11).
 */
import type { AddedRecord } from "../types.ts";
import { added, HR, SHADOW_LABYRINTH as SET, single, twoSided } from "./common.ts";

const SHIFTING_CORRIDORS = single(SET, "villain", "65037", "Shifting Corridors", 1, {
  stage: "A",
  health: 0,
  scheme: 0,
  scheme_star: true,
  attack: 0,
  attack_star: true,
  traits: "Location.",
  illustrator: "Bruno Frenda & Sara Cuomo",
  text: "Stalwart.\n[star] <b>Forced Interrupt</b>: When Shifting Corridors would activate against you, instead remove 1 passage counter from here and reveal the top card of the trap deck.\n<b>If the last passage counter is removed from here, the players lose the game.</b>",
});

// Main schemes. B face: threat threshold (top-left circle), starting threat (lower box) and escalation (upper box).
const INTO_THE_LABYRINTH = twoSided(
  SET,
  "main_scheme",
  "65038",
  2,
  {
    name: "Into the Labyrinth",
    over: {
      stage: "1A",
      illustrator: "Andrea Di Vito & Laura Villari",
      text: "<b>Contents</b>: Shifting Corridors (A). Shadow Labyrinth, Dark Protégé, Deadly Contraptions, and Standard encounter sets. One modular encounter set <i>(Ninja Swarm)</i>.\n<b>Setup</b>: Create the trap deck <i>(see rulebook, p. 12)</i>. Set the Dark Protégé encounter set aside. Choose 1 random villain from that set, then shuffle each card linked to that villain into the encounter deck <i>(keep the chosen villain set aside)</i>.",
    },
  },
  {
    name: "Into the Labyrinth",
    over: {
      stage: "1B",
      threat: null,
      base_threat: 25,
      escalation_threat: 1,
      illustrator: "Andrea Di Vito & Laura Villari",
      text: "<b>When Revealed</b>: Place 10[per_hero] passage counters on Shifting Corridors (7[per_hero] instead in expert mode).\n<b>Forced Interrupt</b>: When Shifting Corridors would take any amount of damage, remove that much threat from here instead.\n<b>Forced Interrupt</b>: When the last threat is removed from this scheme, advance to stage 2A <i>(the players win by advancing)</i>.",
    },
  },
);

const CHAMBER_OF_VILE_SECRETS = twoSided(
  SET,
  "main_scheme",
  "65039",
  3,
  {
    name: "Chamber of Vile Secrets",
    over: {
      stage: "2A",
      illustrator: "Andrea Di Vito & Laura Villari",
      text: "<b>When Revealed</b>: Do each of the following:\n1. Set Shifting Corridors aside.\n2. Find the chosen Dark Protégé villain. Discard each status card, token, and attached card from it.\n3. Reveal the chosen villain's side A (side B instead in expert mode).",
    },
  },
  {
    name: "Chamber of Vile Secrets",
    over: {
      stage: "2B",
      threat: 9,
      base_threat: 1,
      escalation_threat: 1,
      illustrator: "Andrea Di Vito & Laura Villari",
      text: "<b>When Revealed</b>: In expert mode, the villain activates against each player.\n<b>Forced Response</b>: After you or an ally you control thwarts this scheme, reveal the top card of the trap deck. (Limit once per round per player.)\n<b>If this stage is completed, the players lose the game.</b>",
    },
  },
);

const WHISPER_IN_THE_DARK = single(SET, "attachment", "65040", "Whisper in the Dark", 4, {
  traits: "Trap!",
  text: 'Treat attached villain as an [[Elite]] minion with 6 printed hit points. It gains: "Guard. Villainous. <b>When Defeated</b>: Set this minion aside."\n<b>When Revealed</b>: If Shifting Corridors is in play, put the set-aside chosen villain into play engaged with you, side A faceup, with this card attached; otherwise, set this card aside and the villain schemes.',
});

const LORD_DEATHSTRIKE = single(SET, "minion", "65041", "Lord Deathstrike", 5, {
  traits: "Hand.",
  is_unique: true,
  scheme: 2,
  attack: 2,
  health: 5,
  boost_star: true,
  text: `Patrol.\n<b>When Revealed</b>: If Shifting Corridors is in play, shuffle the top 2 cards of the encounter deck into the trap deck; otherwise, reveal the top card of the trap deck.${HR}[star] <b>Boost</b>: Put this minion into play engaged with you.`,
});

const DEAD_END = single(SET, "side_scheme", "65042", "Dead End", 6, {
  base_threat: 2,
  scheme_crisis: 1,
  boost: 3,
  illustrator: "Andrea Di Vito & Laura Villari",
  text: "Assault. <i>(Basic thwarts against this scheme use ATK instead of THW.)</i>\n<b>When Revealed</b>: If Shifting Corridors is in play, remove 1 passage counter from it; otherwise, place 1[per_hero] threat here.",
});

// Hall of Hidden Doors prints the house-and-plus glyph, which Strategic Positioning 65008 (shadows-in-the-night.ts) prints
// as the acceleration icon; Dead End's "!" burst is the crisis icon (RRG v1.8 icon key).
const HALL_OF_HIDDEN_DOORS = single(SET, "side_scheme", "65043", "Hall of Hidden Doors", 7, {
  base_threat: 3,
  base_threat_fixed: true,
  scheme_acceleration: 1,
  boost_star: true,
  illustrator: "Andrea Di Vito & Laura Villari",
  text: `<b>When Defeated</b>: The defeating player removes 5 threat from the main scheme. They discard cards from the encounter deck until a minion or side scheme is discarded, then reveal it.${HR}[star] <b>Boost</b>: Place 3 threat on the main scheme.`,
});

const NO_TIME_TO_THINK = single(SET, "treachery", "65044", "No Time to Think!", 8, {
  quantity: 2,
  boost: 1,
  boost_star: true,
  illustrator: "Kyle Petchock",
  text: `Peril. <i>(While you are resolving this card, other players cannot help you.)</i>\n<b>When Revealed</b>: The villain activates against you.${HR}[star] <b>Boost</b>: If this activation is an attack, this card gains [boost][boost] and this attack gains overkill.`,
});

const SUDDEN_SHIFT = single(SET, "treachery", "65045", "Sudden Shift", 10, {
  quantity: 2,
  boost: 2,
  boost_star: true,
  illustrator: "Andrea Di Vito & Laura Villari",
  text: `<b>When Revealed</b>: Shuffle the trap discard pile and the top 3 cards of the encounter deck into the trap deck. Reveal the top card of the trap deck.${HR}[star] <b>Boost</b>: Shuffle the trap discard pile and the top 2 cards of the encounter deck into the trap deck.`,
});

export const SHADOW_LABYRINTH_RECORDS: readonly AddedRecord[] = [
  added(
    SHIFTING_CORRIDORS,
    'Scan mc65_cards_shifting_corridors.png (footer "SHADOW LABYRINTH (1/11) / HIT POINTS (infinity)", 37 with no face letter, Bruno Frenda & Sara Cuomo). VILLAIN, stage letter A (top right), SCH 0 with a star, ATK 0 with a star, "LOCATION.", not unique (no star before the name). "Stalwart. (star) Forced Interrupt: When Shifting Corridors would activate against you, instead remove 1 passage counter from here and reveal the top card of the trap deck. If the last passage counter is removed from here, the players lose the game." (bold). Hit points are the infinity symbol with no per player icon: `infiniteHp` (a correction). It has no B side: the full-size set has no 65037B image and the footer has no A/B letter.',
  ),
  added(
    LORD_DEATHSTRIKE,
    'Scan mc65_cards_lord_deathstrike.png (footer "SHADOW LABYRINTH (5/11)", 41, no illustrator printed). Unique star, MINION, "HAND.", SCH 2, ATK 2, hit points 5, boost icon is the star only. "Patrol. When Revealed: If Shifting Corridors is in play, shuffle the top 2 cards of the encounter deck into the trap deck; otherwise, reveal the top card of the trap deck. [rule] (star) Boost: Put this minion into play engaged with you."',
  ),
  added(
    DEAD_END,
    'Image 65042.webp (play.marvelsimulator.com; first read from the preview scan mc65_cards_dead_end.png, re-checked at full size with no differences; landscape; footer "SHADOW LABYRINTH (6/11)", 42, Andrea Di Vito & Laura Villari). SIDE SCHEME, no traits, starting threat 2 with the per player icon, one crisis icon (the burst with an exclamation mark), three boost icons. "Assault. (italic reminder: Basic thwarts against this scheme use ATK instead of THW.) When Revealed: If Shifting Corridors is in play, remove 1 passage counter from it; otherwise, place 1 (per player) threat here." Second check (D3, 2026-10-22): agrees.',
  ),
  added(
    NO_TIME_TO_THINK,
    'Scan mc65_cards_no_time_to_think.png (footer "SHADOW LABYRINTH (8/11)", 44, Kyle Petchock). TREACHERY, no traits, boost icons star plus one. "Peril. (italic reminder: While you are resolving this card, other players cannot help you.) When Revealed: The villain activates against you. [rule] (star) Boost: If this activation is an attack, this card gains (boost)(boost) and this attack gains overkill." Two copies: the next card (Sudden Shift, collector 45) is footer 10/11, so 9/11 is a second copy (not seen).',
  ),
  added(
    SUDDEN_SHIFT,
    'Scan mc65_cards_sudden_shift.png (footer "SHADOW LABYRINTH (10/11)", 45, Andrea Di Vito & Laura Villari). TREACHERY, no traits, boost icons star plus two. "When Revealed: Shuffle the trap discard pile and the top 3 cards of the encounter deck into the trap deck. Reveal the top card of the trap deck. [rule] (star) Boost: Shuffle the trap discard pile and the top 2 cards of the encounter deck into the trap deck." Two copies: footer 10/11 and the set total 11 (11/11 is the second copy, not seen).',
  ),
  added(
    INTO_THE_LABYRINTH,
    'Image 65038A.webp and Image 65038B.webp (play.marvelsimulator.com; landscape; footers "SHADOW LABYRINTH (2/11)", 38A and 38B, Andrea Di Vito & Laura Villari). MAIN SCHEME. 1A (stage 1A, top right): "Contents: Shifting Corridors (A). Shadow Labyrinth, Dark Protégé, Deadly Contraptions, and Standard encounter sets. One modular encounter set (Ninja Swarm) [italic]. Setup: Create the trap deck (see rulebook, p. 12) [italic]. Set the Dark Protégé encounter set aside. Choose 1 random villain from that set, then shuffle each card linked to that villain into the encounter deck (keep the chosen villain set aside) [italic]." 1B (stage 1B): top-left circle the infinity symbol (no threshold); lower right box 25 with the per player icon (starting threat); upper box +1 with the per player icon (escalation). "When Revealed: Place 10 (per player) passage counters on Shifting Corridors (7 (per player) instead in expert mode). Forced Interrupt: When Shifting Corridors would take any amount of damage, remove that much threat from here instead. Forced Interrupt: When the last threat is removed from this scheme, advance to stage 2A (italic: the players win by advancing)." The B face was first transcribed from the preview scan mc65_cards_into_the_labyrinth.png and re-read against the full image: no differences (the infinity threshold, formerly marked uncertain, is plain at full size). Second check (D3, 2026-10-22): agrees.',
  ),
  added(
    CHAMBER_OF_VILE_SECRETS,
    'Image 65039A.webp and Image 65039B.webp (play.marvelsimulator.com; landscape; footers "SHADOW LABYRINTH (3/11)", 39A and 39B, Andrea Di Vito & Laura Villari). MAIN SCHEME. 2A (stage 2A): "When Revealed: Do each of the following: 1. Set Shifting Corridors aside. 2. Find the chosen Dark Protégé villain. Discard each status card, token, and attached card from it. 3. Reveal the chosen villain\'s side A (side B instead in expert mode)." 2B (stage 2B): top-left circle 9 with the per player icon (threshold); lower right box 1 with the per player icon (starting threat); upper box +1 with the per player icon (escalation). "When Revealed: In expert mode, the villain activates against each player. Forced Response: After you or an ally you control thwarts this scheme, reveal the top card of the trap deck. (Limit once per round per player.) If this stage is completed, the players lose the game." (bold). The B face was first transcribed from the preview scan mc65_cards_chamber_of_vile_secrets.png and re-read against the full image: no differences. Second check (D3, 2026-10-22): agrees.',
  ),
  added(
    WHISPER_IN_THE_DARK,
    'Image 65040.webp (play.marvelsimulator.com; footer "SHADOW LABYRINTH (4/11)", 40, no illustrator printed). ATTACHMENT (side-title layout), trait line "TRAP!", no boost icons, no stat box. "Treat attached villain as an ELITE minion with 6 printed hit points. It gains: "Guard. Villainous. When Defeated: Set this minion aside." When Revealed: If Shifting Corridors is in play, put the set-aside chosen villain into play engaged with you, side A faceup, with this card attached; otherwise, set this card aside and the villain schemes." Elite is in the small-caps keyword face. Second check (D3, 2026-10-22): agrees.',
  ),
  added(
    HALL_OF_HIDDEN_DOORS,
    'Image 65043.webp (play.marvelsimulator.com; landscape; footer "SHADOW LABYRINTH (7/11)", 43, Andrea Di Vito & Laura Villari). SIDE SCHEME, no traits, starting threat 3 with no per player icon (fixed), one scheme icon in the text box: the house-and-plus glyph (acceleration, per Strategic Positioning 65008), boost icon is the red star only. "When Defeated: The defeating player removes 5 threat from the main scheme. They discard cards from the encounter deck until a minion or side scheme is discarded, then reveal it. [rule] (star) Boost: Place 3 threat on the main scheme." Second check (D3, 2026-10-22): agrees; the glyph matches the acceleration token shape in RRG v1.8 p. 5.',
  ),
];
