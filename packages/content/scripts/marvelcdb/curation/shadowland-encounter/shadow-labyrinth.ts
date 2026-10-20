/**
 * Shadowland (MC65) Shadow Labyrinth, the scenario #2 set (11 printed copies, collector 37 to 45). Transcribed from the
 * Hall of Heroes previews; conventions in `common.ts`.
 *
 * Seen: Shifting Corridors 37 (villain), the main scheme B faces Into the Labyrinth 38B (stage 1B) and Chamber of Vile
 * Secrets 39B (stage 2B; these two are in `SHADOW_LABYRINTH_B_FACES_PENDING_A`, not emitted), Lord Deathstrike 41, Dead End 42 (side scheme), No Time to Think! 44 (two copies, 8/11 and
 * 9/11) and Sudden Shift 45 (two copies, 10/11 and 11/11). Not previewed, so not transcribed: the A faces of the two
 * main schemes (38A, 39A), collector 40 (4/11) and collector 43 (7/11), which with Whisper in the Dark (the TRAP!
 * attachment the insert says is in this set, p. 12) is presumably one of them.
 */
import type { AddedRecord } from "../types.ts";
import { added, HR, SHADOW_LABYRINTH as SET, single } from "./common.ts";

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

// Main scheme B faces: threat threshold (top-left circle), starting threat (lower box) and escalation (upper box).
const INTO_THE_LABYRINTH_B = single(SET, "main_scheme", "65038b", "Into the Labyrinth", 2, {
  stage: "1B",
  threat: null,
  base_threat: 25,
  escalation_threat: 1,
  illustrator: "Andrea Di Vito & Laura Villari",
  text: "<b>When Revealed</b>: Place 10[per_hero] passage counters on Shifting Corridors (7[per_hero] instead in expert mode).\n<b>Forced Interrupt</b>: When Shifting Corridors would take any amount of damage, remove that much threat from here instead.\n<b>Forced Interrupt</b>: When the last threat is removed from this scheme, advance to stage 2A <i>(the players win by advancing)</i>.",
});

const CHAMBER_OF_VILE_SECRETS_B = single(SET, "main_scheme", "65039b", "Chamber of Vile Secrets", 3, {
  stage: "2B",
  threat: 9,
  base_threat: 1,
  escalation_threat: 1,
  illustrator: "Andrea Di Vito & Laura Villari",
  text: "<b>When Revealed</b>: In expert mode, the villain activates against each player.\n<b>Forced Response</b>: After you or an ally you control thwarts this scheme, reveal the top card of the trap deck. (Limit once per round per player.)\n<b>If this stage is completed, the players lose the game.</b>",
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
    'Scan mc65_cards_shifting_corridors.png (footer "SHADOW LABYRINTH (1/11) / HIT POINTS (infinity)", 37 with no face letter, Bruno Frenda & Sara Cuomo). VILLAIN, stage letter A (top right), SCH 0 with a star, ATK 0 with a star, "LOCATION.", not unique (no star before the name). "Stalwart. (star) Forced Interrupt: When Shifting Corridors would activate against you, instead remove 1 passage counter from here and reveal the top card of the trap deck. If the last passage counter is removed from here, the players lose the game." (bold). Hit points are the infinity symbol with no per player icon: `infiniteHp` (a correction). Whether the card is double-sided is not shown by the preview; the footer has no A/B letter.',
  ),
  added(
    LORD_DEATHSTRIKE,
    'Scan mc65_cards_lord_deathstrike.png (footer "SHADOW LABYRINTH (5/11)", 41, no illustrator printed). Unique star, MINION, "HAND.", SCH 2, ATK 2, hit points 5, boost icon is the star only. "Patrol. When Revealed: If Shifting Corridors is in play, shuffle the top 2 cards of the encounter deck into the trap deck; otherwise, reveal the top card of the trap deck. [rule] (star) Boost: Put this minion into play engaged with you."',
  ),
  added(
    DEAD_END,
    'Scan mc65_cards_dead_end.png (landscape; footer "SHADOW LABYRINTH (6/11)", 42, Andrea Di Vito & Laura Villari). SIDE SCHEME, no traits, starting threat 2 with the per player icon, one crisis icon (the burst with an exclamation mark), three boost icons. "Assault. (italic reminder: Basic thwarts against this scheme use ATK instead of THW.) When Revealed: If Shifting Corridors is in play, remove 1 passage counter from it; otherwise, place 1 (per player) threat here."',
  ),
  added(
    NO_TIME_TO_THINK,
    'Scan mc65_cards_no_time_to_think.png (footer "SHADOW LABYRINTH (8/11)", 44, Kyle Petchock). TREACHERY, no traits, boost icons star plus one. "Peril. (italic reminder: While you are resolving this card, other players cannot help you.) When Revealed: The villain activates against you. [rule] (star) Boost: If this activation is an attack, this card gains (boost)(boost) and this attack gains overkill." Two copies: the next card (Sudden Shift, collector 45) is footer 10/11, so 9/11 is a second copy (not seen).',
  ),
  added(
    SUDDEN_SHIFT,
    'Scan mc65_cards_sudden_shift.png (footer "SHADOW LABYRINTH (10/11)", 45, Andrea Di Vito & Laura Villari). TREACHERY, no traits, boost icons star plus two. "When Revealed: Shuffle the trap discard pile and the top 3 cards of the encounter deck into the trap deck. Reveal the top card of the trap deck. [rule] (star) Boost: Shuffle the trap discard pile and the top 2 cards of the encounter deck into the trap deck." Two copies: footer 10/11 and the set total 11 (11/11 is the second copy, not seen).',
  ),
];

/**
 * Faces transcribed from a scan whose other side has no scan yet. The normalizer needs a main scheme's A and B faces
 * together (stage "1A"/"1B" pair), and the A faces (38A, 39A: Contents and Setup text, scenario #2) are not previewed,
 * so these two are kept here and are NOT in `SHADOW_LABYRINTH_RECORDS`: join them (A face nested as `linked_card`) when
 * the 38A and 39A scans exist. The data below is transcribed and checked like the others.
 */
export const SHADOW_LABYRINTH_B_FACES_PENDING_A: readonly AddedRecord[] = [
  added(
    INTO_THE_LABYRINTH_B,
    'Scan mc65_cards_into_the_labyrinth.png (landscape; footer "SHADOW LABYRINTH (2/11)", 38B, Andrea Di Vito & Laura Villari). MAIN SCHEME stage 1B (top right). Top-left circle: the infinity symbol (threshold). Lower right box: 25 with the per player icon (starting threat); upper box +1 with the per player icon (escalation). "When Revealed: Place 10 (per player) passage counters on Shifting Corridors (7 (per player) instead in expert mode). Forced Interrupt: When Shifting Corridors would take any amount of damage, remove that much threat from here instead. Forced Interrupt: When the last threat is removed from this scheme, advance to stage 2A (italic: the players win by advancing)." UNCERTAIN: the threshold glyph was zoomed 6x and is the infinity sign (two loops), so the stage has no threat threshold; the 1A face (38A) is not previewed.',
  ),
  added(
    CHAMBER_OF_VILE_SECRETS_B,
    'Scan mc65_cards_chamber_of_vile_secrets.png (landscape; footer "SHADOW LABYRINTH (3/11)", 39B, Andrea Di Vito & Laura Villari). MAIN SCHEME stage 2B. Top-left circle 9 with the per player icon (threshold); lower right box 1 with the per player icon (starting threat); upper box +1 with the per player icon (escalation). "When Revealed: In expert mode, the villain activates against each player. Forced Response: After you or an ally you control thwarts this scheme, reveal the top card of the trap deck. (Limit once per round per player.) If this stage is completed, the players lose the game." (bold). The 2A face (39A) is not previewed.',
  ),
];
