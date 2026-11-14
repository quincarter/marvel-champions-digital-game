/**
 * Elektra Hero Pack (MC63, cycle 11, Fear No Evil wave) curation: a scan-only pack (MarvelCDB has no Elektra pack, so
 * every record is an added record, as Shadowland's). Transcribed from the Hall of Heroes page
 * (https://hallofheroeslcg.com/elektra-natchios/) and the FFG preview article "Killer Instinct"
 * (https://www.fantasyflightgames.com/en/news/2026/8/13/killer-instinct/), 300 x 419 card images, read 2026-11-14.
 *
 * What exists: the two identity faces, the 3 NINJA deck cards, 7 of the 15 kit cards, 6 aggression cards and 2 basic
 * cards (19 distinct cards seen), plus two cards read from a gameplay video (the obligation and the nemesis minion).
 * Never seen, so not transcribed (the pack's remaining collector numbers): Resurrection Altar, White Tiger, Stealth
 * Mastery, Stone, Double-Cross, Backstab, Misdirect, Sabotage, Moondragon, Moon Knight (named in briefs only);
 * unseen collector numbers 10, 11, 14, 21, 22, 24 to 26 and anything after 27; nemesis cards 2 to 5 of 5.
 *
 * Evidence abbreviations: "HoH" is the Hall of Heroes page above, "FFG" the article above, "video" the gameplay video
 * https://youtu.be/6wR6kfxPmio (Web-Warrior Fanatic, 2026-11-13).
 *
 * - The NINJA deck (Ninja Stars 63002, Ninja Strike 63003, Ninja Vanish 63004) is a hero-owned deck of encounter-shaped
 *   treacheries, modelled as Hercules's Labor deck is (a `separateDecks` entry with `cardFamily: "encounter"`, no
 *   encounter set, `separateDeck: "Ninja"`); its feeders (Ninja Training, Killer Blow, Move Unseen, Sai Strike) are in
 *   their texts.
 * - PLACEHOLDER codes: 63028 (obligation) and 63029 (nemesis minion) are provisional collector numbers; see the
 *   corrections.
 */
import type { PackCuration } from "./types.ts";
import { HR, packBuilders } from "./hero-pack-scans.ts";

const P = packBuilders({ num: "63", packCode: "elektra", packName: "Elektra", productCode: "Elektra (MC63)" });

const HOH = "https://hallofheroeslcg.com/elektra-natchios/";
const FFG = "https://www.fantasyflightgames.com/en/news/2026/8/13/killer-instinct/";
const VIDEO = "https://youtu.be/6wR6kfxPmio";
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
      traits: "Condition.",
      text: "Prerequisite <i>(hero form)</i>.\nYou get +1 hand size.\n<b>Forced Response</b>: After you change form, discard this card.\n[amplify]",
    }),
    `${src("e13.png", "mc63_history-with-the-hand.png")} The icon centred under the text box (a plus joined to the boost icon) is the amplify icon, named so by the FFG article.`,
  ),
];

const ASPECT = [
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
      traits: "Dance.",
      text: "Team-Up <i>(Daredevil and Elektra)</i>. Max 1 per deck.\nAttach to an enemy.\n<b>Hero Action</b> <i>(attack)</i>: Discard this card → deal 3 damage to attached enemy.\n[amplify]",
    }),
    `${src("e12-1.png", "mc63_dance-with-the-devil.png")} Amplify icon centred under the text box.`,
  ),
];

const VIDEO_NOTE = "from gameplay video, unverified wording";
const OBLIGATION = P.added(
  P.encounter("obligation", "63028", "Conditioned by the Hand", {
    card_set_code: "elektra",
    card_set_name: "Elektra",
    card_set_type_name_code: "hero",
    text: "<b><i>Give to the Elektra Natchios player.</i></b>\n<b>Forced Response</b> <i>(Hero)</i>: After the player phase ends, deal 3 damage to another identity or ally in play.\n<b>Alter-Ego Action</b>: Exhaust your identity → discard this card.",
  }),
  `Gameplay video ${VIDEO} [48:13], ${VIDEO_NOTE} (boost icons unreadable, so none recorded; collector number unknown).`,
);
const AKA = P.added(
  P.encounter("minion", "63029", "Aka", {
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

const ALL_CARDS = [IDENTITY, ...NINJA, ...KIT, ...ASPECT, OBLIGATION, AKA];

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
      "quantity 1 is the minimum the positions allow: the card prints (8/15) and the next seen card is (12/15); collector numbers 10 and 11 (positions 9 to 11) are unseen, so a second copy at 9 is possible.",
      "Image e6.png.",
    ),
    inferred(
      "63012",
      "quantity 2 is inferred from set positions: the card prints (12/15) and History with the Hand is (14/15); the FFG article says she has two Sai.",
      "Image e7.png; FFG article text.",
    ),
    inferred(
      "63013",
      "quantity 1 is inferred: the card prints (14/15) and collector number 14 (position 15) is a different card.",
      "Image e13.png.",
    ),
    {
      code: "63001a",
      reason:
        "Villainous on a hero face: the star on THW, ATK and DEF is the printed reminder tied to the keyword (no value is modified).",
      evidence: `Image e2-1.png: 0*, 1*, 1*; "Villainous. (When this character uses a basic power, give it a boost card.)"`,
    },
    {
      code: "63028",
      reason:
        "PLACEHOLDER: the code 63028 is provisional (the obligation is assumed to follow the last player card, as Luke Cage's 62028); the collector number was not read. Text is from a gameplay video, unverified wording; boost icons unreadable.",
      evidence: `Gameplay video ${VIDEO} [48:13].`,
    },
    {
      code: "63029",
      reason:
        "PLACEHOLDER: the code 63029 is provisional (nemesis 1/5 after the obligation); the collector number was not read. Text and stats are from a gameplay video, unverified wording. Nemesis cards 2 to 5 of 5 were never shown.",
      evidence: `Gameplay video ${VIDEO} [48:11].`,
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
    "63028": "Seen only in a gameplay video (no card image); placeholder pending a scan.",
    "63029": "Seen only in a gameplay video (no card image); placeholder pending a scan.",
  },
};
