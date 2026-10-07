/**
 * Age of Apocalypse (MC45, cycle 8 campaign box) curation, pass 1: cards only. Bishop and Magik's hero kits, the five
 * scenarios' encounter cards, the modular sets and the campaign cards 164-183. The scenarios, starter decks and the
 * hand-authored `campaign.ts` are later steps (docs/phase7-wave8-data-survey.md §8 steps 5 to 7), so this curation
 * lists none yet and must not be emitted: `ingest --pack aoa` stays a `--dry-run` until then.
 *
 * Evidence abbreviations: "scan" is `assets/card-art/bundles/cards/<code>.png` (gitignored, read directly, small
 * scans enlarged; never wired into the data), "RRG" is the v1.8 rules reference, "survey" is
 * docs/phase7-wave8-data-survey.md, "spec" is docs/phase7-wave8.md.
 *
 * Applied from the campaign spec pass (docs/phase7-wave8.md §1.31): the mission side scheme b faces 45166b to 45170b
 * ("Finished.") are their own side schemes with a dash threat noted in `cardNotes`; the Overseer faces' dashes emit
 * `null` (`dashedMinionStats`); `Mission Response` is a Forced Response in the parser.
 * Left open on purpose (it waits on the hero pass of the spec): Sidekick 45015's host (gap 2). The missing back face 45104b and 45104a's wrong link (gap 8) are `addedRecords` and
 * `linkOverrides` below.
 */
import type { RawCard } from "../raw-types.ts";
import type { PackCuration } from "./types.ts";

/**
 * 45104b The Towering Citadel, transcribed from scan 45104b.png (WebP inside, 1030 x 710). Shaped like the nested
 * `linked_card` records MarvelCDB sends for a back face (compare 45105b): the same keys, nulls included, the
 * `hidden` flag set, and the image under `/bundles/cards/` the way `withLocalArt` writes a local scan. The text
 * keeps the `[[Prelate]]` trait markup raw writes for 45104a.
 */
const TOWERING_CITADEL = {
  pack_code: "aoa",
  pack_name: "Age of Apocalypse",
  pack_legacy: false,
  pack_wave: 8,
  type_code: "side_scheme",
  type_name: "Side Scheme",
  faction_code: "encounter",
  faction_name: "Encounter",
  card_set_code: "apocalypse",
  card_set_name: "Apocalypse",
  card_set_type_name_code: "villain",
  card_set_parent_code: null,
  position: 104,
  set_position: 4,
  code: "45104b",
  name: "The Towering Citadel",
  real_name: "The Towering Citadel",
  subname: null,
  cost: null,
  cost_per_hero: false,
  cost_star: false,
  text: "Threat cannot be removed from this scheme while a [[Prelate]] minion is in play.\n<b>When Defeated</b>: The first player reveals a random set-aside [[Prelate]] minion. Deal each other player an encounter card. Reveal The Tyrant's Throne side scheme and remove this card from the game.",
  real_text:
    "Threat cannot be removed from this scheme while a [[Prelate]] minion is in play.\n<b>When Defeated</b>: The first player reveals a random set-aside [[Prelate]] minion. Deal each other player an encounter card. Reveal The Tyrant's Throne side scheme and remove this card from the game.",
  boost: null,
  quantity: 1,
  health: null,
  health_per_group: false,
  health_per_hero: false,
  thwart: null,
  scheme: null,
  attack: null,
  base_threat: 3,
  base_threat_fixed: true,
  base_threat_per_group: false,
  base_threat_star: false,
  escalation_threat: null,
  escalation_threat_fixed: false,
  scheme_crisis: null,
  scheme_acceleration: 2,
  scheme_amplify: null,
  scheme_hazard: null,
  threat: null,
  threat_fixed: false,
  threat_per_group: false,
  deck_limit: null,
  stage: null,
  traits: null,
  real_traits: null,
  flavor: "",
  illustrator: "Sebasti\u00e1n Guidobono",
  is_unique: false,
  hidden: true,
  permanent: false,
  double_sided: false,
  back_text: null,
  back_flavor: null,
  back_name: null,
  attack_star: false,
  thwart_star: false,
  defense_star: false,
  health_star: false,
  recover_star: false,
  scheme_star: false,
  boost_star: false,
  threat_star: false,
  escalation_threat_star: false,
  errata: null,
  imagesrc: "/bundles/cards/45104b.png",
  spoiler: 1,
  backimagesrc: null,
} as unknown as RawCard;

export const AOA_CURATION: PackCuration = {
  packCode: "aoa",
  cycle: { id: "cycle8", name: "Age of Apocalypse", order: 8 },
  pack: {
    name: "Age of Apocalypse",
    releaseDate: "2024-03-29",
    // UNVERIFIED: the sources doc's release table is the only source so far (no FFG product page or Hall of Heroes
    // release page has been read for this date). Check it against https://hallofheroeslcg.com/the-age-of-apocalypse/
    // before the pack is emitted.
    releaseDateSource:
      "UNVERIFIED: docs/phase7-wave8-sources.md release table (March 29, 2024, Age of Apocalypse MC45); not cross-checked against an FFG or Hall of Heroes page",
  },
  outDir: "src/data/aoa",
  exportPrefix: "AOA",
  // MarvelCDB has no campaign record (docs/campaign-mode-design.md §3): `campaign.ts` (`AOA_CAMPAIGN`) is
  // hand-authored, survey §8 step 7. Ingest refuses a named module whose file is missing, so a real (non dry-run)
  // ingest cannot run before that file exists.
  handAuthoredModules: ["campaign"],

  corrections: [
    {
      code: "45159",
      reason:
        "MarvelCDB sends `is_unique: false` for Ozymandias, but the card prints the unique marker, so the RRG 1.8 unique rule binds it.",
      evidence:
        'Scan 45159.png (710 x 1030): the four-pointed star prints before the title "Ozymandias", the same marker as Bishop 45001a. Every other card of the box was read against its scan (audit of 2026-10-07); only 45159 and 45160 disagree with raw.',
      unique: true,
    },
    {
      code: "45160",
      reason:
        "MarvelCDB sends `is_unique: false` for Scarab, but the card prints the unique marker, so the RRG 1.8 unique rule binds it.",
      evidence:
        'Scan 45160.png (710 x 1030): the four-pointed star prints before the title "Scarab" (ATK 3 with a reminder star, SCH 1, boost 3, Clan Akkaba 2/7).',
      unique: true,
    },
    {
      code: "45129",
      reason:
        "MarvelCDB sends no `scheme` for Velociraptor, so the normalizer cannot tell a printed 1 from a dash or zero. The card prints SCH 1.",
      evidence:
        "Scan 45129.png: SCH 1, ATK 1 with a reminder star, boost 3, Savage Land (3/8). Survey §4.6 (scan checked) and spec §1.22. Scans 45128.png (Pterosaur, SCH 0) and 45115.png (Tusk, SCH 0) were read too; raw already carries scheme 0 for both, so neither needs a correction.",
      scheme: 1,
    },
    {
      code: "45105b",
      reason:
        'MarvelCDB reads "heal 5[per_hero] hit points from him"; the card prints "heal 5[per_hero] damage from him".',
      evidence:
        'Scan 45105b.png (419 wide, small): "Attach to Apocalypse and heal 5 (per-hero icon) damage from him. He cannot take damage while a PRELATE minion is in play." Spec §1.14 and §1.22.',
      textReplace: { find: "hit points from him", replace: "damage from him" },
    },
    {
      code: "45140",
      reason: 'MarvelCDB reads "deal Gladiator by yourself" in the Boost; the card prints "to yourself".',
      evidence:
        'Scan 45140.png: "Boost: If Trial by Combat is in play, deal Gladiator to yourself as a facedown encounter card." Spec §1.22.',
      textReplace: { find: "deal Gladiator by yourself", replace: "deal Gladiator to yourself" },
    },
    {
      code: "45125",
      reason: 'MarvelCDB reads "an additional boost card for this attacks"; the card prints "for this attack".',
      evidence:
        'Scan 45125.png: "When Revealed (Hero): Dark Beast attacks you. Give him an additional boost card for this attack." Spec §1.22.',
      textReplace: { find: "boost card for this attacks.", replace: "boost card for this attack." },
    },
    {
      code: "45124",
      reason:
        'Cruel Experiment prints no "Attach to" sentence: it attaches itself from its own When Revealed. Without the field the normalizer reports an attachment with no attach rule and builds no card. Never applied to text.',
      evidence:
        'Scan 45124.png: text box is "Attached minion gets +2 hit points and gains guard." and "When Revealed: Discard cards from the top of the encounter deck until you discard a minion. Reveal that minion and attach Cruel Experiment to it."; stat boxes +1 SCH and +1 ATK; Condition trait. FFG ruling February 20, 2026 - Ruling 4 (an attachment without "attach to" text attaches when its When Revealed triggers; corrects RRG 1.8 "Reveal", p. 38). Spec §3.25.',
      impliedAttachHost: "ownWhenRevealed",
    },
    {
      code: "45171a",
      reason:
        "Mission Team, a campaign support that is put into play by the campaign instructions, prints no cost box; MarvelCDB sends no cost.",
      evidence:
        'Scan 45171a.png: support, Mission trait, no cost oval; footer "BASIC / CAMPAIGN 171A". Survey §4.6 (scan checked).',
      specialCost: "dash",
    },
    {
      code: "45179a",
      reason:
        "Mister Sinister's Overseer face prints a dash for both ATK and SCH; MarvelCDB sends neither, which reads the same as a printed 0.",
      evidence:
        'Scan 45179a.png: both stat badges empty. Spec §1.25: the ten dashes emit null (RRG 1.8 "Dash (Value)", p. 15).',
      dashedMinionStats: ["atk", "sch"],
    },
    {
      code: "45180a",
      reason:
        "The Shadow King's Overseer face prints a dash for both ATK and SCH; MarvelCDB sends neither, which reads the same as a printed 0.",
      evidence:
        'Scan 45180a.png: both stat badges empty. Spec §1.25: the ten dashes emit null (RRG 1.8 "Dash (Value)", p. 15).',
      dashedMinionStats: ["atk", "sch"],
    },
    {
      code: "45181a",
      reason:
        "Abyss's Overseer face prints a dash for both ATK and SCH; MarvelCDB sends neither, which reads the same as a printed 0.",
      evidence:
        'Scan 45181a.png: both stat badges empty. Spec §1.25: the ten dashes emit null (RRG 1.8 "Dash (Value)", p. 15).',
      dashedMinionStats: ["atk", "sch"],
    },
    {
      code: "45182a",
      reason:
        "Sugar Man's Overseer face prints a dash for both ATK and SCH; MarvelCDB sends neither, which reads the same as a printed 0.",
      evidence:
        'Scan 45182a.png: both stat badges empty. Spec §1.25: the ten dashes emit null (RRG 1.8 "Dash (Value)", p. 15).',
      dashedMinionStats: ["atk", "sch"],
    },
    {
      code: "45183a",
      reason:
        "Mikhail Rasputin's Overseer face prints a dash for both ATK and SCH; MarvelCDB sends neither, which reads the same as a printed 0.",
      evidence:
        'Scan 45183a.png: both stat badges empty. Spec §1.25: the ten dashes emit null (RRG 1.8 "Dash (Value)", p. 15).',
      dashedMinionStats: ["atk", "sch"],
    },
  ],

  addedRecords: [
    {
      record: TOWERING_CITADEL,
      reason:
        "MarvelCDB has no record of box card 104's real back, The Towering Citadel (survey gap 8). Both faces read APOCALYPSE (4/15): one physical card.",
      evidence:
        "Scan 45104b.png (owner's scan, 2026-10-07; docs/phase7-wave8-handoff.md 'Heart of the Empire's two sides'): SIDE SCHEME, base threat 3 with no per-player icon, two acceleration icons, no traits, footer APOCALYPSE (4/15) 104B. Text: 'Threat cannot be removed from this scheme while a PRELATE minion is in play. When Defeated: The first player reveals a random set-aside PRELATE minion. Deal each other player an encounter card. Reveal The Tyrant's Throne side scheme and remove this card from the game.' Art: the scan itself, as /bundles/cards/45104b.png (a local file the client resolves, never wired into the data).",
    },
  ],

  linkOverrides: [
    {
      front: "45104a",
      back: "45104b",
      reason:
        "MarvelCDB links 45104a to 45105b No Longer Worthy, which is the back of 45105a The Tyrant's Throne; 45105b was emitted twice. The real back is 45104b.",
      evidence:
        "Scans 45104a.png and 45104b.png (both footers APOCALYPSE (4/15), 104A and 104B); docs/phase7-wave8-handoff.md 'Heart of the Empire's two sides' (chain: Heart of the Empire flips to The Towering Citadel, which reveals The Tyrant's Throne 45105a, whose flip reveals No Longer Worthy).",
    },
  ],

  errata: [
    {
      code: "45017",
      version: "RRG 1.8",
      changedFields: ["text"],
      note: 'Suit Up: "an upgrade that can be attached to that ally" is now "an upgrade that can be attached to an ally". MarvelCDB still carries the print. The printed "(Shuffle.)" reminder stays in the current text: the erratum lists exactly one change.',
      evidence:
        'RRG 1.8 p. 69 (Age of Apocalypse errata, SUIT UP (#17)): "Should read: Alter-Ego Action: Search your deck and discard pile for an ally and an upgrade that can be attached to an ally. Add them to your hand. (Changed “can be attached to that ally” to “can be attached to an ally”.)" The RRG line omits the italic "(Shuffle.)"; scan 45017.png prints "Alter-Ego Action: Search your deck and discard pile for an ally and an upgrade that can be attached to that ally. Add them to your hand. (Shuffle.)" with the reminder in italics.',
      currentReplace: { find: "can be attached to that ally", replace: "can be attached to an ally" },
    },
    {
      code: "45171a",
      version: "RRG 1.8",
      changedFields: ["text"],
      note: 'Mission Team, first bullet: "this phase" was added by the erratum ("Reduce the cost of the next ally played to the mission this phase by 2."). MarvelCDB carries the current wording (its own errata field says "Added this phase. (RRG 1.6)"), so the printed text is reconstructed by dropping it.',
      evidence:
        'RRG 1.8 p. 69 (MISSION TEAM (#171A)): "The first bullet should read: Reduce the cost of the next ally played to the mission this phase by 2. (Added this phase.)" Scan 45171a.png prints "Reduce the cost of the next ally played to the mission by 2." (no "this phase").',
      printedReplace: { find: "to the mission this phase by 2", replace: "to the mission by 2" },
    },
  ],

  // Survey §8 step 11 writes the rest. Mission Response (spec §1.25) is a Forced Response that resolves only after a
  // player discards cards from the top of their deck during a mission attempt (MC45 p. 5).
  scriptingNotes: {
    "45180a.the-shadow-king-forced-response": "answers the discard of a mission attempt only (spec §3.38).",
    "45181a.abyss-forced-response": "answers the discard of a mission attempt only (spec §3.38).",
    "45182a.sugar-man-forced-response": "answers the discard of a mission attempt only (spec §3.38).",
    "45183a.mikhail-rasputin-forced-response": "answers the discard of a mission attempt only (spec §3.38).",
  },

  cardNotes: {
    "45171a":
      "Mission Team prints no cost box (scan 45171a.png): a dash cost, 'specialCost: dash'. It is put into play by the campaign instructions, never played from a hand.",
    "45179a":
      "Mister Sinister's Overseer face prints a dash for both SCH and ATK (scan 45179a.png, HP 5 per hero, Victory 5): it never schedules or attacks. Both stats emit null (spec §1.25), not 0.",
    "45180a":
      "The Shadow King's Overseer face prints a dash for both SCH and ATK (scan 45180a.png, HP 5 per hero, Victory 5): it never schedules or attacks. Both stats emit null (spec §1.25), not 0.",
    "45181a":
      "Abyss's Overseer face prints a dash for both SCH and ATK (scan 45181a.png, HP 5 per hero, Victory 5): it never schedules or attacks. Both stats emit null (spec §1.25), not 0.",
    "45182a":
      "Sugar Man's Overseer face prints a dash for both SCH and ATK (scan 45182a.png, HP 5 per hero, Victory 5): it never schedules or attacks. Both stats emit null (spec §1.25), not 0.",
    "45183a":
      "Mikhail Rasputin's Overseer face prints a dash for both SCH and ATK (scan 45183a.png, HP 5 per hero, Victory 5): it never schedules or attacks. Both stats emit null (spec §1.25), not 0.",
    "45166b":
      "Liberate the Seattle Core, Finished face: the card prints a dash for its threat (spec §1.24). Emitted as startingThreat fixed(0); the engine never reads it, because nothing places threat here and the face does not outlast its own Forced Response.",
    "45167b":
      "Evacuate Survivors, Finished face: the card prints a dash for its threat (spec §1.24). Emitted as startingThreat fixed(0); the engine never reads it, because nothing places threat here and the face does not outlast its own Forced Response.",
    "45168b":
      "Sabotage the Sea Wall, Finished face: the card prints a dash for its threat (spec §1.24). Emitted as startingThreat fixed(0); the engine never reads it, because nothing places threat here and the face does not outlast its own Forced Response.",
    "45169b":
      "Find Lost Mutants, Finished face: the card prints a dash for its threat (spec §1.24). Emitted as startingThreat fixed(0); the engine never reads it, because nothing places threat here and the face does not outlast its own Forced Response.",
    "45170b":
      "Protect the Professor, Finished face: the card prints a dash for its threat (spec §1.24). Emitted as startingThreat fixed(0); the engine never reads it, because nothing places threat here and the face does not outlast its own Forced Response.",
  },

  // The three-sided Apocalypse (docs/phase7-wave8.md section 1.17): raw files each stage as 4518Na (Biomorph) linked
  // to the hidden 4518Nb (Cyberpath), and the default reads the top-level record as side B. The Biomorph faces are the
  // ones he starts on (45147a Setup, `startingSide: "A"`), so the top-level record is the printed side A.
  villainFrontIsSideA: ["en_sabah_nur"],

  scenarios: [
    {
      id: "unus",
      name: "Unus",
      villainSetCode: "unus",
      // 45062a Contents: "Unus, Infinites, and Standard sets"; MC45 p. 8: Infinites "is required when playing Unus".
      // Gene Pool (45071, Permanent and Setup) is put into play by the setup keyword, not by a set-aside list.
      additionalEncounterSetCodes: ["infinites"],
      recommendedModularSetCodes: ["dystopian_nightmare"],
      standardSetCodes: ["standard"],
      expertSetCodes: ["expert"],
      villainStages: { standard: [1, 2], expert: [2, 3] },
      modularSetCount: 1,
      // Q10 = A: Standard III may replace the Standard set on any scenario, so it is not a property of this record.
      // Q1 = A: the Gene Pool modular difficulty (MC45 p. 8) is a setup control, not data here.
      evidence:
        'MC45 p. 8 and 45062a Contents: "Unus, Infinites, and Standard sets. One modular set (Dystopian Nightmare)." Villain deck Unus I and II (II and III in expert mode, 45059 to 45061). Infinites is required here but may be used in other scenarios; Dystopian Nightmare can be removed. Expert set per RRG 1.8 Expert Mode, p. 28 (no 1A names it).',
    },
    {
      id: "four-horsemen",
      name: "Four Horsemen",
      villainSetCode: "four_horsemen",
      // Each Horseman prints a side A (45081a to 45084a) and a side B (45081b to 45084b) of the same title; the
      // normalizer files each face as its own one-stage card (the Mansion Attack shape), so `villainCardCodes` names
      // the four A faces and `sideBCardCodes` the four B faces, parallel, individually addressable (Q9 = B: a
      // per-villain A/B choice defaulting to A for skirmish and standard, B for expert and heroic, no "extreme" mode).
      villainCardCode: "45081a",
      multipleVillains: {
        villainSetCodes: ["four_horsemen", "four_horsemen", "four_horsemen", "four_horsemen"],
        villainCardCodes: ["45081a", "45082a", "45083a", "45084a"],
        sideBCardCodes: ["45081b", "45082b", "45083b", "45084b"],
        encounterDecks: "shared",
        // 45085a Setup shuffles the four villains and reveals them in a row: they start set aside.
        atSetup: "setAside",
      },
      recommendedModularSetCodes: ["dystopian_nightmare", "hounds"],
      standardSetCodes: ["standard"],
      expertSetCodes: ["expert"],
      // Each face is a one-stage card numbered by its position (A = 1, B = 2). The A or B face is chosen per villain
      // (Q9 = B), defaulting from the difficulty: A for skirmish and standard, B for expert and heroic.
      villainStages: { standard: [1, 1], expert: [2, 2] },
      modularSetCount: 2,
      evidence:
        'MC45 pp. 11 to 12 and 45085a Contents: "Four Horsemen, Standard, and two modular sets (Dystopian Nightmare and Hounds)." MC45 p. 11: "To play the scenario in skirmish or standard mode, use each villain\'s side A. To play the scenario in expert or heroic mode, use each villain\'s side B." Hounds and Dystopian Nightmare can be removed. Setup: shuffle the four Horsemen, reveal them in a row, active counter on the leftmost, each player reveals a random Four Horsemen side scheme (45086 to 45089). Winning needs all four defeated (winCondition allVillainsDefeated).',
    },
    {
      id: "apocalypse",
      name: "Apocalypse",
      villainSetCode: "apocalypse",
      additionalEncounterSetCodes: ["prelates"],
      // 45103a Setup: "Set aside each unused villain card, each [PRELATE] minion, and The Tyrant\'s Throne side
      // scheme." The five Prelates (b faces of the Overseers) and 45105a. In a campaign game one Prelate may already be
      // out with its Overseer (Q21, default A: four set aside); that is the campaign builder's, not this record's.
      setAsideCardCodes: ["45179b", "45180b", "45181b", "45182b", "45183b", "45105a"],
      recommendedModularSetCodes: ["dark_riders", "infinites"],
      standardSetCodes: ["standard"],
      expertSetCodes: ["expert"],
      // Stages are positions in one four-stage chain over two cards (45101a/b I and II, 45102a/b III and IV). Standard
      // starts at II and expert at III; the easier start at I is a setup option, not scenario data (Q12, default A: off unless chosen).
      villainStages: { standard: [2, 4], expert: [3, 4] },
      // No stage is reached by defeating the one before; Apocalypse falls to No Longer Worthy (45105b) alone.
      victory: "cardAbility",
      modularSetCount: 2,
      evidence:
        'MC45 p. 14 and 45103a Contents: "Apocalypse, Prelates, and Standard sets. Two modular sets (Dark Riders and Infinites)." "Contents: Apocalypse (II) and Apocalypse (III). (Apocalypse (III) only for expert mode.)" MC45 p. 14: "Remove Apocalypse (II) and start with Apocalypse (III) for expert mode. For an easier game, begin with Apocalypse (I)." Dark Riders and Infinites can be removed. Win by No Longer Worthy (45105b), a card ability.',
    },
    {
      id: "dark-beast",
      name: "Dark Beast",
      villainSetCode: "dark_beast",
      additionalEncounterSetCodes: ["savage_land", "genosha", "blue_moon"],
      // 45121a Setup: "Set the Blue Moon, Genosha, and Savage Land sets aside (including each environment card in
      // those sets)." Every card of the three sets, as Mister Sinister sets its three sets aside.
      setAsideCardCodes: [
        "45127",
        "45128",
        "45129",
        "45130",
        "45131",
        "45132",
        "45133",
        "45134",
        "45135",
        "45136",
        "45137",
        "45138",
        "45139",
        "45140",
        "45141",
        "45142",
        "45143",
        "45144",
        "45145",
        "45146",
      ],
      recommendedModularSetCodes: ["dystopian_nightmare"],
      standardSetCodes: ["standard"],
      expertSetCodes: ["expert"],
      villainStages: { standard: [1, 2], expert: [2, 3] },
      modularSetCount: 1,
      evidence:
        'MC45 p. 16 and 45121a Contents: "Dark Beast, Blue Moon, Genosha, Savage Land, and Standard sets. One modular set (Dystopian Nightmare)." Villain deck Dark Beast I and II (II and III in expert mode, 45118 to 45120). Blue Moon, Genosha and Savage Land are required here but may be used in other scenarios; Dystopian Nightmare can be removed. Dark Beast\'s When Revealed reveals a random set-aside environment (a card ability, docs/phase7-wave8.md section 2.8).',
    },
    {
      id: "en-sabah-nur",
      name: "En Sabah Nur",
      villainSetCode: "en_sabah_nur",
      recommendedModularSetCodes: ["celestial_tech", "clan_akkaba"],
      standardSetCodes: ["standard"],
      expertSetCodes: ["expert"],
      // Apocalypse is three-sided (45184 to 45186 a/b/c): one villain card per stage, the form a side of it.
      villainStages: { standard: [1, 2], expert: [2, 3] },
      modularSetCount: 2,
      evidence:
        'MC45 p. 19 and 45147a Contents: "En Sabah Nur and Standard sets. Two modular sets (Celestial Tech and Clan Akkaba)." The main scheme deck is En Sabah Nur\'s Pyramid (45147) and The Rise of Apocalypse (45148). Apocalypse I and II (II and III in expert mode) in Biomorph form (startingSide, a card ability). Celestial Tech and Clan Akkaba can be removed; Ancient Ritual (Clan Akkaba) is Permanent and Setup.',
    },
  ],

  // MC45 p. 22 (survey §8 step 6). Each title and quantity was read from the PDF page and matched to
  // raw/marvelcdb/aoa.json by name within the hero's own cards; every printed quantity equals the raw `quantity` and
  // deck limit. The page lists no permanent or set-aside card for either hero.
  starterDecks: [
    {
      id: "bishop-leadership",
      name: "Bishop / Leadership",
      identityCode: "45001a",
      aspect: "leadership",
      cards: {
        "45002": 1, // Malcolm
        "45003": 1, // Randall
        "45004": 1, // Bishop's Rifle
        "45005": 1, // Bishop's Uniform
        "45006": 2, // Super-Charged
        "45007": 2, // Concussive Blast
        "45008": 2, // Command Authority
        "45009": 2, // Energy Conversion
        "45010": 3, // Stored Energy
        "45011": 1, // Cable
        "45012": 1, // X-23
        "45013": 3, // Team Training
        "45014": 3, // Advanced Suit
        "45015": 1, // Sidekick
        "45016": 3, // Side-by-Side
        "45017": 3, // Suit Up
        "45018": 3, // Lead from the Front
        "45019": 2, // The Power of Leadership
        "45020": 1, // Legion
        "45021": 1, // Marrow
        "45022": 1, // Energy
        "45023": 1, // Genius
        "45024": 1, // Strength
      },
      obligationCode: "45025",
      nemesisCodes: ["45026", "45027", "45028", "45029"],
      verified: true,
      sources: ['MC45 p. 22 (docs/campaign-modes/mc45_age_of_apocalypse_rulebook.pdf, "BISHOP / LEADERSHIP")'],
      note: "40 cards (identity, obligation and nemesis set excluded): 15 Bishop, 20 Leadership, 5 basic. MC45 p. 22 lists titles and quantities, not codes; each was matched to raw/marvelcdb/aoa.json by name and card_set_code (bishop/basic) or faction_code, and every quantity equals the raw printed quantity.",
    },
    {
      id: "magik-aggression",
      name: "Magik / Aggression",
      identityCode: "45030a",
      aspect: "aggression",
      cards: {
        "45031": 1, // Colossus
        "45032": 1, // Limbo
        "45033": 1, // Magik's Crown
        "45034": 1, // Soulsword
        "45035": 1, // Mystical Armor
        "45036": 1, // Scrying
        "45037": 3, // Stepping Disc
        "45038": 2, // Exorcism
        "45039": 2, // Soul Strike
        "45040": 2, // Magic Barrier
        "45041": 1, // Goldballs
        "45042": 1, // Tempus
        "45043": 3, // Blood Rage
        "45044": 3, // Test the Defense
        "45045": 3, // Full-Body Charge
        "45046": 3, // Clobber
        "45047": 2, // The Power of Aggression
        "45048": 1, // Triage
        "45049": 1, // Stepford Cuckoos
        "45050": 1, // Bloodgem
        "45051": 3, // Basic Spell
        "45052": 3, // Spiritual Meditation
      },
      obligationCode: "45053",
      nemesisCodes: ["45054", "45055", "45056", "45057", "45058"],
      verified: true,
      sources: ['MC45 p. 22 (docs/campaign-modes/mc45_age_of_apocalypse_rulebook.pdf, "MAGIK / AGGRESSION")'],
      note: "40 cards (identity, obligation and nemesis set excluded): 15 Magik, 16 Aggression, 9 basic. MC45 p. 22 lists titles and quantities, not codes; each was matched to raw/marvelcdb/aoa.json by name and card_set_code (magik/basic) or faction_code, and every quantity equals the raw printed quantity.",
    },
  ],

  // Survey gap 11: campaign-specific sets whose cards carry the `encounter` faction, so they are not detected from
  // the faction the way `aoa_basic_campaign` (faction `campaign`) is. Rulebook MC45 pp. 3 to 5 and 14 (the survey's
  // §4.5): the mission, Overseer and campaign cards are used only in campaign mode.
  encounterSets: {
    aoa_mission: { campaignSpecific: true },
    aoa_campaign: { campaignSpecific: true },
    age_of_apocalypse: { campaignSpecific: true },
    overseer: { campaignSpecific: true },
  },
};
