/**
 * Iron Fist Hero Pack (MC64, cycle 11, Fear No Evil wave) curation: a scan-only pack (MarvelCDB has no Iron Fist pack,
 * so every record is an added record, as Shadowland's and Elektra's). Transcribed from the Hall of Heroes page
 * (https://hallofheroeslcg.com/iron-fist-danny-rand/) and the FFG preview article "Way of the Iron Fist"
 * (https://www.fantasyflightgames.com/en/news/2026/8/27/way-of-the-iron-fist/), card images 300 px wide, read 2026-11-14.
 *
 * What exists: the two identity faces, 10 of the 12 kit cards (Embody the Dragon and Keep 'Em Coming were never
 * shown), 5 protection cards and 2 basic cards, plus three cards read from a gameplay video (the obligation, the
 * nemesis minion Davos and a Crane Daughter shell). Never seen, so not transcribed: Embody the Dragon, Keep 'Em
 * Coming, Defiance, The Night Nurse, Colleen Wing, Punch Reverse Punch, Thunder Dojo, Death by a Thousand Cuts,
 * Zen-Like Calm, Sensei, The Defenders, an Iron Fist ally; unseen collector numbers 9, 11, 14, 15, 17, 21, 23 and
 * anything after 24; nemesis 5 of 5.
 *
 * Evidence abbreviations: "HoH" is the Hall of Heroes page above, "FFG" the article above, "video" the gameplay video
 * https://youtu.be/6wR6kfxPmio (Web-Warrior Fanatic, 2026-11-13).
 *
 * - PLACEHOLDER codes: 64028 (obligation), 64029 (Davos) and 64030 (Crane Daughter) are provisional collector numbers.
 */
import type { PackCuration } from "./types.ts";
import { packBuilders } from "./hero-pack-scans.ts";

const P = packBuilders({ num: "64", packCode: "iron_fist", packName: "Iron Fist", productCode: "Iron Fist (MC64)" });

const HOH = "https://hallofheroeslcg.com/iron-fist-danny-rand/";
const FFG = "https://www.fantasyflightgames.com/en/news/2026/8/27/way-of-the-iron-fist/";
const VIDEO = "https://youtu.be/6wR6kfxPmio";
const src = (hohImage: string, ffgImage: string) =>
  `HoH ${HOH} image ${hohImage}, FFG ${FFG} image ${ffgImage} (300 px previews, read 2026-11-14).`;

const IDENTITY = P.added(
  P.identity(
    {
      name: "Iron Fist",
      hand_size: 5,
      health: 10,
      thwart: 1,
      attack: 2,
      defense: 2,
      traits: "Defender. K'un-Lun. Martial Artist.",
      illustrator: "Joey Vazquez",
      text: "<i>Martial Arts Master</i> — <b>Response</b>: After you play a card, place 1 chi counter here.\n<b>Forced Response</b>: After the player phase ends, remove all but 4 chi counters from here and heal 1 damage for each chi counter removed this way.",
    },
    {
      name: "Danny Rand",
      hand_size: 6,
      health: 10,
      recover: 4,
      traits: "Civilian.",
      illustrator: "Joey Vazquez",
      flavor: `"My name is Daniel Rand. I am the Iron Fist and I know kung fu."`,
      text: "Your [[Technique]] cards lose temporary.\n<i>Meditation</i> — <b>Action</b>: Search your deck and discard pile for a [[Technique]] card. Put that card into play. <i>(Limit once per phase.)</i>",
    },
  ),
  `${src("2.png (hero 1A) and 1.png (alter-ego 1B)", "MC64_Iron-Fist_Iron-Fist.png and MC64_Iron-Fist_Danny-Rand.png")} The Limit prints "once per phase" (the FFG article paraphrases it as once per turn).`,
);

const KIT = [
  P.added(
    P.kit("event", "64002", "Deep Breathing", 1, {
      quantity: 3,
      cost: 0,
      resource_mental: 1,
      traits: "Skill.",
      flavor: `"In through the nose, out through the mouth." —Danny Rand`,
      text: "<b>Hero Action</b>: Discard cards from the top of your deck until you discard an Iron Fist card and add it to your hand.",
    }),
    src("7.png", "MC64_Iron-Fist_Deep-Breathing.png"),
  ),
  P.added(
    P.kit("event", "64003", "Dragon Punch", 4, {
      cost: 2,
      resource_energy: 1,
      traits: "Attack. Superpower.",
      text: "<b>Hero Action</b> <i>(attack)</i>: Deal 2 damage to an enemy. You may remove up to 5 chi counters from your identity to deal 2 additional damage for each chi counter removed this way. If you removed at least 3 counters, also stun that enemy.",
    }),
    src("11-1.png", "MC64_Iron-Fist_Dragon-Punch.png"),
  ),
  P.added(
    P.kit("event", "64004", "Fists of Fury", 5, {
      quantity: 2,
      cost: 1,
      resource_physical: 1,
      traits: "Attack.",
      flavor: `"Kiai, kiai...wah CHA!" —Iron Fist`,
      text: "<b>Hero Action</b> <i>(attack)</i>: Deal 1 damage to an enemy. Deal 1 damage to an enemy. Deal 1 damage to an enemy.",
    }),
    src("8.png", "MC64_Iron-Fist_Fist-of-Fury.png"),
  ),
  P.added(
    P.kit("event", "64005", "The Way of Things", 7, {
      quantity: 2,
      cost: 1,
      resource_mental: 1,
      traits: "Skill. Thwart.",
      flavor: `"When there is no desire, all things are at peace." —Lao Tzu`,
      text: "<b>Hero Action</b> <i>(thwart)</i>: Remove 2 threat from a scheme. You may remove 2 chi counters from Iron Fist to remove 2 threat from a scheme.",
    }),
    src("10.png", "MC64_Iron-Fist_Way-of-Things.png"),
  ),
  P.added(
    P.kit("support", "64006", "Lei Kung", 9, {
      is_unique: true,
      cost: 1,
      resource_energy: 1,
      traits: "K'un-Lun. Martial Artist. Persona.",
      flavor: `"I don't know how he earned the moniker 'the Thunderer' and I've been afraid to ask." —Danny Rand`,
      illustrator: "Aitor Prieto",
      text: "<b>Action</b>: Exhaust Lei Kung and remove 1 chi counter from your identity → draw 1 card.",
    }),
    src("9.png", "MC64_Iron-Fist_Lei-Kung.png"),
  ),
  P.added(
    P.kit("upgrade", "64007", "Book of the Iron Fist", 10, {
      is_unique: true,
      cost: 2,
      resource_physical: 1,
      traits: "Item. K'un-Lun.",
      flavor: "This tome recounts the lives of all Immortal Weapons who've earned the title of Iron Fist.",
      illustrator: "Simone Ragazzoni",
      text: "<b>Hero Action</b>: Exhaust this card → if the top card of your discard pile is a [[Technique]], put it into play.",
    }),
    `${src("6.png", "MC64_Iron-Fist_Book-of-the_Iron-Fist.png")} No attachment target is printed.`,
  ),
  P.added(
    P.kit("upgrade", "64008", "Channel the Iron Fist", 11, {
      cost: 0,
      resource_energy: 1,
      traits: "Technique.",
      text: "Temporary.\n<b>Hero Interrupt</b>: When you attack, remove 1 chi counter from Iron Fist → increase the amount of damage that attack deals by 1 (by 2 instead if it is a basic attack).",
    }),
    src("3.png", "MC64_Iron-Fist_IChannel-the-Iron-Fist.png"),
  ),
  P.added(
    P.kit("upgrade", "64010", "Feel the Flow", 13, {
      cost: 0,
      resource_mental: 1,
      traits: "Technique.",
      flavor: `"My mind is empty. I am formless and shapeless. I am as water." —Iron Fist`,
      text: "Temporary.\n<b>Hero Action</b> <i>(thwart)</i>: Remove 1 chi counter from Iron Fist → remove 1 threat from a scheme.",
    }),
    src("4.png", "MC64_Iron-Fist_Feel-the-Flow.png"),
  ),
  P.added(
    P.kit("upgrade", "64012", "Redirect Chi", 15, {
      cost: 0,
      resource_wild: 1,
      traits: "Technique.",
      flavor: `"Let it flow." —Lei Kung`,
      text: "Temporary.\n<b>Hero Resource</b>: Remove 2 chi counters from Iron Fist → generate [wild][wild] resources.",
    }),
    src("5.png", "MC64_Iron-Fist_Redirect-Chi.png"),
  ),
];

const ASPECT = [
  P.added(
    P.aspect("ally", "protection", "64013", "Helpful Bystander", {
      deck_limit: 1,
      cost: 1,
      resource_physical: 1,
      health: 1,
      traits: "Civilian.",
      text: "Vulnerable. Max 1 per deck.\nYour hero gets +1 hand size.\n<b>Forced Interrupt</b>: When an enemy attacks you, it attacks Helpful Bystander instead. This attack gains overkill.",
    }),
    `${src("12.png", "MC64_Iron-Fist_Helpful-Bystander.png")} THW and ATK print a dash (no thwart or attack value); a small consequential-damage pip sits under each dash.`,
  ),
  P.added(
    P.aspect("event", "protection", "64016", "Demoralize", {
      cost: 0,
      resource_mental: 1,
      traits: "Tactic.",
      flavor: `"That axe is not all I'm gonna break." —Luke Cage`,
      text: "<b>Hero Action</b>: Choose an enemy. It attacks you. Confuse that enemy.",
    }),
    src("14.png", "MC64_Iron-Fist_-Demoralize.png"),
  ),
  P.added(
    P.aspect("upgrade", "protection", "64018", "Redirection Mastery", {
      cost: 2,
      resource_physical: 1,
      traits: "Skill.",
      text: "Play under any player's control. Max 1 per player.\n<b>Hero Response</b>: After you exactly defend an attack, deal damage to the attacker equal to your DEF for that attack.",
    }),
    `${src("15.png", "MC64_Iron-Fist_Redirection-Mastery.png")} FFG: "exactly defend" means your DEF equals the attack's final ATK.`,
  ),
  P.added(
    P.aspect("upgrade", "protection", "64019", "No Time to Bleed", {
      cost: 2,
      cost_star: true,
      resource_mental: 1,
      traits: "Condition.",
      text: "[star] Discount 1 ([[Martial Artist]] or [[Soldier]]).\nTemporary. Max 1 per player.\n<b>Response</b>: After you play a card <i>(including this one)</i>, heal 1 damage from your identity.",
    }),
    `${src("13.png", "MC64_Iron-Fist_No-Time-To-Bleed.png")} Cost 2 with a star beside it (the Discount line).`,
  ),
  P.added(
    P.aspect("upgrade", "protection", "64020", "Tonfa", {
      cost: 1,
      resource_physical: 1,
      traits: "Item. Weapon.",
      illustrator: "Andrea Di Vito & Laura Villari",
      text: "Restricted.\n<b>Hero Interrupt</b>: When calculating damage during an attack against you, exhaust this card → give your hero either +1 DEF or retaliate 1 for this attack.",
    }),
    src("16.png", "MC64_Iron-Fist_Tonfa.png"),
  ),
  P.added(
    P.aspect("ally", "basic", "64022", "Luke Cage", {
      is_unique: true,
      deck_limit: 1,
      cost: 4,
      resource_physical: 1,
      thwart: 1,
      thwart_cost: 1,
      attack: 2,
      attack_cost: 1,
      health: 3,
      traits: "Defender. Hero for Hire.",
      flavor: `"They don't call ol' Luke Cage 'Power Man' for nothin'!"`,
      text: "Toughness.\nIf your hero shares a [[Trait]] with Luke Cage, your hero gets +1 DEF.",
    }),
    src("17.png", "MC64_Iron-Fist_Luke-Cage.png"),
  ),
  P.added(
    P.aspect("event", "basic", "64024", "Power Man and Iron Fist", {
      deck_limit: 1,
      cost: 0,
      resource_physical: 1,
      traits: "Attack.",
      text: "Team-Up <i>(Iron Fist and Luke Cage)</i>. Max 1 per deck.\n<b>Hero Action</b> <i>(attack)</i>: Deal 2 damage to an enemy and give a tough status card to a character.",
    }),
    src("18.png", "MC64_Iron-Fist_IPower-Man-Iron-Fist.png"),
  ),
];

const VIDEO_NOTE = "from gameplay video, unverified wording";
const OBLIGATION = P.added(
  P.encounter("obligation", "64028", "Lack of Chi", {
    card_set_code: "iron_fist",
    card_set_name: "Iron Fist",
    card_set_type_name_code: "hero",
    boost: 2,
    text: "<b><i>Give to the Danny Rand player.</i></b>\n<b>When Revealed</b>: Move all chi counters from your identity to this card.\n<b>Forced Interrupt</b>: When you would place a chi counter on Iron Fist, place it here instead. If there are at least 4 chi counters here, discard this card.",
  }),
  `Gameplay video ${VIDEO} [~1:00, in play ~45:01], ${VIDEO_NOTE}: footer "IRON FIST", 2 boost icons; collector number and quantity unreadable.`,
);
const DAVOS = P.added(
  P.encounter("minion", "64029", "Davos", {
    card_set_code: "iron_fist_nemesis",
    card_set_name: "Iron Fist Nemesis",
    card_set_type_name_code: "nemesis",
    set_position: 1,
    is_unique: true,
    scheme: 1,
    attack: 2,
    health: 5,
    boost: 2,
    traits: "K'un-Lun.",
    text: `<b>When Revealed</b>: Find and tuck the 3 Crane Daughter minions under here.\n<b>Forced Interrupt</b>: When Davos would take any amount of damage, shuffle a tucked Crane Daughter from under Davos into the encounter deck instead.\n<i>(Iron Fist's nemesis minion.)</i>`,
  }),
  `Gameplay video ${VIDEO} [1:14], ${VIDEO_NOTE}: footer "IRON FIST NEMESIS (1/5)", SCH 1, ATK 2, HP 5, 2 boost icons. "Find and tuck the 3" was assembled from two frames; the minion may be titled "Crane Daughters".`,
);
const CRANE_DAUGHTER = P.added(
  P.encounter("minion", "64030", "Crane Daughter", {
    card_set_code: "iron_fist_nemesis",
    card_set_name: "Iron Fist Nemesis",
    card_set_type_name_code: "nemesis",
    set_position: 2,
    quantity: 3,
    scheme: 0,
    attack: 0,
    health: 1,
    text: "",
  }),
  `Gameplay video ${VIDEO} [1:14], ${VIDEO_NOTE}: only the title "Crane Da..." in the nemesis stack was seen; text and stats are unread (shell).`,
);

const ALL_CARDS = [IDENTITY, ...KIT, ...ASPECT, OBLIGATION, DAVOS, CRANE_DAUGHTER];

const inferred = (code: string, what: string, evidence: string) => ({
  code,
  reason: `Data decision: ${what}`,
  evidence,
});

export const IRON_FIST_CURATION: PackCuration = {
  packCode: "iron_fist",
  cycle: { id: "cycle11", name: "Fear No Evil", order: 11 },
  pack: {
    name: "Iron Fist",
    // FFG gives only the month; the day is unknown. The first of the month stands in for it (a pointer, not a claim).
    releaseDate: "2026-11-01",
    releaseDateSource:
      'FFG announcement "Way of the Iron Fist" (https://www.fantasyflightgames.com/en/news/2026/8/27/way-of-the-iron-fist/) and Hall of Heroes (https://hallofheroeslcg.com/iron-fist-danny-rand/): "November 2026", released alongside Elektra, no day given (product code MC64en). The first of the month stands in for the unknown day.',
  },
  outDir: "src/data/iron_fist",
  exportPrefix: "IRON_FIST",
  scanOnly: true,

  addedRecords: ALL_CARDS,

  corrections: [
    inferred(
      "64002",
      "quantity 3 is inferred from set positions: the card prints (1/15) at this resolution and Dragon Punch is (4/15).",
      "Image 7.png; the kit's seen positions are 1, 4, 5, 7, 9, 10, 11, 13, 15 of 15. Re-check against a larger scan.",
    ),
    inferred(
      "64004",
      "quantity 2 is inferred from set positions: the card prints (5/15) and The Way of Things is (7/15).",
      "Image 8.png.",
    ),
    inferred(
      "64005",
      "quantity 2 is inferred from set positions: the card prints (7/15) and Lei Kung is (9/15).",
      "Image 10.png.",
    ),
    {
      code: "64013",
      reason:
        "THW and ATK print a dash: Helpful Bystander has no thwart or attack value (RRG 1.8 Dash (Value), p. 15). The small pip under each dash is not read as a consequential-damage value.",
      evidence: "Image 12.png (300 px).",
    },
    {
      code: "64028",
      reason:
        "PLACEHOLDER: the code 64028 is provisional (the obligation is assumed to follow the last player card, as Luke Cage's 62028); the collector number and quantity were not read. Text is from a gameplay video, unverified wording.",
      evidence: `Gameplay video ${VIDEO} [~1:00].`,
    },
    {
      code: "64029",
      reason:
        "PLACEHOLDER: the code 64029 is provisional (nemesis 1/5 after the obligation). Text and stats are from a gameplay video, unverified wording. The card prints a second trait that was partly hidden (likely Martial Artist, unconfirmed), so only K'un-Lun is recorded.",
      evidence: `Gameplay video ${VIDEO} [1:14].`,
    },
    {
      code: "64030",
      reason:
        "PLACEHOLDER: the code 64030, the quantity 3 (inferred from Davos's 'the 3 Crane Daughter minions') and the whole record are provisional. Text is empty (unread) and ATK 0, SCH 0, HP 1 are the minimum the validator needs, not printed values.",
      evidence: `Gameplay video ${VIDEO} [1:14]: only the title "Crane Da..." was seen.`,
    },
  ],
  errata: [],

  scriptingNotes: {},
  cardNotes: {
    "64013":
      "Helpful Bystander: THW and ATK both print a dash (image 12.png), so it can neither thwart nor attack; HP 1 (Vulnerable). No thwart or attack value is emitted, as Hulk's dash THW (luke_cage 62020).",
    "64030": "Placeholder minion: stats and text are unknown, ATK 0 / SCH 0 / HP 1 only satisfy the validator.",
  },

  scenarios: [],
  starterDecks: [],

  artUnavailable: {
    "64028": "Seen only in a gameplay video (no card image); placeholder pending a scan.",
    "64029": "Seen only in a gameplay video (no card image); placeholder pending a scan.",
    "64030": "Seen only in a gameplay video (no card image); placeholder pending a scan.",
  },
};
