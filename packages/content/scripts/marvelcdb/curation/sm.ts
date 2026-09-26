/**
 * Sinister Motives (MC27, Cycle 4 campaign box) curation — Ghost-Spider and Spider-Man (Miles Morales) hero kits,
 * five scenarios (Sandman, Venom, Mysterio, The Sinister Six, Venom Goblin), nine modular sets (City in Chaos,
 * Down to Earth, Symbiotic Strength, Personal Nightmare, Whispers of Paranoia, Guerrilla Tactics, Goblin Gear,
 * Osborn Tech, Sinister Assault) and the Sinister Motives Campaign set (cards 174–191). docs/phase7-wave5.md §1,
 * §2 is the working spec this pass implements; citations below use its section numbers alongside MC27's own
 * printed page (the rulebook conversion, `docs/campaign-modes/markdown/mc27_sinister_motives.md`) and RRG 1.8 page
 * numbers.
 *
 * The survey (`survey.ts --pack sm`, 2026-09-26) reports 31 lines, all resolved below: Venom Goblin's lettered main
 * schemes (§1.1, 16 lines — the normalizer itself gained a dedicated code path for this shape,
 * `normalize/main-schemes.ts`'s `normalizeLetteredSchemeChain`, since no existing pair-of-linked-records shape
 * fit), campaign upgrades without a printed cost (8 lines, §1.8), attach rules the parser missed because the
 * attach clause sits inside a `When Revealed:` ability body rather than as its own preamble sentence (2 lines +
 * their 2 "never turned into a card" siblings, §1.9 — `Correction.impliedAttachHost` widened to cover them), Light
 * at the End's missing artwork (2 lines) and Sand Clone's X ATK (1 line).
 */
import type { PackCuration } from "./types.ts";

export const SM_CURATION: PackCuration = {
  packCode: "sm",
  cycle: { id: "cycle4", name: "Cycle 4", order: 4 },
  pack: {
    name: "Sinister Motives",
    releaseDate: "2022-04-08",
    releaseDateSource:
      "Hall of Heroes Sinister Motives page (https://hallofheroeslcg.com/sinister-motives/): " +
      '"Release date: April 8, 2022".',
  },
  outDir: "src/data/sm",
  exportPrefix: "SM",
  // MarvelCDB has no campaign record at all (docs/campaign-mode-design.md §3) — `campaign.ts` is hand-authored,
  // the same shape `mts`/`gmw`/`trors` use for their own box's `Campaign` record.
  handAuthoredModules: ["campaign"],

  corrections: [
    // docs/phase7-wave5.md §1.9: Manipulated Mind's own When Revealed reads "Attach to the ally you control with
    // the lowest cost. Attached ally engages its controller. Otherwise, this card gains surge." — the "Attach to"
    // clause sits inside the ability body (after "When Revealed: "), not as its own preamble sentence, so the
    // parser's `sentence.startsWith("Attach to ")` scan never sees it. The specific "lowest cost" narrowing is the
    // When Revealed ability's own job (an `ability-scripting-engineer` concern); the structural host recorded here
    // is the generic category, the same way Focused Defense's `impliedAttachHost` is just `"mainScheme"` rather
    // than "the stage this ability names" (wave 4 §1.13 precedent).
    {
      code: "27171",
      reason:
        'Manipulated Mind has no preamble "Attach to X." sentence: its host is established by its own When ' +
        'Revealed ("Attach to the ally you control with the lowest cost"), inside the ability body.',
      evidence: 'raw 27171 real_text: "When Revealed: Attach to the ally you control with the lowest cost. ..."',
      impliedAttachHost: "ally",
    },
    // docs/phase7-wave5.md §1.9: Old Grudge's own When Revealed reads "Search the encounter deck, discard pile,
    // and set-aside area for your nemesis minion, then reveal that minion. Attach Old Grudge to it. (Shuffle.)" —
    // an "Attach <name> to <target>" clause, not "Attach to <target>."; the target is the search's own result
    // (whichever minion turns out to be the nemesis), so the structural host is the generic "minion" category.
    {
      code: "27172",
      reason:
        'Old Grudge has no preamble "Attach to X." sentence: its own When Revealed searches for "your nemesis ' +
        'minion" and then "Attach[es] Old Grudge to it" — an "Attach <name> to <target>" clause inside the ' +
        "ability body, naming no fixed host.",
      evidence: 'raw 27172 real_text: "When Revealed: Search ... for your nemesis minion ... Attach Old Grudge to it."',
      impliedAttachHost: "minion",
    },
    // docs/phase7-wave5.md §1.8: the eight S.H.I.E.L.D. Tech upgrades print "Setup. Permanent." with a cost of "—"
    // (MC27 p. 4 callout, "UPGRADE –"). MarvelCDB sends no `cost` field at all for each, which is otherwise
    // indistinguishable from a data gap. Confirmed printed dash cost from the box's own rulebook callout (not a
    // per-card image lookup — the same printed-card-family dash the callout documents for the whole set).
    {
      code: "27182a",
      reason: 'Compact Darts prints a dash cost ("—", "Setup. Permanent." — campaign S.H.I.E.L.D. Tech upgrade).',
      evidence: 'MC27 p. 4 callout: "Campaign - S.H.I.E.L.D. Tech" upgrades are cost "—".',
      specialCost: "dash",
    },
    {
      code: "27183a",
      reason:
        'Impact-Dampening Suit prints a dash cost ("—", "Setup. Permanent." — campaign S.H.I.E.L.D. Tech upgrade).',
      evidence: 'MC27 p. 4 callout: "Campaign - S.H.I.E.L.D. Tech" upgrades are cost "—".',
      specialCost: "dash",
    },
    {
      code: "27184a",
      reason: 'Laser Goggles prints a dash cost ("—", "Setup. Permanent." — campaign S.H.I.E.L.D. Tech upgrade).',
      evidence: 'MC27 p. 4 callout: "Campaign - S.H.I.E.L.D. Tech" upgrades are cost "—".',
      specialCost: "dash",
    },
    {
      code: "27185a",
      reason: 'Propulsion Gauntlet prints a dash cost ("—", "Setup. Permanent." — campaign S.H.I.E.L.D. Tech upgrade).',
      evidence: 'MC27 p. 4 callout: "Campaign - S.H.I.E.L.D. Tech" upgrades are cost "—".',
      specialCost: "dash",
    },
    {
      code: "27186a",
      reason: 'Retinal Display prints a dash cost ("—", "Setup. Permanent." — campaign S.H.I.E.L.D. Tech upgrade).',
      evidence: 'MC27 p. 4 callout: "Campaign - S.H.I.E.L.D. Tech" upgrades are cost "—".',
      specialCost: "dash",
    },
    {
      code: "27187a",
      reason: 'Shock Knuckles prints a dash cost ("—", "Setup. Permanent." — campaign S.H.I.E.L.D. Tech upgrade).',
      evidence: 'MC27 p. 4 callout: "Campaign - S.H.I.E.L.D. Tech" upgrades are cost "—".',
      specialCost: "dash",
    },
    {
      code: "27188a",
      reason: 'Wave Bracers prints a dash cost ("—", "Setup. Permanent." — campaign S.H.I.E.L.D. Tech upgrade).',
      evidence: 'MC27 p. 4 callout: "Campaign - S.H.I.E.L.D. Tech" upgrades are cost "—".',
      specialCost: "dash",
    },
    {
      code: "27189a",
      reason: 'Wrist Navigator prints a dash cost ("—", "Setup. Permanent." — campaign S.H.I.E.L.D. Tech upgrade).',
      evidence: 'MC27 p. 4 callout: "Campaign - S.H.I.E.L.D. Tech" upgrades are cost "—".',
      specialCost: "dash",
    },
  ],

  errata: [],

  scriptingNotes: {},

  cardNotes: {
    // docs/phase7-wave5.md §1.9: Sand Clone prints "X is equal to the number of sand counters on City Streets."
    // (MarvelCDB sends `attack: -1`, its printed-X encoding).
    "27067": "ATK X: X is equal to the number of sand counters on City Streets (own printed ability text).",
    // TODO(docs/phase7-wave5.md §4 Q14): raw text already reads "Uses (2[per_hero] notoriety counters)" (27174a,
    // standard) / "Uses (3[per_hero] notoriety counters)" (27174b, expert) and parses cleanly with no correction
    // needed — but a second, independent source (a card-image pass, owned separately per the box's image-
    // collection work) should confirm the "[per_hero]" reading before this is marked playable. Do not remove this
    // note until that confirmation lands.
    "27174a": "Uses count confirmation pending a card-image cross-check, both faces (docs/phase7-wave5.md §4 Q14).",
  },

  scenarios: [
    // Sandman (MC27 p. 9). Single villain, ordinary Core-style shape.
    {
      id: "sandman",
      name: "Sandman",
      villainSetCode: "sandman",
      additionalEncounterSetCodes: ["city_in_chaos"],
      recommendedModularSetCodes: ["down_to_earth"],
      standardSetCodes: [],
      expertSetCodes: [],
      villainStages: { standard: [1, 2], expert: [2, 3] },
      modularSetCount: 1,
      evidence:
        'MC27 p. 9: "Villain Deck: Sandman (I), Sandman (II)" ("Remove Sandman (I) and add Sandman (III) for ' +
        'expert mode."), "Main Scheme Deck: Hapless Pedestrians (1A/1B)", "Encounter Deck: Sandman, City in ' +
        'Chaos, Down to Earth, and Standard encounter sets." — this box has no literal "standard"/"expert" ' +
        "MarvelCDB set of its own (checked: no such `card_set_code` anywhere in the raw pack), so both stay empty.",
    },
    // Venom (MC27 p. 11).
    {
      id: "venom",
      name: "Venom",
      villainSetCode: "venom",
      additionalEncounterSetCodes: ["symbiotic_strength"],
      recommendedModularSetCodes: ["down_to_earth"],
      standardSetCodes: [],
      expertSetCodes: [],
      villainStages: { standard: [1, 2], expert: [2, 3] },
      modularSetCount: 1,
      evidence:
        'MC27 p. 11: "Villain Deck: Venom (I), Venom (II)" ("Remove Venom (I) and add Venom (III) for expert ' +
        'mode."), "Main Scheme Deck: \\"Leave Us Alone!\\" (1A/1B)", "Encounter Deck: Venom, Down to Earth, ' +
        'Symbiotic Strength, and Standard encounter sets." Not yet fully playable standalone: the boost-cards-on-' +
        "an-identity mechanic (docs/phase7-wave5.md §3.6 — open).",
    },
    // Mysterio (MC27 p. 13). Two-stage main scheme deck (Maze of Mirrors → Edge of Reality).
    {
      id: "mysterio",
      name: "Mysterio",
      villainSetCode: "mysterio",
      additionalEncounterSetCodes: ["personal_nightmare"],
      recommendedModularSetCodes: ["whispers_of_paranoia"],
      standardSetCodes: [],
      expertSetCodes: [],
      villainStages: { standard: [1, 2], expert: [2, 3] },
      modularSetCount: 1,
      evidence:
        'MC27 p. 13: "Villain Deck: Mysterio (I), Mysterio (II)" ("Remove Mysterio (I) and add Mysterio (III) ' +
        'for expert mode."), "Main Scheme Deck: Maze of Mirrors (1A/1B), Edge of Reality (2A/2B)", "Encounter ' +
        'Deck: Mysterio, Personal Nightmare, Whispers of Paranoia, and Standard encounter sets." Not yet fully ' +
        "playable standalone: encounter cards living in a player's deck/hand/discard pile (docs/phase7-wave5.md " +
        "§3.5 — open).",
    },
    // The Sinister Six (MC27 p. 15). Six single-stage villains sharing one card_set_code, told apart by direct
    // villainCardCodes (the Kang/Tower Defense shape, docs/phase7-wave5.md §1.5), started set aside.
    {
      id: "sinister-six",
      name: "The Sinister Six",
      villainSetCode: "sinister_six",
      villainCardCode: "27094", // Doctor Octopus (I) — Scenario.villainCardId is "the first of the villains".
      additionalEncounterSetCodes: ["guerrilla_tactics"],
      recommendedModularSetCodes: [],
      standardSetCodes: [],
      expertSetCodes: [],
      villainStages: { standard: [1, 1], expert: [1, 1] },
      modularSetCount: 0,
      multipleVillains: {
        villainSetCodes: [
          "sinister_six",
          "sinister_six",
          "sinister_six",
          "sinister_six",
          "sinister_six",
          "sinister_six",
        ],
        villainCardCodes: ["27094", "27095", "27096", "27097", "27098", "27099"],
        encounterDecks: "shared",
        winCondition: "cardAbility",
        atSetup: "setAside",
      },
      evidence:
        'MC27 p. 15: "Villains: Doctor Octopus (I), Electro (I), Hobgoblin (I), Kraven the Hunter (I), Scorpion ' +
        '(I), Vulture (I)", "Main Scheme Deck: Sinister Synchronization (1A/1B), Sinister Beatdown (2A/2B)", ' +
        '"Encounter Deck: The Sinister Six, Guerrilla Tactics, and Standard encounter sets." — no modular set is ' +
        "listed for this scenario. Sinister Synchronization 1A's own Setup (\"Choose X villains at random ... " +
        'Put those villains into play ... and set the other villains aside") is `atSetup: "setAside"`; the win is ' +
        "Light at the End's own card ability, not defeating every villain (docs/phase7-wave5.md §1.5). Not yet " +
        "playable: villains that enter/leave play and an interruptible enemy activation (docs/phase7-wave5.md " +
        "§3.1, §3.2 — open).",
    },
    // Venom Goblin (MC27 p. 17). Four lettered main scheme stages (§1.1), one shared with the glider counter.
    {
      id: "venom-goblin",
      name: "Venom Goblin",
      villainSetCode: "venom_goblin",
      additionalEncounterSetCodes: ["symbiotic_strength"],
      recommendedModularSetCodes: ["goblin_gear"],
      standardSetCodes: [],
      expertSetCodes: [],
      villainStages: { standard: [1, 2], expert: [2, 3] },
      modularSetCount: 1,
      evidence:
        'MC27 p. 17: "Villain Deck: Venom Goblin (I), Venom Goblin (II)" ("Remove Venom Goblin (I) and add Venom ' +
        'Goblin (III) for expert mode."), "Main Scheme Deck: Skies Over New York (A), Lower Manhattan (B), ' +
        'Midtown Manhattan (C), Upper Manhattan (D)", "Encounter Deck: Venom Goblin, Symbiotic Strength, Goblin ' +
        'Gear, and Standard encounter sets." Not yet playable: the focused/glider main scheme mechanism ' +
        "(docs/phase7-wave5.md §3.3, §3.4, §3.9 — open).",
    },
  ],

  starterDecks: [
    // Ghost-Spider / Protection (MC27 p. 20).
    {
      id: "ghost-spider",
      name: "Ghost-Spider / Protection",
      identityCode: "27001a",
      aspect: "protection",
      cards: {
        "27002": 3, // Ghost Kick x3
        "27003": 1, // Parental Guidance
        "27004": 3, // Phantom Flip x3
        "27005": 2, // Pirouette and Punch x2
        "27006": 2, // Web Binding x2
        "27007": 1, // George Stacy
        "27008": 1, // Ticket to the Multiverse
        "27009": 2, // Web-Bracelet x2
        "27010": 1, // Silk
        "27011": 1, // Spider-Man (Miles Morales) ally
        "27012": 1, // Spider-UK
        "27013": 3, // Bait and Switch x3
        "27014": 3, // Jump Flip x3
        "27015": 3, // Return the Favor x3
        "27016": 3, // What Doesn't Kill Me x3
        "27017": 1, // Spider-Man (Hobie Brown)
        "27018": 1, // Across the Spider-Verse
        "27019": 1, // Young Love (first printing — docs/phase7-wave5.md §1.9)
        "27020": 1, // Energy (first printing)
        "27021": 1, // Genius (first printing)
        "27022": 1, // Strength (first printing)
        "27023": 1, // Web of Life and Destiny
        "27024": 3, // Plan B x3
      },
      obligationCode: "27025",
      nemesisCodes: ["27026", "27027", "27028", "27029"],
      verified: true,
      sources: ['docs/campaign-modes/markdown/mc27_sinister_motives.md (MC27 p. 20, "GHOST-SPIDER / PROTECTION")'],
      note:
        "40 cards (identity, obligation and nemesis set excluded). MC27 p. 20 lists card titles and quantities, " +
        "not MarvelCDB codes; each was matched to its raw record by card_set_code (`ghost_spider`/`protection`/" +
        "`basic`) and name — only one source (the box's own rulebook page) exists for this precon " +
        "(docs/phase7-wave5-sources.md §5, §7.1: Hall of Heroes' Sinister Motives page embeds the same rulebook " +
        "image, not an independent transcription).",
    },
    // Spider-Man (Miles Morales) / Justice (MC27 p. 20).
    {
      id: "spider-man-morales",
      name: "Spider-Man (Miles Morales) / Justice",
      identityCode: "27030a",
      aspect: "justice",
      cards: {
        "27031": 2, // Arachnobatics x2
        "27032": 2, // Double Life x2
        "27033": 2, // Swing In x2
        "27034": 3, // Web-Shot x3
        "27035": 1, // Ganke Lee
        "27036": 1, // Jefferson Davis
        "27037": 1, // Power Within
        "27038": 1, // Defense Mechanism
        "27039": 2, // Web-Shooter x2
        "27040": 1, // Monica Chang
        "27041": 1, // Spider-Woman
        "27042": 3, // Homeland Intervention x3
        "27043": 3, // Global Logistics x3
        "27044": 3, // Field Agent x3
        "27045": 2, // Surveillance Team x2
        "27046": 1, // Agent 13
        "27047": 1, // Dum Dum Dugan
        "27048": 1, // Ghost-Spider (ally)
        "27049": 1, // Spider-Man (Peter Parker)
        "27050": 1, // Young Love (second printing — docs/phase7-wave5.md §1.9)
        "27051": 1, // Energy (second printing)
        "27052": 1, // Genius (second printing)
        "27053": 1, // Strength (second printing)
        "27054": 3, // Government Liaison x3
        "27055": 1, // Sky-Destroyer
      },
      obligationCode: "27056",
      nemesisCodes: ["27057", "27058", "27059", "27060"],
      verified: true,
      sources: ['docs/campaign-modes/markdown/mc27_sinister_motives.md (MC27 p. 20, "SPIDER-MAN / JUSTICE")'],
      note: "40 cards (identity, obligation and nemesis set excluded); same single-source caveat as Ghost-Spider's.",
    },
  ],

  // Light at the End (27102a Trap!/27102b Chase!) has no artwork reference anywhere on MarvelCDB for either face
  // (checked on the live API, not merely the cached raw file, 2026-09-26), and no independently-viewable second
  // source could be located either. `PackCuration.artUnavailable` (that field's own doc comment) tells
  // `checkCoverage` to treat these two as a confirmed gap instead of a hard error — the same already-handled shape
  // wave 4's six art-less MTS faces used.
  artUnavailable: {
    "27102a": "No imagesrc on MarvelCDB's own record, and no viewable second-source scan found for the Trap! face.",
    "27102b": "No imagesrc on MarvelCDB's own record, and no viewable second-source scan found for the Chase! face.",
  },
};
