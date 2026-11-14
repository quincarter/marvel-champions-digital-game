/**
 * Elektra Hero Pack (MC63, cycle 11, Fear No Evil wave) curation: a scan-only pack (MarvelCDB has no Elektra pack, so
 * every record is an added record, as Shadowland's). Transcribed from the Hall of Heroes page
 * (https://hallofheroeslcg.com/elektra-natchios/) and the FFG preview article "Killer Instinct"
 * (https://www.fantasyflightgames.com/en/news/2026/8/13/killer-instinct/), 300 x 419 card images, read 2026-11-14.
 *
 * What exists: the two identity faces, the 3 NINJA deck cards, all 10 distinct kit cards, 6 aggression, 2 basic, 1 justice
 * (Double-Cross and its 3 Linked treacheries), 1 leadership and 1 protection card, from the 300 px previews and the
 * full-size spoiler images (collector 10, 11, 14, 21, 22, 34 to 39), plus two cards read from a gameplay video (the
 * obligation and Aka) and three nemesis cards from an unofficial fan preview (63042, 63044, 63045).
 * Unseen collector numbers: 24, 25, 26 and anything after 39 that is not provisional; nemesis card 3 of 5 (63043).
 *
 * Evidence abbreviations: "HoH" is the Hall of Heroes page above, "FFG" the article above, "video" the gameplay video
 * https://youtu.be/6wR6kfxPmio (Web-Warrior Fanatic, 2026-11-13).
 *
 * - The NINJA deck (Ninja Stars 63002, Ninja Strike 63003, Ninja Vanish 63004) is a hero-owned deck of encounter-shaped
 *   treacheries, modelled as Hercules's Labor deck is (a `separateDecks` entry with `cardFamily: "encounter"`, no
 *   encounter set, `separateDeck: "Ninja"`); its feeders (Ninja Training, Killer Blow, Move Unseen, Sai Strike) are in
 *   their texts.
 * - PLACEHOLDER codes: 63040 (obligation) and 63041 (nemesis minion) are provisional collector numbers; see the
 *   corrections.
 */
import type { PackCuration } from "./types.ts";
import { HR, packBuilders } from "./hero-pack-scans.ts";

const P = packBuilders({ num: "63", packCode: "elektra", packName: "Elektra", productCode: "Elektra (MC63)" });

const HOH = "https://hallofheroeslcg.com/elektra-natchios/";
const FFG = "https://www.fantasyflightgames.com/en/news/2026/8/13/killer-instinct/";
const VIDEO = "https://youtu.be/6wR6kfxPmio";
const SHOTS =
  "full-size Hall of Heroes spoiler image shots-elektra-natchios/marvel-champions_-the-card-game-shadowland-gameplay-";
const full = (stamp: string) => `HoH ${HOH}, ${SHOTS}${stamp}-screenshot.png (about 1400 x 2000, read 2026-11-14).`;
const src = (hohImage: string, ffgImage: string) =>
  `HoH ${HOH} image ${hohImage}, FFG ${FFG} image ${ffgImage} (300 x 419 previews, read 2026-11-14).`;

const NINJA_DECK = {
  faction_code: "hero",
  faction_name: "Hero",
  card_set_code: "elektra_ninja_deck",
  card_set_name: "Ninja Deck",
  card_set_type_name_code: "hero_special",
  card_set_parent_code: "elektra",
  quantity: 2,
  deck_limit: undefined,
  traits: "Ninja.",
  boost_star: true,
} as const;

const IDENTITY = P.added(
  P.identity(
    {
      name: "Elektra",
      hand_size: 5,
      health: 9,
      thwart: 0,
      thwart_star: true,
      attack: 1,
      attack_star: true,
      defense: 1,
      defense_star: true,
      traits: "Defender. Martial Artist.",
      illustrator: "Bruno Frenda",
      text: `[star] Villainous. <i>(When this character uses a basic power, give it a boost card.)</i>\n<i>Killer Instinct</i> — <b>Interrupt</b>: When a boost card given to Elektra is turned faceup, cancel its "<b>Boost</b>" ability. Then, that card gains [boost].`,
    },
    {
      name: "Elektra Natchios",
      hand_size: 6,
      health: 9,
      recover: 3,
      traits: "Assassin.",
      illustrator: "Bruno Frenda",
      text: `Elektra Natchios begins the game with a [[Ninja]] deck. <i>(See insert.)</i>\n<i>Ninja Training</i> — <b>Interrupt</b>: When you change to hero form, shuffle the top card of the [[Ninja]] deck into the encounter deck.`,
    },
  ),
  `${src("e2-1.png (hero 1A) and e1-1.png (alter-ego 1B)", "mc63_elektra_hero.webp and mc63_elektra-natchios_alter-ego.png")} Each printed hero stat carries a star tied to Villainous (0*/1*/1*).`,
);

const NINJA = [
  P.added(
    P.kit("treachery", "63002", "Ninja Stars", 2, {
      ...NINJA_DECK,
      illustrator: "Facundo Moyano",
      text: `Surge.\n<b>When Revealed</b>: Give this card to Elektra as a facedown boost card.${HR}[star] <b>Boost</b>: If Elektra is using a basic power, draw 2 cards and shuffle this card into the [[Ninja]] deck. Otherwise, give this card to Elektra as a facedown boost card.`,
    }),
    src("e3-1.png", "mc63_ninja-stars.png"),
  ),
  P.added(
    P.kit("treachery", "63003", "Ninja Strike", 3, {
      ...NINJA_DECK,
      text: `Surge.\n<b>When Revealed</b>: Give this card to Elektra as a facedown boost card.${HR}[star] <b>Boost</b>: If Elektra is using a basic power, she gets +3 to that power for this use and you shuffle this card into the [[Ninja]] deck. Otherwise, give this card to Elektra as a facedown boost card.`,
    }),
    src("e4.png", "mc63_ninja-strike.png"),
  ),
  P.added(
    P.kit("treachery", "63004", "Ninja Vanish", 5, {
      ...NINJA_DECK,
      illustrator: "Allie Prewick",
      text: `Surge.\n<b>When Revealed</b>: Give this card to Elektra as a facedown boost card.${HR}[star] <b>Boost</b>: If Elektra is using a basic power, give her a tough status card and shuffle this card into the [[Ninja]] deck. Otherwise, give this card to Elektra as a facedown boost card.`,
    }),
    src("e5.png", "mc63_ninja-vanish.png"),
  ),
];

const KIT = [
  P.added(
    P.kit("support", "63010", "Resurrection Altar", 10, {
      is_unique: true,
      cost: 1,
      resource_mental: 1,
      traits: "Hand. Location.",
      flavor: `"Arise once again as a mighty servant of the Hand!" —Hand Sorcerer`,
      illustrator: "Bruno Frenda",
      text: "<b>Interrupt</b>: When you would be defeated, remove this card from the game → set your hit point dial to 9 instead. Find your obligation and reveal it.",
    }),
    full("14-44"),
  ),
  P.added(
    P.kit("support", "63011", "White Tiger", 11, {
      is_unique: true,
      cost: 1,
      resource_mental: 1,
      traits: "Persona.",
      text: "<b>Response</b>: After you change to hero form, shuffle the top card of the [[Ninja]] deck into the encounter deck. Otherwise, give Elektra 1 facedown boost card.",
    }),
    `${full("15-12")} The Otherwise clause follows an unconditional sentence as printed; transcribed verbatim.`,
  ),
  P.added(
    P.kit("upgrade", "63014", "Stealth Mastery", 15, {
      cost: 1,
      resource_energy: 1,
      traits: "Skill.",
      flavor: `"I'll teach them to fear every shadow." —Elektra`,
      text: "<b>Forced Interrupt</b>: When you attack or are attacked, choose to either increase or reduce the damage that attack deals by 3. Put Stealth Mastery on top of your deck.",
    }),
    full("15-22"),
  ),
  P.added(
    P.kit("ally", "63005", "Daredevil", 1, {
      subname: "Matt Murdock",
      is_unique: true,
      cost: 3,
      resource_wild: 1,
      thwart: 2,
      thwart_star: true,
      thwart_cost: 1,
      attack: 2,
      attack_star: true,
      attack_cost: 1,
      health: 3,
      traits: "Defender. Martial Artist.",
      flavor: `"We're two of a kind. Drawn to the edge—and past it!" —Elektra`,
      illustrator: "Bruno Frenda",
      text: "[star] <b>Response</b>: After Daredevil uses a basic power, place a card from the encounter discard pile on top of the encounter deck.",
    }),
    `${src("e10.png", "mc63_daredevil.png")} THW and ATK carry a star but no Villainous keyword is printed; the star leads the Response.`,
  ),
  P.added(
    P.kit("event", "63006", "Acrobatic Prowess", 2, {
      quantity: 2,
      cost: 1,
      resource_energy: 1,
      traits: "Acrobatic. Skill.",
      flavor: `"They may be fast, but I am faster." —Elektra`,
      text: "<b>Hero Action</b>: Ready Elektra and give her 1 facedown boost card.",
    }),
    src("e11.png", "mc63_acrobatic-prowess.png"),
  ),
  P.added(
    P.kit("event", "63007", "Killer Blow", 4, {
      quantity: 2,
      cost: 2,
      resource_energy: 1,
      traits: "Attack.",
      flavor: `"I am Elektra Natchios. Not even the stars are safe in the sky." —Elektra`,
      text: "<b>Hero Action</b> <i>(attack)</i>: Deal up to 5 damage to an enemy. If this attack defeats that enemy, shuffle the top card of the [[Ninja]] deck into the encounter deck.",
    }),
    `${src("e8.png", "mc63_killer-blows.png")} The card prints the singular title "Killer Blow" (the FFG file name says killer-blows).`,
  ),
  P.added(
    P.kit("event", "63008", "Move Unseen", 6, {
      quantity: 2,
      cost: 2,
      resource_mental: 1,
      traits: "Acrobatic. Thwart.",
      flavor: `"Nobody ever looks up." —Elektra`,
      text: "<b>Hero Action</b> <i>(thwart)</i>: Remove up to 4 threat from a scheme. Shuffle the top card of the [[Ninja]] deck into the encounter deck.",
    }),
    src("e9.png", "mc63_move-unseen.png"),
  ),
  P.added(
    P.kit("event", "63009", "Sai Strike", 8, {
      quantity: 2,
      cost: 1,
      resource_physical: 1,
      traits: "Attack.",
      flavor: `"To look upon me is to see the end of life." —Elektra`,
      illustrator: "Allie Prewick",
      text: "<b>Hero Action</b> <i>(attack)</i>: Deal 3 damage to an enemy. For each Elektra's Sai you control, shuffle the top card of the [[Ninja]] deck into the encounter deck.",
    }),
    src("e6.png", "mc63_sai-strike.png"),
  ),
  P.added(
    P.kit("upgrade", "63012", "Elektra's Sai", 12, {
      quantity: 2,
      cost: 2,
      resource_physical: 1,
      traits: "Weapon.",
      text: "Restricted.\n<b>Hero Action</b>: Exhaust Elektra's Sai → deal 1 damage to an enemy and reduce the cost of the next [[Acrobatic]] or [[Attack]] event you play this phase by 1.",
    }),
    `${src("e7.png", "mc63_elektras-sai.png")} FFG: "she has two in her deck".`,
  ),
  P.added(
    P.kit("upgrade", "63013", "History with the Hand", 14, {
      cost: 0,
      resource_mental: 1,
      scheme_amplify: 1,
      traits: "Condition.",
      text: "Prerequisite <i>(hero form)</i>.\nYou get +1 hand size.\n<b>Forced Response</b>: After you change form, discard this card.",
    }),
    `${src("e13.png", "mc63_history-with-the-hand.png")} The icon centred under the text box (a plus joined to the boost icon) is the amplify icon, named so by the FFG article; it is scheme_amplify 1 (amplifyIcons), not text, as fne 60031.`,
  ),
];

const ASPECT = [
  P.added(
    P.aspect("upgrade", "aggression", "63021", "Shuriken", {
      cost: 2,
      cost_star: true,
      resource_energy: 1,
      traits: "Weapon.",
      flavor: `"A true ninja is never without a weapon." —Elektra`,
      text: "[star] Discount 1 ([[Martial Artist]]).\nUses (3 shuriken counters).\n<b>Hero Action</b>: Remove 1 shuriken counter from here → deal 1 damage to an enemy.",
    }),
    `${full("15-59")} Cost 2 with a star beside it (the Discount line).`,
  ),
  P.added(
    P.aspect("ally", "basic", "63022", "Stone", {
      is_unique: true,
      deck_limit: 1,
      cost: 3,
      resource_physical: 1,
      thwart: 1,
      thwart_cost: 1,
      attack: 2,
      attack_cost: 2,
      health: 3,
      traits: "Martial Artist.",
      flavor: `"Connection, mind, body."`,
      illustrator: "Afif Khaled",
      text: "<b>Response</b>: After Stone exactly defeats an enemy or side scheme, heal 2 damage from Stone.",
    }),
    `${full("16-32")} No subtitle is printed. The artist reads "Afif Khaled" (the fi may be a ligature).`,
  ),
  P.added(
    P.aspect("player_side_scheme", "justice", "63034", "Double-Cross", {
      is_unique: true,
      deck_limit: 1,
      cost: 0,
      resource_mental: 1,
      base_threat: 2,
      illustrator: "Allie Preswick",
      text: "Victory 0.\n<b>When Defeated</b>: If there is not already a copy of Double-Cross in the victory display, shuffle the set-aside Backstab, Misdirect, and Sabotage treachery cards into the top 10 cards of the encounter deck <i>(or the whole deck if there are fewer than 10 cards)</i>.",
    }),
    `${full("17-27")} Horizontal card. The top-right box prints a zero (cost 0) and the bottom-left box a 2 with the per player icon (threat); no traits line.`,
  ),
  P.added(
    P.linked("63035", "Backstab", {
      illustrator: "Andrea Di Vito & Laura Villari",
      boost_star: true,
      text: `Linked (Double-Cross).\n<b>When Revealed</b>: Deal 4 damage to the villain. This card gains surge.${HR}[star] <b>Boost</b>: If an enemy is activating, deal 2 damage to it. Otherwise, this card gains [boost][boost].`,
    }),
    `${full("18-10")} Boost area: the star only.`,
  ),
  P.added(
    P.linked("63036", "Misdirect", {
      illustrator: "Andrea Di Vito & Laura Villari",
      boost_star: true,
      flavor: `"I slipped away just in time. The new recruit is taking the heat...for now." —Sharon Carter`,
      text: `Linked (Double-Cross).\n<b>When Revealed</b>: Heal 4 damage from an identity. This card gains surge.${HR}[star] <b>Boost</b>: Stun an enemy.`,
    }),
    `${full("18-32")} Boost area: the star only.`,
  ),
  P.added(
    P.linked("63037", "Sabotage", {
      illustrator: "Allie Preswick",
      boost_star: true,
      flavor: `"Destroying the control panel now." —Sharon Carter`,
      text: `Linked (Double-Cross).\n<b>When Revealed</b>: Remove 3 threat from the main scheme. This card gains surge.${HR}[star] <b>Boost</b>: Confuse an enemy.`,
    }),
    `${full("18-59")} Boost area: the star only.`,
  ),
  P.added(
    P.aspect("ally", "leadership", "63038", "Moondragon", {
      subname: "Heather Douglas",
      is_unique: true,
      deck_limit: 1,
      cost: 4,
      resource_physical: 1,
      thwart: 1,
      thwart_star: true,
      thwart_cost: 1,
      attack: 1,
      attack_star: true,
      attack_cost: 1,
      health: 5,
      traits: "Defender. Martial Artist.",
      text: "[star] <b>Interrupt</b>: When Moondragon uses a basic power, choose a number from 1 to 3. Moondragon gets +X to that power and takes +X consequential damage ([cost]) for this use, where X is equal to the chosen number.",
    }),
    `${full("19-15")} The stat stars tie to the starred Interrupt, not to Villainous.`,
  ),
  P.added(
    P.aspect("ally", "protection", "63039", "Moon Knight", {
      subname: "Marc Spector",
      is_unique: true,
      deck_limit: 1,
      cost: 4,
      resource_energy: 1,
      thwart: 2,
      thwart_cost: 2,
      attack: 2,
      attack_cost: 2,
      health: 5,
      traits: "Defender. Martial Artist.",
      text: "<b>Interrupt</b>: When Moon Knight defends, spend up to 3 resources → if you spent at least 1:\n[energy] – Prevent 2 damage from this attack.\n[mental] – Discard 1 boost card from the attacker.\n[physical] – Deal 2 damage to the attacker.",
    }),
    `${full("20-13")} Only THW and ATK are printed; the three resource symbols in the text are icons.`,
  ),
  P.added(
    P.aspect("ally", "aggression", "63015", "Shang-Chi", {
      subname: "Zheng Shang-Chi",
      is_unique: true,
      deck_limit: 1,
      cost: 4,
      resource_physical: 1,
      thwart: 2,
      thwart_cost: 1,
      attack: 2,
      attack_cost: 1,
      health: 3,
      traits: "Hero for Hire. Martial Artist.",
      text: "Shang-Chi enters play with 10 ring counters on him.\n<b>Action</b>: Remove 1 ring counter from here → deal 1 damage to an enemy. <i>(Limit twice per round.)</i>",
    }),
    src("e15.png", "mc63_shang-chi.png"),
  ),
  P.added(
    P.aspect("ally", "aggression", "63016", "Black Cat", {
      subname: "Felicia Hardy",
      is_unique: true,
      deck_limit: 1,
      cost: 3,
      resource_mental: 1,
      thwart: 1,
      thwart_star: true,
      thwart_cost: 1,
      attack: 1,
      attack_star: true,
      attack_cost: 1,
      health: 3,
      traits: "Hero for Hire. Martial Artist.",
      flavor: `"Personally, darling, I'll take larceny over virtue every time!"`,
      text: "[star] Villainous. <i>(When this character uses a basic power, give it a boost card.)</i>",
    }),
    `${src("e14.png", "mc63_black-cat.png")} FFG: she cannot cancel Boost abilities as Elektra can.`,
  ),
  P.added(
    P.aspect("event", "aggression", "63017", "Combo Move", {
      cost: 1,
      resource_energy: 1,
      traits: "Attack.",
      flavor: `"You boys are good practice for when I face a real challenge." —Elektra`,
      text: "<b>Hero Action</b> <i>(attack)</i>: Deal 2 damage among enemies in play (3 damage instead if your identity has the [[Martial Artist]] trait).",
    }),
    src("e18.png", "mc63_combo-move.png"),
  ),
  P.added(
    P.aspect("event", "aggression", "63018", "Chain Reaction", {
      cost: 2,
      resource_physical: 1,
      traits: "Attack.",
      flavor: `"I set 'em up, you knock 'em down." —Elektra`,
      illustrator: "Eleonora Carlini",
      text: "<b>Hero Action</b> <i>(attack)</i>: Deal 2 damage to an enemy. If that enemy is defeated, deal 2 damage to a second enemy. If that enemy is defeated, deal 3 damage to a third enemy.",
    }),
    src("e16.png", "mc63_chain-reaction.png"),
  ),
  P.added(
    P.aspect("event", "aggression", "63019", "Nerve Strike", {
      cost: 3,
      cost_star: true,
      resource_energy: 1,
      traits: "Attack. Skill.",
      flavor: `"I know which nerve clusters can make someone talk, and which can render them silent." —Elektra`,
      illustrator: "Bruno Frenda",
      text: "[star] Discount 1 ([[Martial Artist]]).\n<b>Hero Action</b> <i>(attack)</i>: Deal 2 damage to an enemy. Stun or confuse that enemy.",
    }),
    `${src("e20.png", "mc63_nerve-strike.png")} Cost 3 with a star beside it (the Discount line).`,
  ),
  P.added(
    P.aspect("upgrade", "aggression", "63020", "Flow of Battle", {
      cost: 1,
      resource_mental: 1,
      traits: "Skill.",
      flavor: `"The only way out is through." —Daredevil`,
      text: "Prerequisite ([[Martial Artist]]). Max 1 per player.\n<b>Hero Response</b>: After you attack and exactly defeat an enemy, discard this card → draw 3 cards.",
    }),
    `${src("e19.png", "mc63_flow-of-battle.png")} FFG: "exactly defeat" is a defeat by an attack that deals no excess damage.`,
  ),
  P.added(
    P.aspect("event", "basic", "63023", "Hunting Shadows", {
      cost: 0,
      resource_mental: 1,
      traits: "Tactic.",
      text: "<b>Hero Action</b>: Search the top 8 cards of the encounter deck for a card and set it aside. Shuffle the encounter deck and put the set-aside card on top of it.",
    }),
    src("e21.png", "mc63_hunting-shadows.png"),
  ),
  P.added(
    P.aspect("upgrade", "basic", "63027", "Dance with the Devil", {
      deck_limit: 1,
      cost: 0,
      resource_wild: 1,
      scheme_amplify: 1,
      duplicate_of_code: "60031",
      traits: "Dance.",
      text: "Team-Up <i>(Daredevil and Elektra)</i>. Max 1 per deck.\nAttach to an enemy.\n<b>Hero Action</b> <i>(attack)</i>: Discard this card → deal 3 damage to attached enemy.",
    }),
    `${src("e12-1.png", "mc63_dance-with-the-devil.png")} Amplify icon centred under the text box (scheme_amplify 1). A verbatim reprint of fne 60031 (duplicate_of_code; the Hall of Heroes text and the icon agree).`,
  ),
];

const VIDEO_NOTE = "from gameplay video, unverified wording";
const OBLIGATION = P.added(
  P.encounter("obligation", "63040", "Conditioned by the Hand", {
    card_set_code: "elektra",
    card_set_name: "Elektra",
    card_set_type_name_code: "hero",
    boost: 2,
    text: "<b><i>Give to the Elektra Natchios player.</i></b>\n<b>Forced Response</b> <i>(Hero)</i>: After the player phase ends, deal 3 damage to another identity or ally in play.\n<b>Alter-Ego Action</b>: Exhaust your identity → discard this card.",
  }),
  `Gameplay video ${VIDEO} [48:13], ${VIDEO_NOTE} ; the 2 boost icons come from the unofficial fan preview supplied by the owner, 2026-11-14 (footer "ELEKTRA (1/1)"); collector number unknown.`,
);
const AKA = P.added(
  P.encounter("minion", "63041", "Aka", {
    card_set_code: "elektra_nemesis",
    card_set_name: "Elektra Nemesis",
    card_set_type_name_code: "nemesis",
    set_position: 1,
    is_unique: true,
    scheme: 2,
    attack: 2,
    health: 4,
    boost_star: true,
    traits: "Hand. Ninja.",
    text: `Quickstrike.\n<b>When Defeated</b>: Shuffle this card into the encounter deck.\n<i>(Elektra's nemesis minion.)</i>${HR}[star] <b>Boost</b>: Deal Aka to the Elektra Natchios player as a facedown encounter card.`,
  }),
  `Gameplay video ${VIDEO} [48:11], ${VIDEO_NOTE}: footer "ELEKTRA NEMESIS (1/5)", SCH 2, ATK 2, HP 4, traits Hand. Ninja. Boost icons: the star only.`,
);

const FAN_NOTE =
  "unofficial fan preview supplied by the owner, 2026-11-14 (every image reads UNOFFICIAL PREVIEW - NOT AN OFFICIAL CARD; text read, never the art)";
const FIST_FITS = P.added(
  P.encounter("side_scheme", "63042", "The Fist Fits in the Hand", {
    card_set_code: "elektra_nemesis",
    card_set_name: "Elektra Nemesis",
    card_set_type_name_code: "nemesis",
    set_position: 2,
    base_threat: 3,
    scheme_crisis: 1,
    boost: 3,
    flavor: `"You think you're alone, Elektra, but you'll never be alone. I'll always be there with you in the shadows."`,
    text: "Each [[Hand]] minion gets +1 SCH and +1 ATK.",
  }),
  `From the ${FAN_NOTE}: footer "ELEKTRA NEMESIS (2/5)", 3 per hero starting threat, 3 boost icons, one scheme icon read as crisis (red plus; unverified).`,
);
const HAND_BLADEMASTER = P.added(
  P.encounter("minion", "63044", "Hand Blademaster", {
    card_set_code: "elektra_nemesis",
    card_set_name: "Elektra Nemesis",
    card_set_type_name_code: "nemesis",
    set_position: 4,
    scheme: 1,
    attack: 1,
    health: 3,
    boost: 1,
    traits: "Hand.",
    text: "Hand Blademaster gets +1 SCH and +1 ATK for each other [[Hand]] minion in play.\n<b>When Defeated</b>: Shuffle this card into the encounter deck.",
  }),
  `From the ${FAN_NOTE}: footer "ELEKTRA NEMESIS (4/5)", SCH 1, ATK 1, HP 3, 1 boost icon.`,
);
const HAND_ARCHER = P.added(
  P.encounter("minion", "63045", "Hand Archer", {
    card_set_code: "elektra_nemesis",
    card_set_name: "Elektra Nemesis",
    card_set_type_name_code: "nemesis",
    set_position: 5,
    scheme: 1,
    attack: 1,
    health: 3,
    boost: 1,
    traits: "Hand.",
    text: "Quickstrike. Ranged.\n<b>When Defeated</b>: Shuffle this card into the encounter deck.",
  }),
  `From the ${FAN_NOTE}: footer "ELEKTRA NEMESIS (5/5)", SCH 1, ATK 1, HP 3, 1 boost icon.`,
);

const ALL_CARDS = [IDENTITY, ...NINJA, ...KIT, ...ASPECT, OBLIGATION, AKA, FIST_FITS, HAND_BLADEMASTER, HAND_ARCHER];

const inferred = (code: string, what: string, evidence: string) => ({
  code,
  reason: `Data decision: ${what}`,
  evidence,
});

export const ELEKTRA_CURATION: PackCuration = {
  packCode: "elektra",
  cycle: { id: "cycle11", name: "Fear No Evil", order: 11 },
  pack: {
    name: "Elektra",
    // FFG gives only the month; the day is unknown. The first of the month stands in for it (a pointer, not a claim).
    releaseDate: "2026-11-01",
    releaseDateSource:
      'FFG announcement "Killer Instinct" (https://www.fantasyflightgames.com/en/news/2026/8/13/killer-instinct/) and Hall of Heroes (https://hallofheroeslcg.com/elektra-natchios/): "November 2026", no day given (product code MC63en). The first of the month stands in for the unknown day.',
  },
  outDir: "src/data/elektra",
  exportPrefix: "ELEKTRA",
  scanOnly: true,

  addedRecords: ALL_CARDS,

  corrections: [
    inferred(
      "63002",
      "the NINJA deck's counts are inferred: footers read NINJA (2/6), (3/6) and (5/6) for Stars, Strike and Vanish, six cards in all, so two copies each.",
      "Images e3-1.png, e4.png, e5.png (set positions 2, 3, 5 of 6; collector numbers 2, 3, 4). Stars printing position 2 rather than 1 does not fit a first-position reading; a 2/2/2 split is the most consistent but unconfirmed.",
    ),
    inferred(
      "63003",
      "quantity 2 is inferred: Ninja Strike prints (3/6) and Ninja Vanish (5/6), so Strike holds 3 and 4; the footer shows only a card's first position. With Stars at (2/6), position 1 is not accounted for, so the 2/2/2 split is unconfirmed.",
      "Images e4.png (3/6) and e5.png (5/6); first-position reading confirmed by the kit's full-size footers.",
    ),
    inferred(
      "63004",
      "quantity 2 is inferred: Ninja Vanish prints (5/6) and is the last card, so it holds 5 and 6. The deck is six cards; Stars (2/6) and Strike (3/6) leave position 1 unexplained, so the 2/2/2 split is unconfirmed.",
      "Image e5.png (5/6).",
    ),
    inferred(
      "63006",
      "quantity 2 is inferred from set positions: the card prints (2/15) and Killer Blow is (4/15).",
      "Image e11.png; the kit's printed positions are 1, 2, 4, 6, 8, 12, 14 of 15.",
    ),
    inferred(
      "63007",
      "quantity 2 is inferred from set positions: the card prints (4/15) and Move Unseen is (6/15).",
      "Image e8.png.",
    ),
    inferred(
      "63008",
      "quantity 2 is inferred from set positions: the card prints (6/15) and Sai Strike is (8/15).",
      "Image e9.png.",
    ),
    inferred(
      "63009",
      "quantity 2 is read from set positions: the card prints (8/15), the footer shows only a card's first position, and Resurrection Altar (63010) is (10/15), so Sai Strike holds positions 8 and 9.",
      "Images e6.png and the full-size shot of Resurrection Altar (14-44); the kit now fills 15 of 15 (Daredevil 1, Acrobatic Prowess 2-3, Killer Blow 4-5, Move Unseen 6-7, Sai Strike 8-9, Resurrection Altar 10, White Tiger 11, Elektra's Sai 12-13, History 14, Stealth Mastery 15).",
    ),
    inferred(
      "63012",
      "quantity 2 is inferred from set positions: the card prints (12/15) and History with the Hand is (14/15); the FFG article says she has two Sai.",
      "Image e7.png; FFG article text.",
    ),
    inferred("63013", "quantity 1: the card prints (14/15) and Stealth Mastery (14) is (15/15).", "Image e13.png."),
    {
      code: "63001a",
      reason:
        "Villainous on a hero face: the star on THW, ATK and DEF is the printed reminder tied to the keyword (no value is modified).",
      evidence: `Image e2-1.png: 0*, 1*, 1*; "Villainous. (When this character uses a basic power, give it a boost card.)"`,
    },
    {
      code: "63040",
      reason:
        'PLACEHOLDER: the code 63040 is provisional (the obligation is assumed to follow the last player card, as Luke Cage\'s 62028); the collector number was not read. Text is from a gameplay video, unverified wording; 2 boost icons from the unofficial fan preview. The fan preview prints "Hero Forced Response" and "Exhaust Elektra Natchios -> discard this card" where the video read "Forced Response (Hero)" and "Exhaust your identity": the video wording is kept.',
      evidence: `Gameplay video ${VIDEO} [48:13]; ${FAN_NOTE}.`,
    },
    {
      code: "63041",
      reason:
        'PLACEHOLDER: the code 63041 is provisional (nemesis 1/5, numbered after the obligation); the collector number was not read. Text and stats are from a gameplay video, unverified wording. The fan preview agrees on stats, boost (star only) and text, except that it prints only the trait "Hand." and "Shuffle Aka into the encounter deck"; the video wording and traits (Hand. Ninja.) are kept.',
      evidence: `Gameplay video ${VIDEO} [48:11]; ${FAN_NOTE}.`,
    },
    {
      code: "63042",
      reason:
        "PLACEHOLDER (unofficial, fan preview only): the code 63042 is provisional (nemesis 2/5, numbered after the obligation); text, stats and the crisis icon reading are from an unofficial fan preview, not an official card. Nemesis 3/5 (63043) is unknown and has no record.",
      evidence: `${FAN_NOTE}.`,
    },
    {
      code: "63044",
      reason:
        "PLACEHOLDER (unofficial, fan preview only): the code 63044 is provisional (nemesis 4/5); text and stats are from an unofficial fan preview. Quantity 1 is as printed (4/5), but the fan source skips 3/5, so this may be two copies at 3-4/5.",
      evidence: `${FAN_NOTE}.`,
    },
    {
      code: "63045",
      reason:
        "PLACEHOLDER (unofficial, fan preview only): the code 63045 is provisional (nemesis 5/5); text and stats are from an unofficial fan preview.",
      evidence: `${FAN_NOTE}.`,
    },
  ],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [],

  // Elektra's NINJA deck (alter-ego 1B: "begins the game with a NINJA deck"). Encounter-shaped cards, never in a hand,
  // discard pile or the player deck; shuffled into the encounter deck one at a time and returned by their own Boost.
  separateDecks: [
    {
      identityCode: "63001a",
      deckName: "Ninja",
      cardCodes: ["63002", "63003", "63004"],
      topCardFaceup: false,
      discardPile: "none",
      whenEmpty: "stayEmpty",
      cardFamily: "encounter",
    },
  ],
  auxiliaryHeroSetCodes: { elektra_ninja_deck: "elektra" },
  artUnavailable: {
    "63040": "Seen only in a gameplay video (no card image); placeholder pending a scan.",
    "63041": "Seen only in a gameplay video (no card image); placeholder pending a scan.",
    "63042": "Seen only in an unofficial fan preview (not an official card); placeholder pending a scan.",
    "63044": "Seen only in an unofficial fan preview (not an official card); placeholder pending a scan.",
    "63045": "Seen only in an unofficial fan preview (not an official card); placeholder pending a scan.",
  },
};
