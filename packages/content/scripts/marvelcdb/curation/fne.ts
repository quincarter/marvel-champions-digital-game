/**
 * Fear No Evil (MC60, cycle 11) curation: a campaign expansion with two heroes (Daredevil, Echo) and six scenarios
 * (Kingpin plus Bullseye, Electro and Purple Man, mixed and matched). MarvelCDB carries the 66 player-side records
 * (60001 to 60064 with the three Photographic Reflexes printings); the scenario half (60065 to 60210) is transcribed
 * in `fne-encounter/` and joins as `addedRecords`.
 *
 * Evidence abbreviations: "scan" is `assets/card-art/bundles/cards/<code>.png` (gitignored, read directly, never wired
 * into the data), "MC60 p. N" is the box rulebook (docs/campaign-modes/markdown/mc60_fear_no_evil.md, printed pages),
 * "RRG" is the v1.8 rules reference, "survey" is docs/phase7-wave11-data-survey.md and "spec" is docs/phase7-wave11.md.
 *
 * - Daredevil's Sense deck (60002 to 60006) is a `separateDecks` entry on 60001a, fixed order and open to its owner
 *   (spec section 1.1); its cards file under `daredevil_sense_deck`, resolved to the hero by `auxiliaryHeroSetCodes`.
 * - Photographic Reflexes is three records (60040a/b/c, two copies each, the "(x6)" of MC60 p. 25), kept as three
 *   cards (spec section 1.2). Its cost is a printed star.
 */
import type { Correction, PackCuration, StarterDeckCuration } from "./types.ts";
import { KINGPIN } from "./fne-encounter/kingpin.ts";
import { MODULAR_CAMPAIGN } from "./fne-encounter/modular-campaign.ts";
import { SCENARIOS } from "./fne-encounter/scenarios.ts";
import { VILLAINS_A } from "./fne-encounter/villains-a.ts";
import { VILLAINS_B } from "./fne-encounter/villains-b.ts";

/** Scenario-half records the normalizer could not read as printed: an attach host. */
const SCENARIO_HALF_CORRECTIONS: readonly Correction[] = [
  {
    code: "60068a",
    reason:
      "Adamantium-Laced Spine prints no attach sentence: Bullseye's own When Revealed finds it and attaches it to him.",
    evidence:
      'Scan 60068a.jpg (Permanent, no "Attach to"); Bullseye stage 1B text "Find Adamantium-Laced Spine and attach it to Bullseye." (60065 to 60067). Never applied to text.',
    impliedAttachHost: { kind: "villain" },
  },
  {
    code: "60079",
    reason: "Electric Charge prints no attach sentence: Electro's own When Revealed attaches it to him.",
    evidence:
      'Scan 60079.jpg (Permanent, no "Attach to"); Electro stages I and II (60076, 60077): "Find Electric Charge, attach it to Electro". Never applied to text.',
    impliedAttachHost: { kind: "villain" },
  },
  {
    code: "60080",
    reason:
      'Drained of Power\'s attach clause sits inside its When Revealed ("Attach to your identity and exhaust each upgrade you control"), where the preamble scan does not look.',
    evidence: "Scan 60080.jpg, When Revealed text. Never applied to text.",
    impliedAttachHost: { kind: "yourIdentity" },
  },
  {
    code: "60100",
    reason:
      'Converted\'s attach clause sits inside its When Revealed ("Attach to the highest-cost ally you control and engage it"), where the preamble scan does not look.',
    evidence: "Scan 60100.jpg, When Revealed text. Never applied to text.",
    impliedAttachHost: {
      kind: "superlative",
      among: "ally",
      order: "highest",
      measure: "printedCost",
      controlledBy: "you",
    },
  },
  {
    code: "60164",
    reason:
      'Bear Hug\'s attach sentence is conditional ("If Kingpin has the Martial Artist trait, attach to your hero. Otherwise, this card gains surge."), so the parser reads no attach rule.',
    evidence: "Raw text of 60164 (Kingpin set transcription). Never applied to text.",
    impliedAttachHost: { kind: "yourIdentity", form: "hero" },
  },
  {
    code: "60165",
    reason:
      'James Wesley\'s attach clause sits inside its When Revealed ("Attach to Kingpin and give him a facedown boost card").',
    evidence: "Raw text of 60165 (Kingpin set transcription). Never applied to text.",
    impliedAttachHost: { kind: "villain" },
  },
  {
    code: "60167",
    reason:
      'Mountain of Muscle\'s attach sentence is conditional ("If Kingpin has the Martial Artist trait, attach to Kingpin. Otherwise, this card gains surge.").',
    evidence: "Raw text of 60167 (Kingpin set transcription). Never applied to text.",
    impliedAttachHost: { kind: "villain" },
  },
  ...(
    [
      ["60139", "Shop Proprietor", "Scan 60139.jpg: the cost box holds a dash; the 3 is hit points."],
      ["60210a", "Typhoid Mary", "Scan 60210a.jpg: the cost box holds a dash; the 3 is hit points."],
    ] as const
  ).map(([code, title, scan]): Correction => ({
    code,
    reason: `${title} prints a dash cost (it enters play through its own When Revealed or Setup); the transcription has no cost.`,
    evidence: `${scan} RRG Dash (Value), p. 15.`,
    specialCost: "dash",
  })),
  // The star in the boost row of each of the ten Purple Man boost cards (60100 to 60109) is printed on the card, but the
  // Boost it stands for is granted by the villain stages (60097 to 60099), not written on the card (villains-b.ts
  // header). RRG 1.8 "Boost, Boost Icon" (p. 11): the star is a printed fact, so the card keeps `starIcon: true` and
  // names its granters in `boostGrantedBy` instead of silencing the boost_star cross-check.
  ...["60100", "60101", "60102", "60103", "60104", "60105", "60106", "60107", "60108", "60109"].map(
    (code): Correction => ({
      code,
      reason:
        "The card prints a star among its boost icons but has no Boost ability of its own: the Purple Man villain stages give every boost card of the set a star Boost.",
      evidence: `Scan ${code}.jpg (boost row begins with a star). Purple Man stages 60097 to 60099 (scans 60097.jpg to 60099.jpg): 'Each boost card from the Purple Man encounter set gains: "[star] Boost: After this activation, deal this card to yourself as a facedown encounter card."'`,
      boostGrantedBy: ["60097"],
    }),
  ),
];

const MC60_P25 =
  'MC60 rulebook p. 25 "Starter Decks" (docs/campaign-modes/markdown/mc60_fear_no_evil.md, read 2026-10-18); every copy count is within the record\'s quantity, read against the raw cache.';

/** Daredevil / Justice: 40 cards (15 Daredevil, 20 Justice, 5 basic); the five Sense cards are a separate deck. */
const DAREDEVIL_JUSTICE: StarterDeckCuration = {
  id: "fne-daredevil-justice",
  name: "Daredevil (Justice) — Fear No Evil starter deck",
  identityCode: "60001a",
  aspect: "justice",
  cards: {
    "60007": 1, // Elektra
    "60008": 2, // Cross-Examination
    "60009": 2, // Deposition
    "60010": 2, // Living Lie Detector
    "60011": 1, // Raising Hell
    "60012": 1, // Focus the Senses
    "60013": 1, // Foggy Nelson
    "60014": 1, // Karen Page
    "60015": 1, // Nelson and Murdock
    "60016": 1, // Sister Maggie
    "60017": 1, // Daredevil's Billy Club
    "60018": 1, // The Man Without Fear
    "60019": 1, // Blindspot
    "60020": 1, // Cloak
    "60021": 1, // Dagger
    "60022": 1, // Ghost Rider
    "60023": 3, // Know Your Enemy
    "60024": 1, // De-escalation
    "60025": 3, // Chance Encounter
    "60026": 3, // Legal Trouble
    "60027": 3, // Move in Shadow
    "60028": 3, // Stealth Training
    "60029": 1, // Stick
    "60030": 3, // Contingency Planning
    "60031": 1, // Dance with the Devil
  },
  obligationCode: "60032", // Sensory Overload
  nemesisCodes: ["60033", "60034", "60035", "60036"], // Bullseye, Deadliest Man Alive, Stolen Sai, Eye on the Target x2
  verified: true,
  sources: [MC60_P25],
  note: "40 cards. Sense cards 60002 to 60006 are the identity's separate deck, outside the 40 (the page lists them first). Nemesis set: Bullseye, Deadliest Man Alive, Stolen Sai, Eye on the Target (x2).",
};

/** Echo / Protection: 40 cards (15 Echo, 20 Protection, 5 basic). */
const ECHO_PROTECTION: StarterDeckCuration = {
  id: "fne-echo-protection",
  name: "Echo (Protection) — Fear No Evil starter deck",
  identityCode: "60037a",
  aspect: "protection",
  cards: {
    "60039": 1, // Daredevil
    "60040a": 2, // Photographic Reflexes (x6 across the three printings)
    "60040b": 2,
    "60040c": 2,
    "60041": 2, // Study the Tape
    "60042": 1, // The Rez
    "60043": 1, // American Sign Language
    "60044": 1, // Choreography
    "60045": 1, // Echo's Katana
    "60046": 1, // Improvisation
    "60047": 1, // Muscle Memory
    "60038": 1, // Innate Reflexes
    "60048": 3, // Army of One
    "60049": 3, // Get Their Attention
    "60050": 3, // In Harm's Way
    "60051": 3, // Powerful Punch
    "60052": 3, // The Best Offense...
    "60053": 1, // Ronin
    "60054": 3, // Stand Alone
    "60055": 1, // See No Evil, Hear No Evil
    "60056": 1, // Superpower Training
    "60057": 1, // Energy
    "60058": 1, // Genius
    "60059": 1, // Strength
  },
  obligationCode: "60060", // Raised by the Kingpin
  nemesisCodes: ["60061", "60062", "60063", "60064"], // Kingpin, Master Manipulator, Kingpin's Henchman x2, Pawn of the Kingpin
  verified: true,
  sources: [
    MC60_P25,
    'Basic line: See No Evil, Hear No Evil; Superpower Training; Energy; Genius; Strength. MarvelCDB decklist 63934 ("Echo - precon deck", posted 2026-07-24) swaps Strength for Stick (60029); the rulebook is the primary source, so its list is used.',
  ],
  note: 'Innate Reflexes (60038) has the Starting keyword (MC60 p. 3). Photographic Reflexes is six copies in three printings of two (the page\'s "(x6)").',
};

export const FNE_CURATION: PackCuration = {
  packCode: "fne",
  cycle: { id: "cycle11", name: "Fear No Evil", order: 11 },
  pack: {
    name: "Fear No Evil",
    releaseDate: "2026-07-24",
    releaseDateSource:
      'MarvelCDB pack list (https://marvelcdb.com/api/public/packs/, code fne, "available": "2026-07-24", read 2026-10-18); the same day MarvelCDB\'s Echo precon decklist 63934 was posted. Replaces the Hall of Heroes page\'s month-only "July, 2026".',
  },
  outDir: "src/data/fne",
  exportPrefix: "FNE",

  /**
   * The box's scenario half (villains, scenarios, modular sets, campaign cards, 60065-60210): MarvelCDB has none
   * of it (docs/phase7-wave11-data-survey.md §3). Transcribed from Hall of Heroes' Fear No Evil gallery scans and
   * checked a second time against the same scans, one module per group.
   */
  addedRecords: [...VILLAINS_A, ...VILLAINS_B, ...KINGPIN, ...SCENARIOS, ...MODULAR_CAMPAIGN],

  corrections: [
    {
      code: "60001a",
      reason: "MarvelCDB sends THW 1 for Daredevil's hero face; the card prints THW 2 (ATK 2, DEF 2).",
      evidence:
        'Scan 60001a.png (2/2/2, read 2026-10-18, survey section 6 "checked"); MC60 p. 2 stat line "2 2 2 THW ATK DEF".',
      thwart: 2,
    },
    {
      code: "60001a",
      reason:
        "MarvelCDB's text for the hero face has only Superhuman Senses; the card also prints the Forced Interrupt for a leaving Sense upgrade (MarvelCDB has it on the Matt Murdock face only).",
      evidence:
        'Scan 60001a.png shows the sentence; scan 60001b.png has it too; MC60 p. 26: "the forced interrupt on both sides of Daredevil\'s identity card" (survey section 6, spec section 1.3 item 2).',
      textReplace: {
        find: "(paying its cost).",
        replace:
          "(paying its cost).\nForced Interrupt: When a Sense upgrade would leave play, place it on the bottom of the Sense deck instead.",
      },
    },
    ...["60040a", "60040b", "60040c"].map((code) => ({
      code,
      reason:
        "MarvelCDB sends cost -1, which the normalizer reads as a printed X; Photographic Reflexes prints a star in the cost field, a reminder of its text-box ability (RRG Star Icon, p. 40).",
      evidence:
        "Scan 60040a.png prints a star in the cost field (read 2026-10-18; spec section 0 correction 1 and section 1.2; the b and c printings share the card's text and cost).",
      specialCost: "star" as const,
    })),
    ...SCENARIO_HALF_CORRECTIONS,
  ],
  errata: [],

  scriptingNotes: {},
  cardNotes: {
    "60092":
      "Maggia Enforcers: the SCH box prints a bare star (SCH equals the number of Maggia enemies in play), emitted 0, not a dash, with the rule in the text, like Purple Man 61031: a dash cannot be modified (RRG 1.8 p. 15), so the card's setBase constant needs a number (scan 60092.jpg).",
  },

  scenarios: [],
  starterDecks: [DAREDEVIL_JUSTICE, ECHO_PROTECTION],

  /**
   * Daredevil's Sense deck (MC60 p. 26): "shuffle all five of Daredevil's Sense cards together. Place it faceup next to
   * your identity and you can look through it at any time, but you cannot change the order." The upgrades never reach
   * a discard pile (the Forced Interrupt sends a leaving one to the bottom of the deck), and the deck stays empty if
   * emptied.
   */
  separateDecks: [
    {
      identityCode: "60001a",
      deckName: "Sense",
      cardCodes: ["60002", "60003", "60004", "60005", "60006"],
      topCardFaceup: true,
      discardPile: "none",
      whenEmpty: "stayEmpty",
      cardFamily: "player",
      fixedOrder: true,
      ownerMayLookThrough: true,
    },
  ],

  auxiliaryHeroSetCodes: {
    daredevil_sense_deck: "daredevil",
  },
};
