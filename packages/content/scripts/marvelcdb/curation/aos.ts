/**
 * Agents of S.H.I.E.L.D. (MC50, cycle 9 campaign box) curation: the box's 195 top-level records (Maria Hill and Nick
 * Fury's hero kits, the five scenarios' encounter cards, the modular sets and the nine evidence cards), the five
 * scenarios and the two starter decks. `handAuthoredModules` lists the hand-authored files next to the emitted
 * data (`evidence.ts`, `thunderbolts.ts`); the campaign record is `campaign.ts` (docs/phase7-wave9-data-survey.md section 11).
 *
 * Evidence abbreviations: "scan" is `assets/card-art/bundles/cards/<code>.png` (gitignored, read directly, never wired
 * into the data), "rulebook" is docs/campaign-modes/markdown/mc50_agents_of_shield.md (page numbers are the printed
 * rulebook pages), "RRG" is the v1.8 rules reference, "survey" is docs/phase7-wave9-data-survey.md.
 */
import { traitOf } from "../normalize/brand.ts";
import type { EvidenceColor } from "../../../src/schema/index.ts";
import type { Correction, PackCuration } from "./types.ts";

/** One "Attack to Black Widow." typo (MarvelCDB) for "Attach to Black Widow." */
const attachTypo = (code: string, title: string): Correction => ({
  code,
  reason: `MarvelCDB reads "Attack to Black Widow." on ${title}; the card prints "Attach to Black Widow." Without the fix the normalizer finds no attach rule.`,
  evidence: `Survey section 4.5 (raw text; the only attachment sentence of the card is the host line). Scan ${code}.png is the card with the Preparation line "Attach this card to Black Widow."`,
  textReplace: { find: "Attack to Black Widow.", replace: "Attach to Black Widow." },
});

/** A card with no printed cost box (a dash cost): MarvelCDB sends no `cost`. */
const dashCost = (code: string, title: string, why: string): Correction => ({
  code,
  reason: `${title} prints a dash cost (${why}); MarvelCDB sends no cost, which the normalizer rejects as a missing value.`,
  evidence: `Survey section 4.2 (scratch run: "without a cost"). Scan ${code}.png: no cost badge. RRG 1.8 "Dash (Value)", p. 15.`,
  specialCost: "dash",
});

/** One evidence card's printed icon and art color (MarvelCDB records neither), read from the scan. */
const evidence = (
  code: string,
  title: string,
  icon: string,
  color: EvidenceColor,
  looks: string,
  grid: string,
): Correction => ({
  code,
  reason: `${title} prints ${looks} on ${color} art; MarvelCDB records no icon or color, and the campaign log's combination grid is crossed off by the icon (MC50 p. 18 and p. 24).`,
  evidence: `Scan ${code}.png (read 2026-10-10): ${looks}, ${color} background. Rulebook p. 24 (campaign log, rendered at 200 dpi): the grid column for this card shows the same icon on the same color${grid}. Spec docs/phase7-wave9.md section 1.16 item 2.`,
  evidenceIcon: { icon, color },
});

/** A card whose own text defines a counter type with no `uses` keyword. */
const counterType = (code: string, title: string, type: string, quote: string): Correction => ({
  code,
  reason: `${title} defines the "${type}" counter type in its own text (${quote}) with no Uses keyword; the card needs the type so a moved counter becomes a ${type} counter (RRG 1.8 "All-Purpose Counter", p. 6).`,
  evidence: `Card text (MarvelCDB raw, and the scan ${code}.png where read). Spec docs/phase7-wave9.md section 1.6 and 1.16 item 4: the record instructions name the counter by this key.`,
  definedCounterTypes: [type],
});

// Every set with an Elite, Thunderbolt minion: the box's six (MC50 p. 15 lists "the following sets in this product") and
// the four hero packs' (Black Panther, Silk, Falcon & Winter Soldier). 50130a prints no list, only the criterion;
// `AOS_THUNDERBOLT_POOL_SET_IDS` derives the same ten from the trait and a test pins the two together.
const ELITE_THUNDERBOLT_SETS = [
  "gravitational_pull",
  "hard_sound",
  "pale_little_spider",
  "power_of_the_atom",
  "supersonic",
  "the_leaper",
  "extreme_risk",
  "growing_strong",
  "techno",
  "whiteout",
];

export const AOS_CURATION: PackCuration = {
  packCode: "aos",
  cycle: { id: "cycle9", name: "Agents of S.H.I.E.L.D.", order: 9 },
  pack: {
    name: "Agents of S.H.I.E.L.D.",
    releaseDate: "2025-03-07",
    releaseDateSource:
      'Hall of Heroes Agents of S.H.I.E.L.D. page (https://hallofheroeslcg.com/agents-of-shield/): "Release date: March 7, 2025"',
  },
  outDir: "src/data/aos",
  exportPrefix: "AOS",
  // MarvelCDB has no campaign record: `campaign.ts` (`AOS_CAMPAIGN`) is hand-authored in a later step (survey section
  // 11 step 4). Ingest refuses a named module whose file is missing, so it is not listed here yet.
  handAuthoredModules: ["evidence", "thunderbolts"],

  corrections: [
    dashCost("50035a", "Assault / Stealth (Nick Fury's suit form)", "a Permanent upgrade that starts in play"),
    dashCost("50091", "Rescued Captive", "an ally put into play by a card effect"),
    dashCost("50105b", "Flying Inhuman", "the back of a Holding Cell card, put into play by an effect"),
    dashCost(
      "50106b",
      "Inhuman ally (Holding Cell back)",
      "the back of a Holding Cell card, put into play by an effect",
    ),
    dashCost(
      "50107b",
      "Inhuman ally (Holding Cell back)",
      "the back of a Holding Cell card, put into play by an effect",
    ),
    dashCost(
      "50108b",
      "Inhuman ally (Holding Cell back)",
      "the back of a Holding Cell card, put into play by an effect",
    ),
    {
      code: "50083",
      reason:
        "MarvelCDB sends `scheme_acceleration: 1` for the A.I.M. Scientist minion; a minion has no acceleration icon and the card prints none.",
      evidence:
        "Scan 50083.png (read 2026-10-09): SCH 0, ATK 0, HP 2, no acceleration icon; text is Surge, Vulnerable and the cannot-be-attacked line. Survey section 4.2.",
      ignoreFields: ["scheme_acceleration"],
    },
    {
      code: "50153",
      reason:
        "Radiation Exposure prints a flat -1 ATK; MarvelCDB sends -1 for both attack and scheme, and the normalizer reads an attachment's -1 as a printed X unless the card is corrected.",
      evidence:
        'Scan 50153.png (read 2026-10-09): -1 SCH and -1 ATK (ATK with a reminder star); text "this attachment gives +1 ATK instead" for a Gamma identity. Survey section 4.2. The scan prints the SCH badge the RRG 1.8 erratum changes to THW (see `thwart` below and the errata entry).',
      attack: -1,
      thwart: -1,
    },
    {
      code: "50126",
      reason:
        'MarvelCDB\'s raw text reads "Victory -1. Villainous. Vulnerable."; the card prints "Victory -1. Vulnerable." Monica gains villainous only from her own text while Scientist Supreme is in the victory display.',
      evidence:
        'Scan 50126.png (read 2026-10-09): keyword line "Victory -1. Vulnerable. (Discard this character if it is stunned or confused.)", then "While Scientist Supreme is in the victory display, Monica Rappaccini gains villainous." Spec docs/phase7-wave9.md section 1.14 item 2.',
      textReplace: { find: "Victory -1. Villainous. Vulnerable.", replace: "Victory -1. Vulnerable." },
    },
    {
      code: "50066",
      reason:
        "Black Widow III prints 20 hit points per player; MarvelCDB sends `health: 13` (with `health_per_hero: true`).",
      evidence:
        'Scan 50066.png (read 2026-10-09): bottom bar "BLACK WIDOW (3/23) / HIT POINTS 20" followed by the per player icon; SCH 3, ATK 2. Spec docs/phase7-wave9.md section 1.14 item 1.',
      hitPoints: 20,
    },
    {
      code: "50056",
      reason: 'MarvelCDB reads "search you deck" in Leo Fitz\'s Alter-Ego Action; the card prints "search your deck".',
      evidence:
        'Scan 50056.png (read 2026-10-09): "Alter-Ego Action: Exhaust Leo Fitz -> search your deck for a Tech card and add it to your hand. (Shuffle.)". Spec docs/phase7-wave9.md section 1.14 item 6.',
      textReplace: { find: "search you deck", replace: "search your deck" },
    },
    {
      code: "50019",
      reason: 'MarvelCDB reads "operational counter" in The Douglass\'s Action; the card prints "operation counter".',
      evidence:
        'Scan 50019.png (read 2026-10-09): "Uses (3 operation counters). Action: Exhaust The Douglass and remove 1 operation counter from it -> remove 2 threat from each scheme..." Spec docs/phase7-wave9.md section 1.14 item 6.',
      textReplace: { find: "operational counter", replace: "operation counter" },
    },
    {
      code: "50108b",
      reason:
        'MarvelCDB labels the Strong Inhuman trigger "Forced Interrupt: After this card leaves play"; the card prints "Forced Response", like the other three Inhuman allies.',
      evidence:
        'Scan 50108b.png (read 2026-10-09): "Forced Response: After this card leaves play, flip it and place it on the bottom of the Holding Cell deck." Spec docs/phase7-wave9.md section 1.14 item 7. The trigger word is "After" either way.',
      textReplace: { find: "Forced Interrupt: After this card", replace: "Forced Response: After this card" },
    },
    attachTypo("50068", "Black Widow's Gauntlet"),
    attachTypo("50069", "Grappling Hook"),
    attachTypo("50070", "Night Vision Goggles"),
    {
      code: "50171",
      reason:
        'Reluctant Foe prints no "Attach to" sentence: it attaches itself from its own When Revealed ("Attach this card to it."). Without the field the normalizer reports an attachment with no attach rule. Never applied to text.',
      evidence:
        "Raw text and scan 50171.png. FFG ruling February 20, 2026 (4) (an attachment without 'attach to' text attaches when its When Revealed triggers; RRG 1.8 'Reveal', p. 38). The out-of-game hero becoming a minion is an engine concern (survey S9, S10).",
      impliedAttachHost: "ownWhenRevealed",
    },
    {
      code: "50168b",
      reason:
        "The Accusation 2B prints dashes for starting threat, target threat and acceleration; MarvelCDB sends nothing for all three.",
      evidence: "Survey section 4.2 ('scan checked: dash badge, no numbers'). RRG 1.8 'Dash (Value)', p. 15.",
      dashedThreatFields: ["startingThreat", "targetThreat", "acceleration"],
    },
    {
      code: "50193",
      reason: 'MarvelCDB reads "Aggresion" twice in Authority\'s Setup; the card prints "Aggression".',
      evidence:
        'Scan 50193.png (read 2026-10-09): "...search their collection for a different Aggression support and shuffle it into their deck. Each player may add 1 threat to the main scheme to search their deck for an Aggression support..." Survey section 4.3. One replace spans both occurrences because a `textReplace.find` must match exactly once.',
      textReplace: {
        find: "Aggresion support and shuffle it into their deck. Each player may add 1 threat to the main scheme to search their deck for an Aggresion support",
        replace:
          "Aggression support and shuffle it into their deck. Each player may add 1 threat to the main scheme to search their deck for an Aggression support",
      },
    },
    {
      code: "50087a",
      reason: `MarvelCDB reads "Batrocs's Brigade" in the Contents line; the encounter set is Batroc's Brigade.`,
      evidence:
        'Survey section 4.5 (raw typo; the possessive "Batroc\'s" is the set name `batrocs_brigade` / "Batroc\'s Brigade"). The scan 50087a.png is a main scheme side with the same line.',
      textReplace: { find: "Batrocs's Brigade", replace: "Batroc's Brigade" },
    },
    {
      code: "50180",
      reason:
        'MarvelCDB sends `traits: "S.H.I.E.L.D."` for Disavowed; it took the encounter set name (the footer "S.H.I.E.L.D. (5/5)") for a trait. The card prints no trait line, and its own text counts each S.H.I.E.L.D. card in play, so a wrong trait would count the scheme itself.',
      evidence:
        "Scan 50180.png (read 2026-10-09): the text box runs from the italic flavor text straight to the rules text with no bold italic trait line; the only S.H.I.E.L.D. outside the rules text is the set footer. Arrest Warrant 50179 does print a S.H.I.E.L.D. trait line (scan 50179.png), which is why the raw data differs between the two.",
      traits: [],
    },
    evidence("50185", "Medical Records", "folder", "orange", "a folder marked with a caduceus", ""),
    evidence(
      "50186",
      "Wiretap",
      "phone",
      "blue",
      "a phone with a call-and-signal glyph",
      " (blue, like 50186: told apart by icon)",
    ),
    evidence("50187", "Security Scanner", "scanner", "pink", "a fingerprint scanner", ""),
    evidence("50188", "Money", "dollar", "green", "a dollar sign", ""),
    evidence("50189", "Blackmail", "handshake", "black", "a handshake in a frame", ""),
    evidence("50190", "Ideology", "flame", "yellow", "a flame", ""),
    evidence("50191", "Security Clearance", "badge", "purple", "an ID badge", ""),
    evidence("50192", "Travel", "pin", "red", "a map pin", ""),
    evidence("50193", "Authority", "shield", "blue", "a shield with a star", " (blue, like 50186: told apart by icon)"),
    counterType("50105a", "Holding Cell (Flying)", "lock", '"Enters play with 2[per_hero] lock counters on it"'),
    counterType("50106a", "Holding Cell (Psionic)", "lock", '"Enters play with 2[per_hero] lock counters on it"'),
    counterType("50107a", "Holding Cell (Sarah Garza)", "lock", '"Enters play with 2[per_hero] lock counters on it"'),
    counterType("50108a", "Holding Cell (Strong)", "lock", '"Enters play with 2[per_hero] lock counters on it"'),
    counterType("50181a", "Chief Medical Officer", "secret", '"secret counters here"'),
    counterType(
      "50181b",
      "Chief Medical Officer (Board Member attachment side)",
      "secret",
      '"After a secret counter is placed here"',
    ),
    counterType("50182a", "Chief Surveillance Officer", "secret", '"secret counters here"'),
    counterType(
      "50182b",
      "Chief Surveillance Officer (Board Member attachment side)",
      "secret",
      '"After a secret counter is placed here"',
    ),
    counterType("50183a", "Chief Tactical Officer", "secret", '"secret counters here"'),
    counterType(
      "50183b",
      "Chief Tactical Officer (Board Member attachment side)",
      "secret",
      '"After a secret counter is placed here"',
    ),
  ],

  encounterSets: {
    // Set title: scans 50103a/b, 50104a/b and 50108b print "M.O.D.O.K." (the box's own title "M.O.D.O.K." with the last
    // period); MarvelCDB's `card_set_name` drops it. Spec docs/phase7-wave9.md section 1.14 item 6.
    "m.o.d.o.k.": { name: "M.O.D.O.K." },
  },

  errata: [
    {
      code: "50153",
      version: "RRG 1.8",
      changedFields: ["statModifiers"],
      note: 'Radiation Exposure: the "SCH" modifier on the card is now a "THW" modifier. The print is -1 SCH; the current card is -1 THW. The emitted modifier is the current one.',
      evidence:
        'RRG 1.8, Agents of S.H.I.E.L.D. Expansion errata (mc_rulesreference_v18_compressed.md line 5124): "RADIATION EXPOSURE (#171A) The "SCH" modifier on this card should be a "THW" modifier." The RRG prints the number as #171A although the box card is 153 (Power of the Atom 2/6, scan 50153.png); the title and the SCH badge match.',
    },
    {
      code: "50156",
      version: "RRG 1.8",
      changedFields: ["text"],
      note: 'MACH-IV: "make basic defenses against" became "defend against".',
      evidence:
        'RRG 1.8, mc_rulesreference_v18_compressed.md lines 5128 to 5134: "MACH-IV (#156)" is followed, after the X-23 Hero Pack heading, by "Should read: Each character without the Aerial trait cannot defend against MACH-IV\'s attacks. (Changed "make basic defenses" to "defend".)". The markdown interleaves the MACH-IV entry with X-23\'s Front Line Specialist (#36) heading; the quoted sentence names MACH-IV, so it belongs to #156. Raw text is the print.',
      currentReplace: { find: "make basic defenses against", replace: "defend against" },
    },
  ],

  // Maria Hill 50001b: "You may include the maximum number of copies of 3 S.H.I.E.L.D. supports in your deck from aspects
  // other than your chosen aspect." RRG 1.8 FAQ "Maria Hill (#1B)" (p. 64): exactly three titles at their maximum copies, or none.
  // Keyed by the hero face's code, as `gam` does.
  identityDeckbuilding: {
    "50001a": { offAspectPackages: [{ cardType: "support", trait: traitOf("S.H.I.E.L.D."), titles: 3 }] },
  },

  scriptingNotes: {},
  cardNotes: {
    "50119":
      "Reverse Engineering prints +X SCH and +X ATK (scan 50119.png; MarvelCDB's -1 is its X marker, not a negative modifier). Text: X is the printed cost of the card tucked here. The When Revealed tuck and the Forced Response discard are scripting.",
  },

  scenarios: [
    {
      id: "black-widow",
      name: "Black Widow",
      villainSetCode: "black_widow_villain",
      // 50067a Contents: "Black Widow and Standard encounter sets. Two modular encounter sets (A.I.M. Abduction and A.I.M. Science)."
      recommendedModularSetCodes: ["a.i.m._abduction", "a.i.m._science"],
      standardSetCodes: ["standard"],
      expertSetCodes: ["expert"],
      // Black Widow (I) and (II); expert removes (I) and adds (III) (MC50 p. 9).
      villainStages: { standard: [1, 2], expert: [2, 3] },
      modularSetCount: 2,
      evidence:
        'MC50 p. 9 and 50067a Contents: "Villain Deck: Black Widow (I), Black Widow (II). Remove Black Widow (I) and add Black Widow (III) for expert mode. Main Scheme Deck: The Widow\'s Web. Encounter Deck: Black Widow, A.I.M. Abduction, A.I.M. Science, and Standard encounter sets." A.I.M. Abduction and A.I.M. Science can be removed from this scenario and added to others (scenario customization).',
    },
    {
      id: "batroc",
      name: "Batroc",
      villainSetCode: "batroc",
      // 50087a Contents: "Batroc and Standard encounter sets. Two modular encounter sets (A.I.M. Science and Batroc's Brigade)."
      recommendedModularSetCodes: ["a.i.m._science", "batrocs_brigade"],
      standardSetCodes: ["standard"],
      expertSetCodes: ["expert"],
      // One card, stages A and B (50086a/b): standard starts at A, expert at B ("Flip Batroc (A) to Batroc (B) for expert mode").
      villainStages: { standard: [1, 1], expert: [2, 2] },
      modularSetCount: 2,
      // The scenario is won by advancing the three main scheme stages, not by defeating Batroc (MC50 p. 11).
      victory: "cardAbility",
      evidence:
        'MC50 p. 11 and 50087a Contents: "Villain Deck: Batroc (A). Flip Batroc (A) to Batroc (B) for expert mode. Main Scheme Deck: Infiltrate A.I.M. Island Embassy, Locate Missing Person, Extract Captives. Encounter Deck: Batroc, A.I.M. Science, Batroc\'s Brigade, and Standard." "The players\' objective in this scenario is not to defeat the villain, Batroc, but instead to advance through the three stages of the main scheme" (p. 11, Infiltrating the Embassy). A.I.M. Science and Batroc\'s Brigade can be removed. Rescued Captive allies are set aside by 50087a Setup (scripting).',
    },
    {
      id: "modok",
      name: "M.O.D.O.K.",
      villainSetCode: "m.o.d.o.k.",
      // 50104a Contents: "M.O.D.O.K. and Standard encounter sets. One modular encounter set (Scientist Supreme)."
      recommendedModularSetCodes: ["scientist_supreme"],
      standardSetCodes: ["standard"],
      expertSetCodes: ["expert"],
      villainStages: { standard: [1, 1], expert: [2, 2] },
      modularSetCount: 1,
      evidence:
        'MC50 p. 13 and 50104a Contents: "Villain Deck: M.O.D.O.K. (A). Flip M.O.D.O.K. (A) to M.O.D.O.K. (B) for expert mode. Main Scheme Deck: Upgrading Adaptoids. Encounter Deck: M.O.D.O.K., Scientist Supreme, and Standard." Scientist Supreme can be removed. The Holding Cell deck and the Adaptoid environments are built by 50104a Setup (scripting). 50103a: M.O.D.O.K. is defeated only when no Holding Cell is in play.',
    },
    {
      id: "thunderbolts",
      name: "Thunderbolts",
      villainSetCode: "thunderbolts",
      standardSetCodes: ["standard"],
      expertSetCodes: ["expert"],
      // Citizen V is one card with stages A and B (50129a/b), like Batroc.
      villainStages: { standard: [1, 1], expert: [2, 2] },
      // 50130a Setup: "Choose 1 modular set, plus 1[per_hero] additional modular sets, each with an Elite, Thunderbolt minion.
      // Set each of those minions aside and shuffle the rest of their encounter sets into the encounter deck." The modular
      // choice is the Mojo shape: nothing shuffled in by the engine, 1 + 1 per hero chosen from the ten qualifying sets.
      recommendedModularSetCodes: [],
      modularSetCount: 0,
      setAsideModularSetCount: { base: 1, perPlayer: 1 },
      modularSetPool: { setCodes: ELITE_THUNDERBOLT_SETS, restricted: true },
      evidence:
        'MC50 p. 15 and 50130a Contents/Setup: "Villain Deck: Citizen V (A). Flip Citizen V (A) to Citizen V (B) for expert mode. Main Scheme Deck: Apprehending Rogue Agents. Encounter Deck: Thunderbolts and Standard. You will also need 1[per_hero] modular encounter sets, plus one additional set, each containing an Elite, Thunderbolt minion: Gravitational Pull, Hard Sound, Pale Little Spider, Power of the Atom, Supersonic, and The Leaper."',
    },
    {
      id: "baron-zemo",
      name: "Baron Zemo",
      villainSetCode: "baron_zemo",
      // 50167a Contents: the executive board and its evidence are required, not modular (MC50 p. 18).
      additionalEncounterSetCodes: ["s.h.i.e.l.d._executive_board", "executive_board_evidence"],
      recommendedModularSetCodes: ["scientist_supreme", "s.h.i.e.l.d."],
      standardSetCodes: ["standard"],
      expertSetCodes: ["expert"],
      // Baron Zemo (A1) in standard mode, (B1) in expert mode: two cards, so an `expertVillains` swap (MC50 p. 18).
      villainCardCode: "50165a",
      expertVillains: { villainCardCode: "50166a", setAsideVillainCardCodes: [] },
      villainStages: { standard: [1, 1], expert: [1, 1] },
      modularSetCount: 2,
      evidence:
        'MC50 p. 18 and 50167a Contents: "Villain Deck: Baron Zemo (A1). Remove Baron Zemo (A1) and add Baron Zemo (B1) for expert mode. Main Scheme Deck: Zemo\'s Manipulations, The Accusation, Fighting Zemo. Encounter Deck: Baron Zemo, S.H.I.E.L.D. Executive Board, Executive Board Evidence, Scientist Supreme, S.H.I.E.L.D., and Standard." Scientist Supreme and S.H.I.E.L.D. can be removed. Setup prepares the evidence and puts each Board Member environment into play (scripting).',
    },
  ],
  starterDecks: [
    {
      id: "maria-hill-leadership",
      name: "Maria Hill / Leadership",
      identityCode: "50001a",
      aspect: "leadership",
      cards: {
        "50002": 1, // Nick Fury (Maria Hill set)
        "50003": 2, // All-Points Bulletin
        "50004": 2, // On the Double
        "50005": 3, // Reinforcements
        "50006": 1, // The Hard Call
        "50007": 2, // Special Funding
        "50008": 1, // Support Staff
        "50009": 1, // The Iliad
        "50010": 1, // Life Model Decoy
        "50011": 1, // S.H.I.E.L.D. Director
        "50012": 1, // Victoria Hand
        "50013": 1, // Slingshot
        "50014": 3, // Organizational Support
        "50015": 3, // Agents of S.H.I.E.L.D.
        "50016": 3, // Command Team
        "50017": 1, // The Circe
        "50018": 1, // The Bellerophon (Aggression)
        "50019": 1, // The Douglass (Justice)
        "50020": 1, // The Pericles (Protection)
        "50021": 1, // Dum Dum Dugan
        "50022": 1, // Grant Ward
        "50023": 1, // Melinda May
        "50024": 1, // Super Spies
        "50025": 1, // Energy
        "50026": 1, // Genius
        "50027": 1, // Strength
        "50028": 3, // Front Organization
      },
      // Maria's own offAspectPackages (`identityDeckbuilding` above) admits these three S.H.I.E.L.D. supports; this list
      // only satisfies the normalizer's per-card aspect check.
      offAspectAllowanceCodes: ["50018", "50019", "50020"],
      obligationCode: "50029",
      nemesisCodes: ["50030", "50031", "50032", "50033"],
      verified: true,
      sources: [
        "MC50 rulebook p. 7 (docs/campaign-modes/markdown/mc50_agents_of_shield.md, MARIA HILL / LEADERSHIP); the printed page was rendered and read against the list by the main session on 2026-10-09 (docs/phase7-wave9-data-survey.md section 6.1)",
      ],
      note: "40 cards (identity, obligation and nemesis set excluded): 15 Maria Hill, 15 Leadership (12 Leadership plus The Bellerophon, The Douglass and The Pericles, one each in Aggression, Justice and Protection), 10 basic. The page lists titles and quantities, not codes; each was matched by name to raw/marvelcdb/aos.json. Super Spies 50024 has quantity 2 in the box; the deck uses 1 (deck limit 1).",
    },
    {
      id: "nick-fury-justice",
      name: "Nick Fury / Justice",
      identityCode: "50034a",
      aspect: "justice",
      cards: {
        "50035a": 1, // Assault / Stealth (Permanent suit form upgrade, starts in play, outside the 40)
        "50036": 1, // Maria Hill
        "50037": 2, // Concentrated Fire
        "50038": 3, // Covert Surveillance
        "50039": 2, // Spray Fire
        "50040": 1, // Fury's Flying Car
        "50041": 1, // Safe House #221
        "50042": 1, // EM Shield
        "50043": 1, // Eyepatch Camera
        "50044": 1, // Fury's Watch
        "50045": 1, // Intelligence Analysis
        "50046": 1, // Secret Agent
        "50047": 1, // Agent Coulson
        "50048": 1, // Quake
        "50049": 3, // Global Logistics
        "50050": 3, // Informant
        "50051": 3, // Intelligence
        "50052": 3, // Prism Dust
        "50053": 3, // Under Surveillance
        "50054": 1, // Nick Fury, Sr.
        "50024": 1, // Super Spies
        "50055": 1, // Jemma Simmons
        "50056": 1, // Leo Fitz
        "50057": 1, // Sky-Destroyer
        "50058": 3, // Practiced Plan
      },
      obligationCode: "50059",
      nemesisCodes: ["50060", "50061", "50062", "50063"],
      verified: true,
      sources: [
        "MC50 rulebook p. 7 (docs/campaign-modes/markdown/mc50_agents_of_shield.md, NICK FURY / JUSTICE); the printed page was rendered and read against the list by the main session on 2026-10-09 (docs/phase7-wave9-data-survey.md section 6.1)",
      ],
      note: "41 entries, 40 counted (identity, obligation and nemesis set excluded): 16 Nick Fury (including Assault / Stealth 50035a), 17 Justice, 8 basic. Assault / Stealth is his Permanent suit form upgrade: it starts in play and does not count toward the 40, listed in `cards` the way X-23's Claws (`x23` 43002, 41 entries) and Iceman's Frostbite (`iceman` 46002) are, because the normalizer requires every hero-kit card at its kit quantity. Page lists titles and quantities, not codes; matched by name to raw/marvelcdb/aos.json.",
    },
  ],
};
