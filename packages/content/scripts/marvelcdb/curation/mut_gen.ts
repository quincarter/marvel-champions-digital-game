/**
 * Mutant Genesis (MC32, cycle 6 campaign box) curation, pass 1: cards only. Colossus and Shadowcat hero kits, five
 * scenarios' encounter cards, the role sets and the campaign cards 171-195. docs/phase7-wave6.md §1 is the working
 * spec; the scenario records, starter decks and the hand-authored `campaign.ts` are later passes (docs/
 * phase7-wave6-data-survey.md §9 steps 4-5), so `scenarios` and `starterDecks` are empty here.
 *
 * Evidence abbreviations: "scan" is `assets/card-art/bundles/cards/<code>.png` (gitignored, read directly; never
 * wired into the data), "RRG" is the v1.8 rules reference, "spec" is docs/phase7-wave6.md. The survey
 * (`survey.ts --pack mut_gen`) reported 21 lines on the bare curation, all resolved below: the three main scheme B
 * sides' dashed threat values, three missing dash costs (32031a, 32171b, 32172b), cardNotes for Robert Kelly and
 * Mystique, and the four attach rules.
 */
import type { PackCuration } from "./types.ts";

export const MUT_GEN_CURATION: PackCuration = {
  packCode: "mut_gen",
  // The id stays "cycle6" (data-only.test.ts and the pool version read it); only the name changes, for this pack
  // alone. The other cycle 6 packs are renamed in a later step (docs/phase7-wave6-data-survey.md §5, §9 step 9).
  cycle: { id: "cycle6", name: "Mutant Genesis", order: 6 },
  pack: {
    name: "Mutant Genesis",
    releaseDate: "2022-09-30",
    releaseDateSource:
      "docs/phase7-wave6-sources.md release table (September 30, 2022; Hall of Heroes https://hallofheroeslcg.com/mutant-genesis/)",
  },
  outDir: "src/data/mut_gen",
  exportPrefix: "MUT_GEN",
  // MarvelCDB has no campaign record (docs/campaign-mode-design.md §3): `campaign.ts` (`MUT_GEN_CAMPAIGN`) is
  // hand-authored, pass 2. Ingest refuses a named module whose file is missing.
  handAuthoredModules: ["campaign"],

  corrections: [
    {
      code: "32008",
      reason:
        'Steel Fist prints "Hero Action (attack):" and MarvelCDB drops the "(attack)" label (its text reads "Hero Action:"), which would script the 5 damage as plain damage instead of an attack (RRG 1.8 "Labeled Ability", p. 26). The label is restored; the erratum itself (below) only swaps the cost arrow for "to".',
      evidence:
        'Card scan assets/card-art/bundles/cards/32008.png: "Hero Action (attack): Deal 5 damage to an enemy. You may discard a tough status card from your hero \u2192 stun and confuse that enemy." RRG 1.8 p. 68, Mutant Genesis errata (#8) reads "Hero Action (attack): ...".',
      textReplace: { find: "Hero Action: Deal 5 damage", replace: "Hero Action (attack): Deal 5 damage" },
    },
    {
      code: "32063b",
      reason:
        'Stalked by Sabretooth 1B prints a dash in the target-threat oval (RRG 1.8 "Target Threat", p. 43: upper left corner); MarvelCDB sends threat: null without threat_fixed. It advances only through Find the Senator\'s When Defeated (docs/phase7-wave6.md \u00a71.6).',
      evidence:
        'Card scan assets/card-art/bundles/cards/32063b.png: target oval "\u2014", acceleration +1 per hero (star), starting threat 0.',
      dashedThreatFields: ["targetThreat"],
    },
    {
      code: "32087b",
      reason:
        "Night of the Sentinels 1B prints a dash in the target-threat oval (RRG 1.8 p. 43); MarvelCDB sends threat: null without threat_fixed. It never advances by threat (docs/phase7-wave6.md \u00a71.6).",
      evidence:
        'Card scan assets/card-art/bundles/cards/32087b.png: target oval "\u2014", acceleration +1 per hero, starting threat 1 per hero.',
      dashedThreatFields: ["targetThreat"],
    },
    {
      code: "32125b",
      reason:
        "The Brotherhood Strikes! 1B prints a dash in all three values (target oval and both bottom boxes); MarvelCDB sends 0 / 0 / null with no *_fixed flag. It advances on its own When Revealed and never holds threat (docs/phase7-wave6.md \u00a71.5).",
      evidence: 'Card scan assets/card-art/bundles/cards/32125b.png: oval "\u2014", both bottom boxes "\u2014".',
      dashedThreatFields: ["startingThreat", "targetThreat", "acceleration"],
    },
    {
      code: "32055",
      reason:
        'Permanently Phased prints "Flip your mass form upgrade to Phased." with no When Revealed header, so the parser emitted only -constant and -action refs and nothing ran the flip on reveal. The sentence is split into its own 32055.permanently-phased-when-revealed ref; the card text is unchanged and "You cannot attack, defend, or change mass form." stays in the constant ref (docs/phase7-wave6.md \u00a73.22).',
      evidence:
        'Card scan assets/card-art/bundles/cards/32055.png: "Give to the Kitty Pryde player." / "Flip your mass form upgrade to Phased." / "You cannot attack, defend, or change mass form." / "Alter-Ego Action: Exhaust Kitty Pryde \u2192 remove Permanently Phased from the game."',
      unheadedWhenRevealed: "Flip your mass form upgrade to Phased.",
    },
    {
      code: "32031a",
      reason:
        "Solid (Shadowcat's mass-form upgrade, Permanent) prints a dash cost; MarvelCDB sends no cost on either face. Same pattern as vision 26002 (docs/phase7-wave6.md \u00a71.2).",
      evidence: 'Card scan assets/card-art/bundles/cards/32031a.png: cost oval "\u2014".',
      specialCost: "dash",
    },
    {
      code: "32171b",
      reason:
        "Metro P.D. (Permanent campaign support) prints a dash cost; MarvelCDB sends no cost (docs/phase7-wave6.md \u00a71.8).",
      evidence: 'Card scan assets/card-art/bundles/cards/32171b.png: cost oval "\u2014".',
      specialCost: "dash",
    },
    {
      code: "32172b",
      reason:
        "Magneto (campaign ally, put into play by a campaign rule or Master Mold's Setup) prints a dash cost; MarvelCDB sends no cost (docs/phase7-wave6.md \u00a71.8).",
      evidence: 'Card scan assets/card-art/bundles/cards/32172b.png: cost oval "\u2014", THW 2, ATK 3 (star), HP 5.',
      specialCost: "dash",
    },
    {
      code: "32174b",
      reason:
        'MarvelCDB titles the obligation "Reactive Defense"; the card prints "Reactivate Defenses", as does 174A\'s own When Defeated text (docs/phase7-wave6.md \u00a71.8).',
      evidence: 'Card scan assets/card-art/bundles/cards/32174b.png: title "Reactivate Defenses".',
      name: "Reactivate Defenses",
    },
    {
      code: "32153",
      reason: 'MarvelCDB drops the word "magnet" from Electromagnetic Blast\'s When Revealed.',
      evidence: 'Card scan assets/card-art/bundles/cards/32153.png: "Place 1 magnet counter on the main scheme."',
      textReplace: { find: "Place 1 counter on the main scheme", replace: "Place 1 magnet counter on the main scheme" },
    },
    {
      code: "32066",
      reason:
        'MarvelCDB reads "deal the damage to Robert Kelly"; the card prints "deal that damage" (the rulebook quotes the same wording).',
      evidence:
        'Card scan assets/card-art/bundles/cards/32066.png; MC32 p. 7 (Robert Kelly): "deal that damage to Robert Kelly".',
      textReplace: { find: "deal the damage to Robert Kelly", replace: "deal that damage to Robert Kelly" },
    },
    {
      code: "32092",
      reason: 'MarvelCDB misspells the card\'s own name in its text ("Wolfbane").',
      evidence: 'Card scan assets/card-art/bundles/cards/32092.png: "Wolfsbane\'s attacks gain piercing."',
      textReplace: { find: "Wolfbane's attacks", replace: "Wolfsbane's attacks" },
    },
    {
      code: "32187",
      reason: 'MarvelCDB misspells "Hero Response" as "Hero Reponse".',
      evidence: 'Card scan assets/card-art/bundles/cards/32187.png: "Hero Response".',
      textReplace: { find: "Hero Reponse", replace: "Hero Response" },
    },
    {
      code: "32191",
      reason: 'MarvelCDB misspells "Hero Response" as "Hero Reponse".',
      evidence: 'Card scan assets/card-art/bundles/cards/32191.png: "Hero Response".',
      textReplace: { find: "Hero Reponse", replace: "Hero Response" },
    },
    {
      code: "32170",
      reason:
        'Nano-Sentinel Tech prints no "Attach to" sentence: its own When Revealed searches for the nemesis minion, puts it into play and attaches this card to it (Old Grudge, sm 27172, precedent; RRG 1.8 "Reveal", p. 38).',
      evidence:
        'Card scan assets/card-art/bundles/cards/32170.png: "When Revealed: Search ... for your nemesis minion. Put it into play engaged with you and attach this card to it."',
      impliedAttachHost: "ownWhenRevealed",
    },
  ],
  errata: [
    {
      code: "32008",
      version: "RRG 1.8",
      changedFields: ["text"],
      note: 'Steel Fist: the cost arrow is now "to" (the discard is an effect, not a cost). MarvelCDB carries the current wording; the print has the arrow.',
      evidence:
        "RRG 1.8 p. 68, Mutant Genesis errata (#8): \"Should read: 'Hero Action (attack): Deal 5 damage to an enemy. You may discard a tough status card from your hero to stun and confuse that enemy.' (Replaced cost arrow with 'to'.)\"; card scan assets/card-art/bundles/cards/32008.png prints the arrow.",
      printedReplace: { find: "from your hero to stun and confuse", replace: "from your hero \u2192 stun and confuse" },
    },
    {
      code: "32141b",
      version: "RRG 1.8",
      changedFields: ["text"],
      note: "Asteroid M: magnet counters are now removed before the Magnetic card is revealed. MarvelCDB (and the print) carry the old order.",
      evidence:
        "RRG 1.8 p. 68, Mutant Genesis errata; card scan assets/card-art/bundles/cards/32141b.png reads the old order (checked for 32141b).",
      currentReplace: {
        find: "discard cards from the encounter deck until a Magnetic card is discarded. Reveal that card, then remove 3 magnet counters from this scheme.",
        replace:
          "remove 3 of them and discard cards from the encounter deck until a Magnetic card is discarded. Reveal that card.",
      },
    },
    {
      code: "32142b",
      version: "RRG 1.8",
      changedFields: ["text"],
      note: "Factory Online: magnet counters are now removed before the Magnetic card is revealed. MarvelCDB (and the print) carry the old order.",
      evidence:
        "RRG 1.8 p. 68, Mutant Genesis errata; card scan assets/card-art/bundles/cards/32142b.png reads the old order (checked for 32141b).",
      currentReplace: {
        find: "discard cards from the encounter deck until a Magnetic card is discarded. Reveal that card, then remove 3 magnet counters from this scheme.",
        replace:
          "remove 3 of them and discard cards from the encounter deck until a Magnetic card is discarded. Reveal that card.",
      },
    },
    {
      code: "32143b",
      version: "RRG 1.8",
      changedFields: ["text"],
      note: "The Rule of Magnus: magnet counters are now removed before the Magnetic card is revealed. MarvelCDB (and the print) carry the old order.",
      evidence:
        "RRG 1.8 p. 68, Mutant Genesis errata; card scan assets/card-art/bundles/cards/32143b.png reads the old order (checked for 32141b).",
      currentReplace: {
        find: "discard cards from the encounter deck until a Magnetic card is discarded. Reveal that card, then remove 3 magnet counters from this scheme.",
        replace:
          "remove 3 of them and discard cards from the encounter deck until a Magnetic card is discarded. Reveal that card.",
      },
    },
    {
      code: "32088a",
      version: "RRG 1.8",
      changedFields: ["text"],
      note: 'Mutants at the Mall: Jubilee\'s replacement now discards any other ally version of Jubilee (added "ally"). MarvelCDB carries the old text.',
      evidence: "RRG 1.8 p. 68, Mutant Genesis errata (#88A).",
      currentReplace: {
        find: "discarding any other version of Jubilee",
        replace: "discarding any other ally version of Jubilee",
      },
    },
  ],

  scriptingNotes: {},
  cardNotes: {
    "32066":
      "Robert Kelly prints a dash for both THW and ATK (scan 32066.png): he never thwarts or attacks. Cost 0, HP 9, Senator ally the first player controls.",
    "32080":
      "Mystique prints a star on both SCH and ATK (scan 32080.png): her own text sets them equal to the villain's SCH and ATK. The stat boxes carry 0 and the ability is the value.",
  },

  scenarios: [
    {
      id: "sabretooth",
      name: "Sabretooth",
      villainSetCode: "sabretooth",
      additionalEncounterSetCodes: [],
      recommendedModularSetCodes: ["brotherhood", "mystique"],
      standardSetCodes: ["standard"],
      expertSetCodes: ["expert"],
      villainStages: { standard: [1, 2], expert: [2, 3] },
      modularSetCount: 2,
      separateDecks: [
        {
          name: "Future Past",
          contents: { encounterSetCodes: ["future_past"] },
          discardPile: "encounter",
          whenEmpty: "remainsEmpty",
        },
      ],
      evidence:
        'MC32 p. 7: "Villain Deck: Sabretooth (I), Sabretooth (II)" ("Remove Sabretooth (I) and add Sabretooth (III) for expert mode."), "Main Scheme Deck: Stalked by Sabretooth, The Injured Senator", "Encounter Deck: Sabretooth, Brotherhood, Mystique, and Standard sets." The page lets the Brotherhood and Mystique sets be removed or moved to other scenarios, so both are modular (modularSetCount 2: the printed deck uses both; docs/phase7-wave6.md §2.2).' +
        " Standard/Expert sets are Core's own, as in `sm` (MC32 prints 'The Standard set can be found in the Marvel Champions core set'; the Expert set per RRG 1.8 Expert Mode, p. 28).",
    },
    {
      id: "project-wideawake",
      name: "Project Wideawake",
      villainSetCode: "project_wideawake",
      additionalEncounterSetCodes: ["zero_tolerance"],
      recommendedModularSetCodes: ["sentinels"],
      standardSetCodes: ["standard"],
      expertSetCodes: ["expert"],
      villainStages: { standard: [1, 2], expert: [2, 3] },
      modularSetCount: 1,
      separateDecks: [
        {
          name: "Future Past",
          contents: { encounterSetCodes: ["future_past"] },
          discardPile: "encounter",
          whenEmpty: "remainsEmpty",
        },
      ],
      evidence:
        'MC32 p. 9: "Villain Deck: Sentinel (I), Sentinel (II)" (expert: Sentinel (III) for (I)), "Main Scheme Deck: Night of the Sentinels", "Encounter Deck: Project Wideawake, Sentinels, Zero Tolerance, and Standard sets." Zero Tolerance is required ("it is required when playing Project Wideawake"), so it is an additional set; Sentinels may be removed or moved, so it is modular.' +
        " Standard/Expert sets are Core's own, as in `sm` (MC32 prints 'The Standard set can be found in the Marvel Champions core set'; the Expert set per RRG 1.8 Expert Mode, p. 28).",
    },
    {
      id: "master-mold",
      name: "Master Mold",
      villainSetCode: "master_mold",
      // 32112a Setup: "Put the Magneto Ally (172B) into play under the first player's control." A card of the
      // campaign-specific mut_gen_campaign set, which a standalone game does not compose (docs/phase7-wave6.md §1.8).
      setAsideCardCodes: ["32172b"],
      additionalEncounterSetCodes: ["sentinels"],
      recommendedModularSetCodes: ["zero_tolerance"],
      standardSetCodes: ["standard"],
      expertSetCodes: ["expert"],
      villainStages: { standard: [1, 2], expert: [2, 3] },
      modularSetCount: 1,
      separateDecks: [
        {
          name: "Future Past",
          contents: { encounterSetCodes: ["future_past"] },
          discardPile: "encounter",
          whenEmpty: "remainsEmpty",
        },
      ],
      evidence:
        'MC32 p. 12: "Villain Deck: Master Mold (I), Master Mold (II)" (expert: Master Mold (III) for (I)), "Main Scheme Deck: The Sentinel Factory, Master Mold\'s Agenda", "Encounter Deck: Master Mold, Sentinels, Zero Tolerance, and Standard sets." Sentinels is required ("it is required when playing Master Mold"), so it is an additional set; Zero Tolerance may be removed or moved, so it is modular. 1A Setup puts Magneto (172B) into play from the campaign set, hence setAsideCardCodes (docs/phase7-wave6.md §1.8).' +
        " Standard/Expert sets are Core's own, as in `sm` (MC32 prints 'The Standard set can be found in the Marvel Champions core set'; the Expert set per RRG 1.8 Expert Mode, p. 28).",
    },
    {
      id: "mansion-attack",
      name: "Mansion Attack",
      villainSetCode: "mansion_attack",
      // Four one-stage villains share one card_set_code, so `villainIdBySet` has no entry (the Kang shape,
      // docs/phase7-wave6.md §1.4). Standard mode uses the (A) cards 32121a-32124a, expert the (B) cards.
      villainCardCode: "32121a",
      setAsideVillainCardCodes: ["32122a", "32123a", "32124a"],
      expertVillains: {
        villainCardCode: "32121b",
        setAsideVillainCardCodes: ["32122b", "32123b", "32124b"],
      },
      additionalEncounterSetCodes: ["brotherhood"],
      recommendedModularSetCodes: ["mystique"],
      standardSetCodes: ["standard"],
      expertSetCodes: ["expert"],
      villainStages: { standard: [1, 1], expert: [1, 1] },
      modularSetCount: 1,
      // MC32 p. 15: "The order is randomized"; the win is Save the School 32130 (defeat 1/2/3/4 villains by mode).
      startingVillain: "random",
      victory: "cardAbility",
      victoryCondition: { skirmish: 1, standard: 2, expert: 3, heroic: 4 },
      separateDecks: [
        {
          name: "Future Past",
          contents: { encounterSetCodes: ["future_past"] },
          discardPile: "encounter",
          whenEmpty: "remainsEmpty",
        },
      ],
      evidence:
        'MC32 p. 15: "Villain Deck: Avalanche (A), Blob (A), Pyro (A), Toad (A)" ("Replace each villain (A) with its villain (B) side for expert mode."), "Main Scheme Deck: The Brotherhood Strikes!, Attack on Xavier\'s (x4)", "Encounter Deck: Mansion Attack, Brotherhood, Mystique, and Standard sets." Brotherhood is required ("it is required when playing Mansion Attack"), Mystique may be removed or moved. "Multiple Villains": Skirmish defeat 1, Standard 2, Expert 3, Heroic 4; one villain in play at a time, order randomized. The main scheme is the single five-stage card 32125a (docs/phase7-wave6.md §1.5).' +
        " Standard/Expert sets are Core's own, as in `sm` (MC32 prints 'The Standard set can be found in the Marvel Champions core set'; the Expert set per RRG 1.8 Expert Mode, p. 28).",
    },
    {
      id: "magneto",
      name: "Magneto",
      villainSetCode: "magneto_villain",
      additionalEncounterSetCodes: [],
      recommendedModularSetCodes: ["acolytes"],
      standardSetCodes: ["standard"],
      expertSetCodes: ["expert"],
      villainStages: { standard: [1, 2], expert: [2, 3] },
      modularSetCount: 1,
      separateDecks: [
        {
          name: "Future Past",
          contents: { encounterSetCodes: ["future_past"] },
          discardPile: "encounter",
          whenEmpty: "remainsEmpty",
        },
      ],
      evidence:
        'MC32 p. 18: "Villain Deck: Magneto (I), Magneto (II)" ("Remove Magneto (I) and add Magneto (III) for expert mode."), "Main Scheme Deck: Asteroid M, Factory Online, The Rule of Magnus", "Encounter Deck: Magneto, Acolytes, and Standard sets." Acolytes may be removed or moved, so it is modular. The two side schemes 32144 and 32145 are set up by 1A, not by the scenario record.' +
        " Standard/Expert sets are Core's own, as in `sm` (MC32 prints 'The Standard set can be found in the Marvel Champions core set'; the Expert set per RRG 1.8 Expert Mode, p. 28).",
    },
  ],
  starterDecks: [
    {
      id: "colossus-protection",
      name: "Colossus / Protection",
      identityCode: "32001a",
      aspect: "protection",
      cards: {
        "32002": 1, // Shadowcat (ally)
        "32003": 1, // Piotr's Studio
        "32004": 1, // Iron Will
        "32005": 1, // Titanium Muscles
        "32006": 2, // Organic Steel
        "32007": 2, // Made of Rage
        "32008": 3, // Steel Fist
        "32009": 2, // Bulletproof Protector
        "32010": 2, // Armor Up
        "32011": 1, // Nightcrawler
        "32012": 1, // Polaris
        "32013": 3, // Protective Training
        "32014": 3, // Powerful Punch
        "32015": 3, // Bait and Switch
        "32016": 3, // Perseverance
        "32017": 3, // Mutant Protectors
        "32018": 2, // Defensive Energy
        "32019": 1, // Professor X
        "32020": 1, // The X-Jet
        "32021": 1, // Shadow and Steel (first printing)
        "32022": 1, // Energy (first printing)
        "32023": 1, // Genius (first printing)
        "32024": 1, // Strength (first printing)
      },
      obligationCode: "32025",
      nemesisCodes: ["32026", "32027", "32028", "32029"],
      verified: true,
      sources: ['docs/campaign-modes/markdown/mc32_mutant_genesis.md (MC32 p. 22, "COLOSSUS / PROTECTION")'],
      note: "40 cards (identity, obligation and nemesis set excluded). MC32 p. 22 lists titles and quantities, not codes; each was matched to raw/marvelcdb/mut_gen.json by card_set_code (colossus/protection/basic) and name, and every quantity equals the raw printed quantity and deck limit. Basic cards use the first printings 32021-32024 (collector order, the sm precedent); the second printings 32050/32052-32054 belong to the Shadowcat deck (docs/phase7-wave6.md §2.1).",
    },
    {
      id: "shadowcat-aggression",
      name: "Shadowcat / Aggression",
      identityCode: "32030a",
      aspect: "aggression",
      cards: {
        "32031a": 1, // Solid / Phased (double-sided mass form upgrade; Solid is the emitted face, 32031b its flip side)
        "32032": 1, // Lockheed
        "32033": 1, // Kitty's Room
        "32034": 1, // Acute Control
        "32035": 1, // Intangible Interference
        "32036": 2, // Phased and Confused
        "32037": 3, // Shadowcat Surprise
        "32038": 2, // Phase Strike (printed \"Phased Strike\" on the rulebook page)
        "32039": 2, // Airwalk
        "32040": 2, // Quick Shift
        "32041": 1, // Wolverine
        "32042": 1, // Magik
        "32043": 3, // Attack Training
        "32044": 3, // Gatekeeper
        "32045": 3, // Team Strike
        "32046": 3, // Toe to Toe
        "32047": 2, // Aggressive Energy
        "32048": 1, // Colossus (ally)
        "32049": 1, // X-Mansion
        "32050": 1, // Shadow and Steel (second printing)
        "32051": 3, // Ready to Rumble
        "32052": 1, // Energy (second printing)
        "32053": 1, // Genius (second printing)
        "32054": 1, // Strength (second printing)
      },
      obligationCode: "32055",
      nemesisCodes: ["32056", "32057", "32058", "32059"],
      verified: true,
      sources: ['docs/campaign-modes/markdown/mc32_mutant_genesis.md (MC32 p. 22, "SHADOWCAT / AGGRESSION")'],
      note: "41 cards (identity, obligation and nemesis set excluded; the rulebook's Shadowcat list includes the Solid / Phased upgrade, which counts toward 40-50). MC32 p. 22 lists titles and quantities, not codes; each was matched to raw/marvelcdb/mut_gen.json by card_set_code (shadowcat/aggression/basic) and name, and every quantity equals the raw printed quantity and deck limit. Solid / Phased is one double-sided upgrade emitted as 32031a with flip side 32031b (the Vision 26002 shape, docs/phase7-wave6.md §1.2), put into play Solid side up by Kitty's Setup rather than drawn.",
    },
  ],
};
