/**
 * NeXt Evolution (MC40, cycle 7 campaign box) curation, pass 1: cards only. Cable and Domino hero kits, five
 * scenarios' encounter cards, the modular sets and the campaign cards 190-204, then the five scenario records and the
 * starter decks. docs/phase7-wave7.md is the working spec; the hand-authored `campaign.ts` is a later pass (docs/
 * phase7-wave7-data-survey.md §8 step 7).
 *
 * Evidence abbreviations: "scan" is `assets/card-art/bundles/cards/<code>.png` (gitignored, read directly, small
 * scans enlarged; never wired into the data), "RRG" is the v1.8 rules reference, "survey" is
 * docs/phase7-wave7-data-survey.md. The survey (`survey.ts --pack next_evol`) reported 40 lines on the bare
 * curation, all resolved below: the typos (§4.6), the 40154 type, the 40139b dashes, eight dash costs, 40130's
 * star stats and the attach hosts.
 */
import type { PackCuration } from "./types.ts";

const IDENTITY_TYPO_EVIDENCE =
  'Card scan assets/card-art/bundles/cards/%CODE%.png: "Attach to your identity." (Stryfe condition template, all four read).';

export const NEXT_EVOL_CURATION: PackCuration = {
  packCode: "next_evol",
  cycle: { id: "cycle7", name: "NeXt Evolution", order: 7 },
  pack: {
    name: "NeXt Evolution",
    releaseDate: "2023-08-18",
    releaseDateSource:
      "docs/phase7-wave7-sources.md release table (August 18, 2023; Hall of Heroes https://hallofheroeslcg.com/next-evolution/)",
  },
  outDir: "src/data/next_evol",
  exportPrefix: "NEXT_EVOL",
  // MarvelCDB has no campaign record (docs/campaign-mode-design.md §3): `campaign.ts` (`NEXT_EVOL_CAMPAIGN`) is
  // hand-authored, step 7. Ingest refuses a named module whose file is missing.
  handAuthoredModules: ["campaign"],

  corrections: [
    ...["40170", "40171", "40172", "40173"].map((code) => ({
      code,
      reason: 'MarvelCDB misspells the attach sentence as "Attach to your identify.", which the parser rejects.',
      evidence: IDENTITY_TYPO_EVIDENCE.replace("%CODE%", code),
      textReplace: { find: "Attach to your identify.", replace: "Attach to your identity." },
    })),
    {
      code: "40199",
      reason: 'MarvelCDB misspells "Treat" as "Threat" in Malice\'s When Defeated ("Threat attached ally as a ...").',
      evidence:
        'Card scan assets/card-art/bundles/cards/40199.png: "Treat attached ally as a POSSESSED minion with a blank text box (except for TRAITS)."',
      textReplace: { find: "Threat attached ally as", replace: "Treat attached ally as" },
    },
    {
      code: "40144",
      reason:
        'MarvelCDB misspells the villain as "Minister Sinister" in the attach sentence; the parser would read a named card that never matches.',
      evidence: 'Card scan assets/card-art/bundles/cards/40144.png: "Attach to Mister Sinister."',
      textReplace: { find: "Attach to Minister Sinister.", replace: "Attach to Mister Sinister." },
    },
    {
      code: "40144",
      reason: 'The same misspelling in the Forced Interrupt ("damage to Minister Sinister").',
      evidence:
        'Card scan assets/card-art/bundles/cards/40144.png: "When a player would deal damage to Mister Sinister".',
      textReplace: { find: "damage to Minister Sinister,", replace: "damage to Mister Sinister," },
    },
    {
      code: "40145",
      reason: 'MarvelCDB misspells the villain as "Minister Sinister" in the first line (the Boost line is right).',
      evidence:
        'Card scan assets/card-art/bundles/cards/40145.png: "for each SUPERPOWER attachment on Mister Sinister."',
      textReplace: { find: "attachment on Minister Sinister.", replace: "attachment on Mister Sinister." },
    },
    {
      code: "40121a",
      reason: 'MarvelCDB reads "Put Home Summers into play" in the Setup sentence; the ally is Hope Summers.',
      evidence:
        'Card scan assets/card-art/bundles/cards/40121a.png (enlarged): "Put Hope Summers into play under the first player\'s control." (40121 and 40121b carry no such sentence.)',
      textReplace: { find: "Put Home Summers", replace: "Put Hope Summers" },
    },
    {
      code: "40188",
      reason: 'MarvelCDB misspells the card\'s own name in its text ("Samarai").',
      evidence:
        'Card scan assets/card-art/bundles/cards/40188.png: "After Samurai attacks you, place 1 charge counter here."',
      textReplace: { find: "After Samarai attacks", replace: "After Samurai attacks" },
    },
    {
      code: "40130",
      reason:
        'MarvelCDB writes "Hope Summer\'s base THW and base ATK"; the card prints the possessive "Hope Summers\'s".',
      evidence:
        'Card scan assets/card-art/bundles/cards/40130.png: "Hope Summers\'s base THW and base ATK are equal to the THW and ATK of your hero."',
      textReplace: { find: "Hope Summer's base", replace: "Hope Summers's base" },
    },
    {
      code: "40130",
      reason:
        "Hope Summers (encounter-set ally, put into play by Setup) prints a dash cost; MarvelCDB sends no cost. THW and ATK are stars (cardNotes).",
      evidence: 'Card scan assets/card-art/bundles/cards/40130.png: cost oval "—", THW star, ATK star, HP 3.',
      specialCost: "dash",
    },
    {
      code: "40079",
      reason: "Morlock (encounter-set ally) prints a dash cost; MarvelCDB sends no cost.",
      evidence: 'Card scan assets/card-art/bundles/cards/40079.png: cost oval "—", THW 1, ATK 1, HP 5.',
      specialCost: "dash",
    },
    {
      code: "40037a",
      reason:
        'MarvelCDB reads "discarded from the top of the deck"; Domino prints "your deck". The icon stays [wild], as MarvelCDB has it.',
      evidence:
        'Card scan assets/card-art/bundles/cards/40037a.png (enlarged): "When counting resources on cards discarded from the top of your deck, count each printed [wild] icon twice." The icon is the wild resource, not physical (the rulebook markdown\'s [physical] is a conversion error).',
      textReplace: { find: "top of the deck", replace: "top of your deck" },
    },
    {
      code: "40045",
      reason: 'MarvelCDB reads "the top of the deck"; The Painted Lady prints "your deck".',
      evidence:
        'Card scan assets/card-art/bundles/cards/40045.png (enlarged): "Response: After you discard a card from the top of your deck, attach that card facedown here (to a maximum of 3)."',
      textReplace: { find: "from the top of the deck", replace: "from the top of your deck" },
    },
    {
      code: "40012",
      reason: 'MarvelCDB drops the period of the form restriction ("Hero form only").',
      evidence: 'Card scan assets/card-art/bundles/cards/40012.png: "Hero form only." on its own paragraph.',
      textReplace: { find: "Hero form only\n", replace: "Hero form only.\n" },
    },
    {
      code: "40064",
      reason:
        'MarvelCDB runs "Max 1 per player." and the Hero Interrupt together on one line; the card prints them as two paragraphs.',
      evidence:
        'Card scan assets/card-art/bundles/cards/40064.png: "Max 1 per player." paragraph, then "Hero Interrupt: ..." paragraph.',
      textReplace: { find: "Max 1 per player. Hero Interrupt", replace: "Max 1 per player.\nHero Interrupt" },
    },
    {
      code: "40154",
      reason: "MarvelCDB types High Ground as an attachment; it is a treachery (When Revealed, no attach rule).",
      evidence: "Card scan assets/card-art/bundles/cards/40154.png: type line TREACHERY, no attach sentence.",
      cardType: "treachery",
    },
    {
      code: "40092",
      reason:
        "Inhibitor Collar's red -1 ATK badge is the attachment stat box; stated explicitly so the attachment's attack modifier is not lost.",
      evidence: "Card scan assets/card-art/bundles/cards/40092.png: ATK badge −1.",
      attack: -1,
    },
    {
      code: "40173",
      reason:
        "Psychic Inertia prints two stat badges, -1 THW and -1 ATK. MarvelCDB sends attack -1 (read as a printed X without this) and files the THW badge under scheme.",
      evidence: "Card scan assets/card-art/bundles/cards/40173.png: badges −1 THW and −1 ATK.",
      attack: -1,
      thwart: -1,
    },
    {
      code: "40139b",
      reason:
        'Sinister Intent 1B prints a dash in the target-threat oval and both bottom boxes (RRG 1.8 "Dash (Value)", p. 15); MarvelCDB sends no threat values. It advances only through its own When Revealed.',
      evidence:
        'Card scan assets/card-art/bundles/cards/40139b.png (enlarged): target oval "—", both bottom boxes "—".',
      dashedThreatFields: ["startingThreat", "targetThreat", "acceleration"],
    },
    ...["40190a", "40191a", "40192a", "40193a", "40194a", "40195a"].map((code) => ({
      code,
      reason: "Campaign player side scheme (side A) prints a dash cost; MarvelCDB sends no cost.",
      evidence: `Card scan assets/card-art/bundles/cards/${code}.png (enlarged): cost box at the top right prints a dash.`,
      specialCost: "dash" as const,
    })),
    {
      code: "40105a",
      reason:
        "Hope's Captor prints no \"Attach to\" sentence: main scheme 40103's Setup attaches it to the villain (Permanent).",
      evidence:
        'Card scan assets/card-art/bundles/cards/40105a.png: Permanent, "reset attached villain\'s hit points".',
      impliedAttachHost: { kind: "villain" },
    },
    {
      code: "40123",
      reason:
        'Head of Steam prints its attach clause inside its own When Revealed ("Attach Head of Steam to Juggernaut and place 1 momentum counter on him"); Juggernaut is the scenario\'s villain.',
      evidence:
        'Card scan assets/card-art/bundles/cards/40123.png: "When Revealed: Attach Head of Steam to Juggernaut ..."; docs/phase7-wave7.md §1.14: the attach is inside its own When Revealed, so a canceled reveal must not leave it attached (ruling February 20, 2026 (4)); the script attaches it.',
      impliedAttachHost: "ownWhenRevealed",
    },
    {
      code: "40169",
      reason:
        "Mental Transferal's host is conditional (\"If Stryfe's Grasp is in play, attach to Hope Summers. Otherwise, attach to your identity.\"), a shape AttachmentHost cannot say. It is attached by its own reveal; the scripter picks the host (scriptingNotes).",
      evidence:
        'Card scan assets/card-art/bundles/cards/40169.png: "If Stryfe\'s Grasp is in play, attach to Hope Summers. Otherwise, attach to your identity."',
      impliedAttachHost: "ownWhenRevealed",
    },
  ],
  errata: [
    {
      code: "40092",
      version: "RRG 1.8",
      changedFields: ["text"],
      note: 'Inhibitor Collar: "Any player can do this." is now rules text; the print has it as parenthetical reminder text. MarvelCDB carries the current wording.',
      evidence:
        'RRG 1.8 p. 69, NeXt Evolution errata: "Action: Choose to either exhaust a character you control or take 3 damage → discard this card. Any player can do this."; card scan assets/card-art/bundles/cards/40092.png prints "(Any player can do this.)" in italics.',
      printedReplace: {
        find: "discard this card. Any player can do this.",
        replace: "discard this card. (Any player can do this.)",
      },
    },
  ],

  scriptingNotes: {
    "40169.mental-transferal-constant":
      "Host is conditional: attach to Hope Summers if Stryfe's Grasp (40168a) is in play, otherwise to the revealing player's identity.",
  },
  cardNotes: {
    "40130":
      "Hope Summers prints a star on both THW and ATK (scan 40130.png): her own text sets her base THW and ATK equal to the first player's hero's. The stat boxes carry 0 and the ability is the value. Dash cost, HP 3.",
  },

  identityDeckbuilding: {
    "40001a": { offAspectAllowance: { cardType: "player_side_scheme" } },
  },

  scenarios: [
    {
      id: "morlock-siege",
      name: "Morlock Siege",
      villainSetCode: "morlock_siege",
      // Seven one-stage villains share the `marauders` card_set_code (the Mansion Attack shape, docs/phase7-wave7.md
      // §1.5): standard mode uses the A faces 40070a-40076a, expert the B faces.
      villainCardCode: "40070a",
      setAsideVillainCardCodes: ["40071a", "40072a", "40073a", "40074a", "40075a", "40076a"],
      expertVillains: {
        villainCardCode: "40070b",
        setAsideVillainCardCodes: ["40071b", "40072b", "40073b", "40074b", "40075b", "40076b"],
      },
      // 40077a Setup: "Set the Hide! treachery and each Morlock ally aside."
      setAsideCardCodes: ["40079", "40080"],
      startingVillain: "random",
      victory: "cardAbility",
      additionalEncounterSetCodes: ["marauders"],
      recommendedModularSetCodes: ["military_grade", "mutant_slayers"],
      standardSetCodes: ["standard"],
      expertSetCodes: ["expert"],
      villainStages: { standard: [1, 1], expert: [1, 1] },
      modularSetCount: 2,
      evidence:
        'MC40 p. 9 and 40077a Contents: "Marauders on side A (side B for expert mode). Morlock Siege and Standard encounter sets. Two modular encounter sets (Military Grade and Mutant Slayers)." Setup: shuffle the villains into the villain deck, top card in play (startingVillain random); win by 3 villains under Routed (card ability, docs/phase7-wave7.md §1.5). Marauders is the villains\' own set; Hide! and the four Morlock allies are set aside (docs/phase7-wave7.md §1.7).' +
        " Standard/Expert sets are Core's own, as in `mut_gen` (the Expert set per RRG 1.8 Expert Mode, p. 28).",
    },
    {
      id: "on-the-run",
      name: "On the Run",
      villainSetCode: "on_the_run",
      // Seven one-stage villains share the `marauders` card_set_code (the Mansion Attack shape, docs/phase7-wave7.md
      // §1.5): standard mode uses the A faces 40070a-40076a, expert the B faces.
      villainCardCode: "40070a",
      setAsideVillainCardCodes: ["40071a", "40072a", "40073a", "40074a", "40075a", "40076a"],
      expertVillains: {
        villainCardCode: "40070b",
        setAsideVillainCardCodes: ["40071b", "40072b", "40073b", "40074b", "40075b", "40076b"],
      },
      // 40103a Setup attaches the permanent Hope's Captor to the villain, so it is set aside before step 1 (RRG p. 32,
      // as the Juggernaut Helmet, docs/phase7-wave7.md §1.16).
      setAsideCardCodes: ["40105a"],
      startingVillain: "random",
      victory: "cardAbility",
      additionalEncounterSetCodes: ["marauders", "mutant_slayers"],
      recommendedModularSetCodes: ["military_grade", "nasty_boys"],
      standardSetCodes: ["standard"],
      expertSetCodes: ["expert"],
      villainStages: { standard: [1, 1], expert: [1, 1] },
      modularSetCount: 2,
      evidence:
        'MC40 p. 11 and 40103a Contents: "Marauders on side A (side B for expert mode). On the Run, Mutant Slayers, and Standard encounter sets. Two modular encounter sets (Military Grade and Nasty Boys)." Setup: one random MARAUDER villain into play, the same-title minion and each other villain removed (startingVillain random); Mutant Slayers is required (additional), the win is Escaping with Hope 2B (card ability, docs/phase7-wave7.md §2.3).' +
        " Standard/Expert sets are Core's own, as in `mut_gen` (the Expert set per RRG 1.8 Expert Mode, p. 28).",
    },
    {
      id: "juggernaut",
      name: "Juggernaut",
      villainSetCode: "juggernaut",
      // 40121a Setup attaches the permanent Juggernaut's Helmet (40122a) to Juggernaut: set aside before step 1.
      setAsideCardCodes: ["40122a"],
      additionalEncounterSetCodes: ["hope_summers"],
      recommendedModularSetCodes: ["black_tom_cassidy"],
      standardSetCodes: ["standard"],
      expertSetCodes: ["expert"],
      villainStages: { standard: [1, 2], expert: [2, 3] },
      modularSetCount: 1,
      evidence:
        'MC40 p. 14 and 40121a Contents: "Juggernaut (I) and Juggernaut (II) (Juggernaut (II) and Juggernaut (III) instead for expert mode). Juggernaut, Hope Summers, and Standard encounter sets. One modular encounter set (Black Tom Cassidy)." Black Tom Cassidy is removable outside the campaign (campaign rule: pass 1c). Hope Summers is an extra modular set (docs/phase7-wave7.md §1.12, §1.16).' +
        " Standard/Expert sets are Core's own, as in `mut_gen` (the Expert set per RRG 1.8 Expert Mode, p. 28).",
    },
    {
      id: "mister-sinister",
      name: "Mister Sinister",
      villainSetCode: "mister_sinister",
      // 40139a Setup: "Set aside the Flight, Super Strength, and Telepathy encounter sets." Every card of the three sets.
      setAsideCardCodes: [
        "40151",
        "40152",
        "40153",
        "40154",
        "40155",
        "40156",
        "40157",
        "40158",
        "40159",
        "40160",
        "40161",
        "40162",
      ],
      additionalEncounterSetCodes: ["hope_summers", "flight", "super_strength", "telepathy"],
      recommendedModularSetCodes: ["nasty_boys"],
      standardSetCodes: ["standard"],
      expertSetCodes: ["expert"],
      villainStages: { standard: [1, 2], expert: [2, 3] },
      modularSetCount: 1,
      evidence:
        'MC40 p. 16 and 40139a Contents: "Mister Sinister (I) and Mister Sinister (II) (Mister Sinister (II) and Mister Sinister (III) instead for expert mode). Mister Sinister, Flight, Super Strength, Telepathy, Hope Summers, and Standard encounter sets. One modular encounter set (Nasty Boys)." The main scheme deck is Sinister Intent, one of three stage 2s, Sinister Ends (docs/phase7-wave7.md §1.11, §1.16).' +
        " Standard/Expert sets are Core's own, as in `mut_gen` (the Expert set per RRG 1.8 Expert Mode, p. 28).",
    },
    {
      id: "stryfe",
      name: "Stryfe",
      villainSetCode: "stryfe",
      // 40166a Setup: "Reveal Stryfe's Grasp." Permanent, so set aside before step 1 and revealed by the Setup.
      setAsideCardCodes: ["40168a"],
      additionalEncounterSetCodes: ["hope_summers"],
      recommendedModularSetCodes: ["extreme_measures", "mutant_insurrection"],
      standardSetCodes: ["standard"],
      expertSetCodes: ["expert"],
      villainStages: { standard: [1, 2], expert: [2, 3] },
      modularSetCount: 2,
      evidence:
        'MC40 p. 18 and 40166a Contents: "Stryfe (I) and Stryfe (II) (Stryfe (II) and Stryfe (III) instead for expert mode). Stryfe, Hope Summers, and Standard encounter sets. Two modular encounter sets (Extreme Measures and Mutant Insurrection)." (docs/phase7-wave7.md §1.11, §1.16).' +
        " Standard/Expert sets are Core's own, as in `mut_gen` (the Expert set per RRG 1.8 Expert Mode, p. 28).",
    },
  ],
  starterDecks: [
    {
      id: "cable-leadership",
      name: "Cable / Leadership",
      identityCode: "40001a",
      aspect: "leadership",
      // Lock and Load (Aggression) and Establish Perimeter (Protection) are player side schemes, covered by Cable's
      // own off-aspect allowance (identityDeckbuilding above), not a second chosen aspect.
      offAspectAllowanceCodes: ["40019", "40020"],
      cards: {
        "40002": 1, // Bodyslide
        "40003": 3, // Mind Scan
        "40004": 1, // Precognition
        "40005": 2, // Telekinetic Blast
        "40006": 1, // Technovirus Purge
        "40007": 1, // Graymalkin
        "40008": 1, // Professor
        "40009": 1, // Askani'son
        "40010": 1, // Forced Amnesia
        "40011": 1, // Plasma Rifle
        "40012": 1, // Telekinetic Force Field
        "40013": 1, // Temporal Leap
        "40014": 1, // Caliban
        "40015": 1, // Fantomex
        "40016": 1, // Sunspot
        "40017": 3, // Mission Planning
        "40018": 1, // Call for Backup
        "40019": 1, // Lock and Load (Aggression player side scheme)
        "40020": 1, // Establish Perimeter (Protection player side scheme)
        "40021": 1, // E.V.A.
        "40022": 3, // Uncanny X-Force
        "40023": 1, // Mission Leader
        "40024": 1, // Deadpool
        "40025": 1, // Deathlok
        "40026": 1, // Frenemies
        "40027": 1, // Build Support
        "40028": 3, // The Power of the Mind
        "40029": 1, // Psimitar
        "40030": 3, // Sidearm
      },
      obligationCode: "40031",
      nemesisCodes: ["40032", "40033", "40034", "40035", "40036"],
      verified: true,
      sources: ['docs/campaign-modes/markdown/mc40_next_evolution.md (MC40 p. 22, "CABLE / LEADERSHIP")'],
      note: "40 cards (identity, obligation and nemesis set excluded): 15 Cable, 12 Leadership, 1 Aggression and 1 Protection player side scheme, 11 basic. MC40 p. 22 lists titles and quantities, not codes; each was matched to raw/marvelcdb/next_evol.json by card_set_code (cable/basic) or faction_code and name, and every quantity equals the raw printed quantity and deck limit. The Telekinetic Force Field, Mind Scan and Telekinetic Blast named in the rulebook's nemesis set are the encounter copies 40034-40036, not the hero cards in the deck.",
    },
    {
      id: "domino-justice",
      name: "Domino / Justice",
      identityCode: "40037a",
      aspect: "justice",
      cards: {
        "40038": 1, // Diamondback
        "40039": 1, // Outlaw
        "40040": 2, // A Good Workout
        "40041": 1, // Luck Be a Lady
        "40042": 2, // Right Place, Right Time
        "40043": 1, // Jackpot!
        "40044": 1, // Pip the Pug
        "40045": 1, // The Painted Lady
        "40046": 2, // Domino's Pistol
        "40047": 1, // Lucky and Good
        "40048": 1, // Lucky Break
        "40049": 1, // Probability Field
        "40050": 1, // Feral
        "40051": 1, // Wolfsbane
        "40052": 3, // Even the Odds
        "40053": 3, // Team Investigation
        "40054": 1, // Take Out the Guards
        "40055": 3, // Overwatch
        "40056": 1, // Atlas Bear
        "40057": 1, // White Fox
        "40058": 1, // The Posse
        "40059": 1, // Superpower Training
        "40060": 3, // Digging Deep
        "40061": 1, // Energy
        "40062": 1, // Genius
        "40063": 1, // Strength
        "40064": 3, // Sharpshooter
      },
      obligationCode: "40065",
      nemesisCodes: ["40066", "40067", "40068", "40069"],
      verified: true,
      sources: ['docs/campaign-modes/markdown/mc40_next_evolution.md (MC40 p. 22, "DOMINO / JUSTICE")'],
      note: "40 cards (identity, obligation and nemesis set excluded): 15 Domino, 12 Justice, 13 basic. MC40 p. 22 lists titles and quantities, not codes; each was matched to raw/marvelcdb/next_evol.json by card_set_code (domino/basic) or faction_code and name, and every quantity equals the raw printed quantity and deck limit. Superpower Feedback (x2) is one record, 40069, quantity 2.",
    },
  ],
};
