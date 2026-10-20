/**
 * Shadowland (MC65) Deadly Contraptions, a modular set (11 printed copies, collector 46 to 56, one copy each; seven
 * TRAP! treacheries per the insert p. 12). Transcribed from the Hall of Heroes previews; conventions in `common.ts`.
 *
 * Seen (6 of 11): Nervous Jitters 46, Iron Monk 47, Hall of Punishment 48, Path of a Thousand Cuts 49, Blinding Powder
 * 50 and Caltrops 51. Not previewed, so not transcribed: collector 52 to 56 (positions 7 to 11; with Blinding Powder
 * and Caltrops they should be the set's seven TRAP! treacheries, so five more cards).
 */
import type { AddedRecord } from "../types.ts";
import { added, DEADLY_CONTRAPTIONS as SET, HR, single } from "./common.ts";

const NERVOUS_JITTERS = single(SET, "attachment", "65046", "Nervous Jitters", 1, {
  traits: "Condition.",
  boost: 1,
  illustrator: "Eduardo Mello",
  text: 'Attach to your identity.\n<b>Forced Interrupt</b>: When you choose the "<i>Avoid</i>" effect or the "<i>Disarm</i>" effect on a [[Trap!]] card, name an encounter card type, then discard the top card of the encounter deck. If the card discarded this way was not of the named type, take 4 indirect damage and discard this attachment.',
});

const IRON_MONK = single(SET, "minion", "65047", "Iron Monk", 2, {
  traits: "Hand. Mystic.",
  is_unique: true,
  scheme: 2,
  attack: 1,
  health: 4,
  boost: 2,
  illustrator: "Facundo Moyano",
  flavor: '"Your only path is through me. Let us begin."',
  text: 'Patrol. Toughness.\nWhile Iron Monk is engaged with you, you cannot choose the "<i>Avoid</i>" effect on [[Trap!]] cards.',
});

const HALL_OF_PUNISHMENT = single(SET, "side_scheme", "65048", "Hall of Punishment", 3, {
  base_threat: 2,
  scheme_crisis: 1,
  boost_star: true,
  illustrator: "Facundo Moyano",
  text: `<b>Forced Interrupt</b>: When you choose the "<i>Trip</i>" effect on a [[Trap!]] card, discard the top 3 cards of your deck.${HR}[star] <b>Boost</b>: Place 1 threat on the main scheme for each character you control.`,
});

const PATH_OF_A_THOUSAND_CUTS = single(SET, "side_scheme", "65049", "Path of a Thousand Cuts", 4, {
  base_threat: 5,
  base_threat_fixed: true,
  boost_star: true,
  illustrator: "Kyle Petchock",
  flavor: "Every step is a test of resilience.",
  text: `<b>Forced Interrupt</b>: When you choose the "<i>Avoid</i>" effect or the "<i>Trip</i>" effect on a [[Trap!]] card, take 2 indirect damage.${HR}[star] <b>Boost</b>: Deal 1 damage to each character you control.`,
});

const BLINDING_POWDER = single(SET, "treachery", "65050", "Blinding Powder", 5, {
  traits: "Trap!",
  illustrator: "Kyle Petchock",
  text: "<b>When Revealed</b>: Choose:\n• <i>Avoid</i> — Discard a [[Thwart]] event from your hand.\n• <i>Disarm</i> — Discard 2 cards at random from your hand, then give a character you control a tough status card.\n• <i>Trip</i> — Deal 2 damage to your identity and confuse it.",
});

const CALTROPS = single(SET, "treachery", "65051", "Caltrops", 6, {
  traits: "Trap!",
  boost: 1,
  illustrator: "Aitor Prieto",
  text: "<b>When Revealed</b>: Choose:\n• <i>Avoid</i> — Discard a [[Defense]] event from your hand.\n• <i>Disarm</i> — Discard 1 identity-specific card from your hand, then deal 2 damage to an enemy.\n• <i>Trip</i> — Deal 2 damage to your identity and stun it.",
});

export const DEADLY_CONTRAPTIONS_RECORDS: readonly AddedRecord[] = [
  added(
    NERVOUS_JITTERS,
    'Scan mc65_cards_nervous_jitters.png (footer "DEADLY CONTRAPTIONS (1/11)", 46, Eduardo Mello). ATTACHMENT (side-title layout), "CONDITION.", no stat box, one boost icon. "Attach to your identity. Forced Interrupt: When you choose the "Avoid" effect or the "Disarm" effect on a TRAP! card, name an encounter card type, then discard the top card of the encounter deck. If the card discarded this way was not of the named type, take 4 indirect damage and discard this attachment." Avoid and Disarm are italic.',
  ),
  added(
    IRON_MONK,
    'Scan mc65_cards_iron_monk_.png (footer "DEADLY CONTRAPTIONS (2/11)", 47, Facundo Moyano). Unique star, MINION, "HAND. MYSTIC.", SCH 2, ATK 1, hit points 4, two boost icons. "Patrol. Toughness. While Iron Monk is engaged with you, you cannot choose the "Avoid" effect on TRAP! cards." Flavor: "Your only path is through me. Let us begin."',
  ),
  added(
    HALL_OF_PUNISHMENT,
    'Scan mc65_cards_hall_of_punishment.png (landscape; footer "DEADLY CONTRAPTIONS (3/11)", 48, Facundo Moyano). SIDE SCHEME, no traits, starting threat 2 with the per player icon, one crisis icon, boost icon is the star only. "Forced Interrupt: When you choose the "Trip" effect on a TRAP! card, discard the top 3 cards of your deck. [rule] (star) Boost: Place 1 threat on the main scheme for each character you control."',
  ),
  added(
    PATH_OF_A_THOUSAND_CUTS,
    'Scan mc65_cards_path_of_a_thousand_cuts.png (landscape; footer "DEADLY CONTRAPTIONS (4/11)", 49, Kyle Petchock). SIDE SCHEME, no traits, starting threat 5 with no per player icon (fixed), no scheme icons, boost icon is the star only. Flavor: "Every step is a test of resilience." "Forced Interrupt: When you choose the "Avoid" effect or the "Trip" effect on a TRAP! card, take 2 indirect damage. [rule] (star) Boost: Deal 1 damage to each character you control."',
  ),
  added(
    BLINDING_POWDER,
    'Scan mc65_cards_blinding_powder.png (footer "DEADLY CONTRAPTIONS (5/11)", 50, Kyle Petchock). TREACHERY, "TRAP!", no boost icons. "When Revealed: Choose: * Avoid — Discard a THWART event from your hand. * Disarm — Discard 2 cards at random from your hand, then give a character you control a tough status card. * Trip — Deal 2 damage to your identity and confuse it." Avoid, Disarm and Trip are italic.',
  ),
  added(
    CALTROPS,
    'Scan mc65_cards_caltrops.png (footer "DEADLY CONTRAPTIONS (6/11)", 51, Aitor Prieto). TREACHERY, "TRAP!", one boost icon. "When Revealed: Choose: * Avoid — Discard a DEFENSE event from your hand. * Disarm — Discard 1 identity-specific card from your hand, then deal 2 damage to an enemy. * Trip — Deal 2 damage to your identity and stun it." Avoid, Disarm and Trip are italic.',
  ),
];
