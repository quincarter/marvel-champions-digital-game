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
    // parser's `sentence.startsWith("Attach to ")` scan never sees it. The host is the card's own words as data:
    // the lowest printed cost among allies the revealing player controls (`controlledBy: "you"`; RRG 1.8 "Ownership
    // and Control", p. 31), ties the first player's choice. A plain `"ally"` let the reveal attach to any player's
    // ally. MarvelCDB also misspells "Attached minion's" as "Attach minion's" (checked against the scan, 27171.png).
    {
      code: "27171",
      reason:
        'Manipulated Mind has no preamble "Attach to X." sentence: its host is established by its own When ' +
        'Revealed ("Attach to the ally you control with the lowest cost"), inside the ability body.',
      evidence: 'raw 27171 real_text: "When Revealed: Attach to the ally you control with the lowest cost. ..."',
      impliedAttachHost: {
        kind: "superlative",
        among: "ally",
        order: "lowest",
        measure: "printedCost",
        controlledBy: "you",
      },
    },
    {
      code: "27171",
      reason: 'MarvelCDB reads "Attach minion\'s SCH"; the card prints "Attached minion\'s SCH".',
      evidence: "Card scan assets/card-art/bundles/cards/27171.png.",
      textReplace: { find: "Attach minion's SCH", replace: "Attached minion's SCH" },
    },
    // docs/phase7-wave5.md §1.9: Old Grudge's own When Revealed reads "Search the encounter deck, discard pile,
    // and set-aside area for your nemesis minion, then reveal that minion. Attach Old Grudge to it. (Shuffle.)" —
    // an "Attach <name> to <target>" clause, not "Attach to <target>."; the target is the search's own result. It has
    // no "attach to" text, so it carries no `attachesTo`: RRG 1.8 "Reveal" (p. 38) step 2 places it in front of the
    // revealing player (not in play) and its When Revealed attaches it (ruling, Feb 20, 2026 (4)). A generic
    // `"minion"` host made the reveal attach it to whichever minion was in play before the search ran.
    {
      code: "27172",
      reason:
        'Old Grudge has no preamble "Attach to X." sentence: its own When Revealed searches for "your nemesis ' +
        'minion" and then "Attach[es] Old Grudge to it" — an "Attach <name> to <target>" clause inside the ' +
        "ability body, naming no fixed host.",
      evidence: 'raw 27172 real_text: "When Revealed: Search ... for your nemesis minion ... Attach Old Grudge to it."',
      impliedAttachHost: "ownWhenRevealed",
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
    // Now or Never's raw MarvelCDB `text`/`real_text` renders its two "Choose:" options as bare newline-separated
    // sentences with no "•" bullet markers and no closing period on the second option — unlike every other
    // "Choose:" card in the corpus (e.g. core's Affairs of State, `real_text`: "...Choose:\n• Exhaust T'Challa →
    // ...\n• Choose and discard..."), whose raw text already carries the "•" itself (there is no bullet-inserting
    // normalization step; `toPlainText` only joins lines with "\n"). Confirmed against the card's own scan
    // (`assets/card-art/bundles/cards/27130.png`): "When Revealed: Choose: • Place 1 acceleration token on the
    // main scheme. • Exhaust a character you control and spend 1 resource of any type." — exactly MarvelCDB's two
    // sentences, just missing the bullets and the final period; no third option or further text on the card.
    {
      code: "27130",
      reason:
        'Now or Never\'s raw text drops the "•" bullet markers between its two "Choose:" options and the ' +
        'closing period on the second ("...resource of any type" with no "."), unlike every other "Choose:" card ' +
        "in the corpus, whose raw text already carries its own bullets.",
      evidence:
        'card scan assets/card-art/bundles/cards/27130.png: "When Revealed: Choose: • Place 1 acceleration ' +
        'token on the main scheme. • Exhaust a character you control and spend 1 resource of any type." — no ' +
        "further options past the two shown.",
      textReplace: {
        find: "Choose:\nPlace 1 acceleration token on the main scheme.\nExhaust a character you control and spend 1 resource of any type",
        replace:
          "Choose:\n• Place 1 acceleration token on the main scheme.\n• Exhaust a character you control and spend 1 resource of any type.",
      },
    },
    // Deepest Fears's raw MarvelCDB `text`/`real_text` says "If not identity-specific card was discarded this
    // way, take 1 damage." — a "not"/"no" transposition (the first clause correctly reads "If at least 1
    // identity-specific card was discarded this way, place 1 threat on the main scheme.", so this is the
    // complementary "if none were" case). Confirmed against the card's own scan
    // (`assets/card-art/bundles/cards/27157.png`): "...If no identity-specific card was discarded this way, take
    // 1 damage."
    {
      code: "27157",
      reason:
        'Deepest Fears\' raw text reads "If not identity-specific card was discarded this way, take 1 damage." ' +
        '— "not" for "no" — while the card\'s own scan prints "no".',
      evidence:
        'card scan assets/card-art/bundles/cards/27157.png: "...If no identity-specific card was discarded ' +
        'this way, take 1 damage."',
      textReplace: {
        find: "If not identity-specific card was discarded this way, take 1 damage.",
        replace: "If no identity-specific card was discarded this way, take 1 damage.",
      },
    },
    // Slice and Dice's raw MarvelCDB `text`/`real_text` says "If that attack defeats a character or not attack
    // was made this way, this card gains surge." — the same "not"/"no" transposition as Deepest Fears above.
    // Confirmed against the card's own scan (`assets/card-art/bundles/cards/27060.png`): "...or no attack was
    // made this way, this card gains surge."
    {
      code: "27060",
      reason:
        'Slice and Dice\'s raw text reads "...or not attack was made this way..." — "not" for "no" — while the ' +
        'card\'s own scan prints "no".',
      evidence:
        'card scan assets/card-art/bundles/cards/27060.png: "If that attack defeats a character or no attack ' +
        'was made this way, this card gains surge."',
      textReplace: {
        find: "If that attack defeats a character or not attack was made this way, this card gains surge.",
        replace: "If that attack defeats a character or no attack was made this way, this card gains surge.",
      },
    },
    // Induced Panic's raw MarvelCDB `text`/`real_text` splices its constant restriction and its separate
    // Alter-Ego Action with a literal "/n" (a stray transcription artifact, not an actual newline) instead of a
    // real line break, and drops the space around the Action's own "→" ("hand →discard this card."). Because
    // `parse-text.ts`'s header scan runs per `text.split("\n")` line and requires a trigger to start a line (or
    // follow ".)!" plus whitespace), the literal "/n" hides the "Alter-Ego Action:" header from the parser
    // entirely — the raw text parses as a single constant ability, when the card prints two independent
    // abilities (the constant restriction and the Alter-Ego Action). Confirmed against the card's own scan
    // (`assets/card-art/bundles/cards/27153.png`): the Action is its own paragraph, with "→" spaced on both
    // sides. Replacing the literal "/n" with a real newline lets the ordinary header-detection split this into
    // its own `action`-kind ability (`27153.induced-panic-action`, `assignAbilityIds`'s ordinary
    // `<slug>-<kind>` naming), alongside the existing `27153.induced-panic-constant`.
    {
      code: "27153",
      reason:
        'Induced Panic\'s raw text runs its constant restriction into its Alter-Ego Action with a literal "/n" ' +
        'instead of a newline ("...timing triggers.) /n Alter-Ego Action: ...") and drops the space around ' +
        '"→" ("hand →discard this card."), hiding the second ability from the header parser.',
      evidence:
        'card scan assets/card-art/bundles/cards/27153.png: the constant restriction and "Alter-Ego Action: ' +
        'Discard 1 identity-specific card at random from your hand → discard this card." are printed as two ' +
        'separate paragraphs, with "→" spaced on both sides.',
      textReplace: {
        find: "(Triggered abilities are ones with bold timing triggers.) /n Alter-Ego Action: Discard 1 identity-specific card at random from your hand →discard this card.",
        replace:
          "(Triggered abilities are ones with bold timing triggers.)\nAlter-Ego Action: Discard 1 identity-specific card at random from your hand → discard this card.",
      },
    },
    // Found scanning the rest of sm for the same kinds of defects. Rhino's raw MarvelCDB `text`/`real_text` says
    // "Rhino's attack gain overkill and piercing" — a subject/verb mismatch ("attack" for "attacks") with no
    // closing period. Confirmed against the card's own scan (`assets/card-art/bundles/cards/27128.png`):
    // "Rhino's attacks gain overkill and piercing."
    {
      code: "27128",
      reason:
        "Rhino's raw text reads \"Rhino's attack gain overkill and piercing\" with no closing period — a " +
        'subject/verb mismatch ("attack" for "attacks") — while the card\'s own scan prints "attacks." and a ' +
        "period.",
      evidence: 'card scan assets/card-art/bundles/cards/27128.png: "Rhino\'s attacks gain overkill and piercing."',
      textReplace: {
        find: "Rhino's attack gain overkill and piercing",
        replace: "Rhino's attacks gain overkill and piercing.",
      },
    },
    // Found scanning the rest of sm for the same kinds of defects. Skies Over New York's (27116b) raw
    // MarvelCDB `real_text` lowercases the second of its three bullet clauses ("encounter cards" mid-text,
    // where every other clause on the card starts a capitalized sentence/bullet), drops the quotation marks
    // around the quoted term "the main scheme" in the first two clauses, has no bullet markers at all (the same
    // missing-"•" shape as Now or Never's own correction above), and drops the closing period on the third
    // clause. Confirmed against the card's own scan (`assets/card-art/bundles/cards/27116b.png`): three
    // "•"-bulleted sentences, "Encounter cards" capitalized, "the main scheme" quoted in the first two, and a
    // closing period on the third.
    {
      code: "27116b",
      reason:
        'Skies Over New York\'s raw text lowercases "encounter cards" mid-card, drops the quotation marks around ' +
        'the quoted term "the main scheme" (both occurrences), has no "•" bullet markers between its three ' +
        "clauses, and drops the closing period on the third clause.",
      evidence:
        'card scan assets/card-art/bundles/cards/27116b.png: "• Player cards that affect \\"the main scheme\\" ' +
        'can apply to any main scheme. • Encounter cards that affect \\"the main scheme\\" only apply to the ' +
        "scheme with the glider counter (including the placing of acceleration tokens). • Each main scheme " +
        "accumulates threat each round according to its acceleration value and any acceleration tokens on that " +
        'scheme."',
      textReplace: {
        find: "Player cards that affect the main scheme can apply to any main scheme.\nencounter cards that affect the main scheme only apply to the scheme with the glider counter (including the placing of acceleration tokens).\nEach main scheme accumulates threat each round according to its acceleration value and any acceleration tokens on that scheme",
        replace:
          '• Player cards that affect "the main scheme" can apply to any main scheme.\n• Encounter cards that affect "the main scheme" only apply to the scheme with the glider counter (including the placing of acceleration tokens).\n• Each main scheme accumulates threat each round according to its acceleration value and any acceleration tokens on that scheme.',
      },
    },
    // Found scanning the rest of sm for the same kinds of defects. Tracking Display's raw MarvelCDB
    // `text`/`real_text` says "Surge .\n..." — a stray space before the period, unlike every other "Surge."
    // card in the corpus (11 others in sm alone, none with the extra space). Confirmed against the card's own
    // scan (`assets/card-art/bundles/cards/27152.png`): "Surge." with no space.
    {
      code: "27152",
      reason:
        'Tracking Display\'s raw text reads "Surge ." with a stray space before the period, unlike every other ' +
        '"Surge." card in the corpus, while the card\'s own scan prints "Surge." with no space.',
      evidence: 'card scan assets/card-art/bundles/cards/27152.png: "Surge." (no space before the period).',
      textReplace: {
        find: "Surge .\n",
        replace: "Surge.\n",
      },
    },
    // Found scripting the Sinister Six's own encounter attachments (`ability-scripting-engineer`). Taunting
    // Presence's raw MarvelCDB `text`/`real_text` has only its "Attach to..." sentence, dropping the card's second
    // printed sentence entirely. Confirmed against the card's own scan (`assets/card-art/bundles/cards/27104.png`):
    // a second line, "Threat cannot be removed from Light at the End."
    {
      code: "27104",
      reason:
        "Taunting Presence's raw text has only its \"Attach to...\" sentence; the card's own scan prints a " +
        "second sentence entirely absent from the source.",
      evidence:
        'card scan assets/card-art/bundles/cards/27104.png: "...attach this card to the active villain.\\n' +
        'Threat cannot be removed from Light at the End."',
      textReplace: {
        find: "Attach to the villain with the most remaining hit points. If you cannot, resolve the Ambush! Ability on the main scheme, then attach this card to the active villain.",
        replace:
          "Attach to the villain with the most remaining hit points. If you cannot, resolve the Ambush! Ability on the main scheme, then attach this card to the active villain.\nThreat cannot be removed from Light at the End.",
      },
    },
    // Found scripting Guerrilla Tactics (`ability-scripting-engineer`). Hidden in Shadow's raw MarvelCDB
    // `text`/`real_text` says "...deal 1 addition indirect damage to the first player." — "addition" for
    // "additional". Confirmed against the card's own scan (`assets/card-art/bundles/cards/27144.png`): "...deal 1
    // additional indirect damage to the first player."
    {
      code: "27144",
      reason:
        'Hidden in Shadow\'s raw text reads "...deal 1 addition indirect damage..." — "addition" for "additional" ' +
        '— while the card\'s own scan prints "additional".',
      evidence:
        'card scan assets/card-art/bundles/cards/27144.png: "(In expert mode, deal 1 additional indirect damage ' +
        'to the first player.)"',
      textReplace: {
        find: "deal 1 addition indirect damage to the first player",
        replace: "deal 1 additional indirect damage to the first player",
      },
    },
  ],

  errata: [
    // RRG 1.8 p. 67, "Manipulated Mind (#171)": MarvelCDB's text is already current (its own `errata` field reads
    // 'Added "Attached ally engages its controller." (RRG 1.5)'); the print (scan 27171.png) reads "… with the lowest
    // cost. If you cannot, this card gains surge."
    {
      code: "27171",
      version: "RRG 1.5",
      changedFields: ["text"],
      note: 'Added "Attached ally engages its controller."',
      evidence:
        'RRG 1.8 p. 67, "Manipulated Mind (#171)": "Should read: \'When Revealed: Attach to the ally you control with ' +
        "the lowest cost. Attached ally engages its controller. Otherwise, this card gains surge.'\" Printed text from " +
        "the card scan, 27171.png.",
      printedReplace: {
        find: "Attached ally engages its controller. Otherwise, this card gains surge.",
        replace: "If you cannot, this card gains surge.",
      },
    },
  ],

  scriptingNotes: {},

  cardNotes: {
    // docs/phase7-wave5.md §1.9: Sand Clone prints "X is equal to the number of sand counters on City Streets."
    // (MarvelCDB sends `attack: -1`, its printed-X encoding).
    "27067": "ATK X: X is equal to the number of sand counters on City Streets (own printed ability text).",
    // docs/phase7-wave5.md §4 Q14: raw text "Uses (2[per_hero] notoriety counters)" (27174a, standard) /
    // "Uses (3[per_hero] notoriety counters)" (27174b, expert) confirmed against the Hall of Heroes card images of
    // both faces, 2026-09-26. No correction needed.
    "27174a":
      "Uses counts confirmed from the card images of both faces: 2[per_hero] standard, 3[per_hero] expert (docs/phase7-wave5.md §4 Q14).",
    // Found scripting the Sinister Six's own encounter attachments (`ability-scripting-engineer`). Heightened
    // Morale prints "+X ATK" in its stat box (MarvelCDB sends `attack: -1`, its printed-X encoding) with "X is
    // equal to the number of villains in play." in its own text — `AttachmentCard.statModifiers.atk` is a fixed
    // number with no "X", so `normalizeEncounterCard`'s attachment branch omits it (own comment there) and the
    // dynamic bonus is a scripted ability instead (`27103.heightened-morale-constant-2`,
    // `wave5/sm/sinister-six/encounter-attachments.ts`).
    "27103":
      "ATK X: X is equal to the number of villains in play (own printed ability text); no statModifiers.atk — scripted instead.",
  },

  scenarios: [
    // Sandman (MC27 p. 9). Single villain, ordinary Core-style shape.
    {
      id: "sandman",
      name: "Sandman",
      villainSetCode: "sandman",
      additionalEncounterSetCodes: ["city_in_chaos"],
      recommendedModularSetCodes: ["down_to_earth"],
      standardSetCodes: ["standard"],
      expertSetCodes: ["expert"],
      villainStages: { standard: [1, 2], expert: [2, 3] },
      modularSetCount: 1,
      evidence:
        'MC27 p. 9: "Villain Deck: Sandman (I), Sandman (II)" ("Remove Sandman (I) and add Sandman (III) for ' +
        'expert mode."), "Main Scheme Deck: Hapless Pedestrians (1A/1B)", "Encounter Deck: Sandman, City in ' +
        'Chaos, Down to Earth, and Standard encounter sets." — the box has no `card_set_code` of its own named ' +
        '"standard"/"expert"; both reuse Core\'s own "standard"/"expert" encounter sets (core.ts\'s scenarios), ' +
        'the Standard set per this Setup\'s own printed "Standard encounter sets", the Expert set per RRG 1.8 ' +
        '"Expert Mode" (p. 28, "add the Expert encounter set to encounter deck").',
    },
    // Venom (MC27 p. 11).
    {
      id: "venom",
      name: "Venom",
      villainSetCode: "venom",
      additionalEncounterSetCodes: ["symbiotic_strength"],
      recommendedModularSetCodes: ["down_to_earth"],
      standardSetCodes: ["standard"],
      expertSetCodes: ["expert"],
      villainStages: { standard: [1, 2], expert: [2, 3] },
      modularSetCount: 1,
      evidence:
        'MC27 p. 11: "Villain Deck: Venom (I), Venom (II)" ("Remove Venom (I) and add Venom (III) for expert ' +
        'mode."), "Main Scheme Deck: \\"Leave Us Alone!\\" (1A/1B)", "Encounter Deck: Venom, Down to Earth, ' +
        'Symbiotic Strength, and Standard encounter sets." Not yet fully playable standalone: the boost-cards-on-' +
        "an-identity mechanic (docs/phase7-wave5.md §3.6 — open). Standard/Expert sets are Core's own (reused " +
        "across the box, see Sandman's evidence above).",
    },
    // Mysterio (MC27 p. 13). Two-stage main scheme deck (Maze of Mirrors → Edge of Reality).
    {
      id: "mysterio",
      name: "Mysterio",
      villainSetCode: "mysterio",
      additionalEncounterSetCodes: ["personal_nightmare"],
      recommendedModularSetCodes: ["whispers_of_paranoia"],
      standardSetCodes: ["standard"],
      expertSetCodes: ["expert"],
      villainStages: { standard: [1, 2], expert: [2, 3] },
      modularSetCount: 1,
      evidence:
        'MC27 p. 13: "Villain Deck: Mysterio (I), Mysterio (II)" ("Remove Mysterio (I) and add Mysterio (III) ' +
        'for expert mode."), "Main Scheme Deck: Maze of Mirrors (1A/1B), Edge of Reality (2A/2B)", "Encounter ' +
        'Deck: Mysterio, Personal Nightmare, Whispers of Paranoia, and Standard encounter sets." Not yet fully ' +
        "playable standalone: encounter cards living in a player's deck/hand/discard pile (docs/phase7-wave5.md " +
        "§3.5 — open). Standard/Expert sets are Core's own (reused across the box, see Sandman's evidence above).",
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
      standardSetCodes: ["standard"],
      expertSetCodes: ["expert"],
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
        "§3.1, §3.2 — open). Standard/Expert sets are Core's own (reused across the box, see Sandman's evidence " +
        "above).",
    },
    // Venom Goblin (MC27 p. 17). Four lettered main scheme stages (§1.1), one shared with the glider counter.
    {
      id: "venom-goblin",
      name: "Venom Goblin",
      villainSetCode: "venom_goblin",
      additionalEncounterSetCodes: ["symbiotic_strength"],
      recommendedModularSetCodes: ["goblin_gear"],
      standardSetCodes: ["standard"],
      expertSetCodes: ["expert"],
      villainStages: { standard: [1, 2], expert: [2, 3] },
      modularSetCount: 1,
      evidence:
        'MC27 p. 17: "Villain Deck: Venom Goblin (I), Venom Goblin (II)" ("Remove Venom Goblin (I) and add Venom ' +
        'Goblin (III) for expert mode."), "Main Scheme Deck: Skies Over New York (A), Lower Manhattan (B), ' +
        'Midtown Manhattan (C), Upper Manhattan (D)", "Encounter Deck: Venom Goblin, Symbiotic Strength, Goblin ' +
        'Gear, and Standard encounter sets." Not yet playable: the focused/glider main scheme mechanism ' +
        "(docs/phase7-wave5.md §3.3, §3.4, §3.9 — open). Standard/Expert sets are Core's own (reused across the " +
        "box, see Sandman's evidence above).",
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
  // wave 4's six art-less MTS faces used. Both faces are now local scans supplied by the maintainer (2026-09-26),
  // trimmed by `scripts/fetch_card_art.py`'s own `trim` into `bundles/cards/27102a.png` / `27102b.png`, which
  // `withLocalArt` picks up, so no `artUnavailable` entry remains.
};
