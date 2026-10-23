/**
 * Shadowland (MC65) Deadly Contraptions, a modular set (11 printed copies, collector 46 to 56, one copy each; seven
 * TRAP! treacheries per the insert p. 12). Transcribed from the full-size scans; conventions in `common.ts`.
 *
 * All eleven are transcribed: Nervous Jitters 46, Iron Monk 47, Hall of Punishment 48, Path of a Thousand Cuts 49 and
 * the seven TRAP! treacheries Blinding Powder 50, Caltrops 51, Flame Spout 52, Oil Slick 53, Poison Darts 54, Pressure
 * Plate 55 and Tripwire 56.
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

const FLAME_SPOUT = single(SET, "treachery", "65052", "Flame Spout", 7, {
  traits: "Trap!",
  boost: 3,
  illustrator: "Facundo Moyano",
  text: "<b>When Revealed</b>: Choose:\n• <i>Avoid</i> — Discard an ally from your hand.\n• <i>Disarm</i> — Discard an ally you control, then draw 2 cards.\n• <i>Trip</i> — Deal 3 damage to your identity. Discard the top 3 cards of your deck.",
});

const OIL_SLICK = single(SET, "treachery", "65053", "Oil Slick", 8, {
  traits: "Trap!",
  boost: 1,
  illustrator: "Andrea Di Vito & Laura Villari",
  text: "<b>When Revealed</b>: Choose:\n• <i>Avoid</i> — Discard an upgrade from your hand.\n• <i>Disarm</i> — Discard an upgrade you control, then remove 4 threat from the main scheme.\n• <i>Trip</i> — Discard 1 card from your hand. Discard the top 8 cards of your deck.",
});

const POISON_DARTS = single(SET, "treachery", "65054", "Poison Darts", 9, {
  traits: "Trap!",
  boost: 2,
  illustrator: "Eduardo Mello",
  text: "<b>When Revealed</b>: Choose:\n• <i>Avoid</i> — Spend [energy][energy] resources.\n• <i>Disarm</i> — Spend [mental][mental][physical] resources, then deal 3 damage to the villain.\n• <i>Trip</i> — Deal 3 damage to your identity and exhaust it.",
});

const PRESSURE_PLATE = single(SET, "treachery", "65055", "Pressure Plate", 10, {
  traits: "Trap!",
  illustrator: "Eduardo Mello",
  text: "<b>When Revealed</b>: Choose:\n• <i>Avoid</i> — Spend [mental][mental] resources.\n• <i>Disarm</i> — Spend [energy][physical][physical] resources, then search the top 4 cards of your deck for a card and add it to your hand. <i>(Shuffle.)</i>\n• <i>Trip</i> — Discard cards from the top of the encounter deck until a minion is discarded, then reveal it.",
});

const TRIPWIRE = single(SET, "treachery", "65056", "Tripwire", 11, {
  traits: "Trap!",
  boost: 2,
  illustrator: "Andrea Di Vito & Laura Villari",
  text: "<b>When Revealed</b>: Choose:\n• <i>Avoid</i> — Discard an [[Attack]] event from your hand.\n• <i>Disarm</i> — Discard a support you control, then remove 3 threat from a scheme.\n• <i>Trip</i> — Discard cards from the top of the encounter deck until a side scheme is discarded, then reveal it.",
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
    'Image 65049.webp (first read from the preview scan mc65_cards_path_of_a_thousand_cuts.png, re-checked at full size with no differences; landscape; footer "DEADLY CONTRAPTIONS (4/11)", 49, Kyle Petchock). SIDE SCHEME, no traits, starting threat 5 with no per player icon (fixed), no scheme icons, boost icon is the star only. Flavor: "Every step is a test of resilience." "Forced Interrupt: When you choose the "Avoid" effect or the "Trip" effect on a TRAP! card, take 2 indirect damage. [rule] (star) Boost: Deal 1 damage to each character you control." Second check (D3, 2026-10-22): agrees.',
  ),
  added(
    BLINDING_POWDER,
    'Scan mc65_cards_blinding_powder.png (footer "DEADLY CONTRAPTIONS (5/11)", 50, Kyle Petchock). TREACHERY, "TRAP!", no boost icons. "When Revealed: Choose: * Avoid — Discard a THWART event from your hand. * Disarm — Discard 2 cards at random from your hand, then give a character you control a tough status card. * Trip — Deal 2 damage to your identity and confuse it." Avoid, Disarm and Trip are italic.',
  ),
  added(
    CALTROPS,
    'Scan mc65_cards_caltrops.png (footer "DEADLY CONTRAPTIONS (6/11)", 51, Aitor Prieto). TREACHERY, "TRAP!", one boost icon. "When Revealed: Choose: * Avoid — Discard a DEFENSE event from your hand. * Disarm — Discard 1 identity-specific card from your hand, then deal 2 damage to an enemy. * Trip — Deal 2 damage to your identity and stun it." Avoid, Disarm and Trip are italic.',
  ),
  added(
    FLAME_SPOUT,
    'Image 65052.webp (footer "DEADLY CONTRAPTIONS (7/11)", 52, Facundo Moyano). TREACHERY, "TRAP!", three boost icons. "When Revealed: Choose: * Avoid — Discard an ally from your hand. * Disarm — Discard an ally you control, then draw 2 cards. * Trip — Deal 3 damage to your identity. Discard the top 3 cards of your deck." Avoid, Disarm and Trip are italic. Second check (D3, 2026-10-22): agrees.',
  ),
  added(
    OIL_SLICK,
    'Image 65053.webp (footer "DEADLY CONTRAPTIONS (8/11)", 53, Andrea Di Vito & Laura Villari). TREACHERY, "TRAP!", one boost icon. "When Revealed: Choose: * Avoid — Discard an upgrade from your hand. * Disarm — Discard an upgrade you control, then remove 4 threat from the main scheme. * Trip — Discard 1 card from your hand. Discard the top 8 cards of your deck." Avoid, Disarm and Trip are italic. Second check (D3, 2026-10-22): agrees.',
  ),
  added(
    POISON_DARTS,
    'Image 65054.webp (footer "DEADLY CONTRAPTIONS (9/11)", 54, Eduardo Mello). TREACHERY, "TRAP!", two boost icons. "When Revealed: Choose: * Avoid — Spend (lightning)(lightning) resources. * Disarm — Spend (node-and-link)(node-and-link)(fist) resources, then deal 3 damage to the villain. * Trip — Deal 3 damage to your identity and exhaust it." Avoid, Disarm and Trip are italic. Second check (D3, 2026-10-22): agrees.',
  ),
  added(
    PRESSURE_PLATE,
    'Image 65055.webp (footer "DEADLY CONTRAPTIONS (10/11)", 55, Eduardo Mello). TREACHERY, "TRAP!", no boost icons. "When Revealed: Choose: * Avoid — Spend (node-and-link)(node-and-link) resources. * Disarm — Spend (lightning)(fist)(fist) resources, then search the top 4 cards of your deck for a card and add it to your hand. (Shuffle.) [italic] * Trip — Discard cards from the top of the encounter deck until a minion is discarded, then reveal it." Avoid, Disarm and Trip are italic. Second check (D3, 2026-10-22): agrees.',
  ),
  added(
    TRIPWIRE,
    'Image 65056.webp (footer "DEADLY CONTRAPTIONS (11/11)", 56, Andrea Di Vito & Laura Villari). TREACHERY, "TRAP!", two boost icons. "When Revealed: Choose: * Avoid — Discard an ATTACK event from your hand. * Disarm — Discard a support you control, then remove 3 threat from a scheme. * Trip — Discard cards from the top of the encounter deck until a side scheme is discarded, then reveal it." Avoid, Disarm and Trip are italic. Second check (D3, 2026-10-22): agrees.',
  ),
];
