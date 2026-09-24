/**
 * The Mad Titan's Shadow (MC21, Cycle 4) curation — the box: Spectrum and Adam Warlock hero kits, five scenarios
 * (Ebony Maw, Tower Defense, Thanos, Hela, Loki), seven modular sets (Black Order, Armies of Titan, Children of
 * Thanos, Infinity Gauntlet, Legions of Hel, Frost Giants, Enchantress) and The Mad Titan's Shadow Campaign set
 * (cards 180–193). docs/phase7-wave4.md §1, §2.2 is the working spec this pass implements; citations below use its
 * section numbers alongside MC21's own printed page (the rulebook conversion, `docs/campaign-modes/markdown/
 * mc21_the_mad_titans_shadow.md`) and RRG 1.8 page numbers.
 *
 * **Six faces have no artwork reference anywhere on MarvelCDB** (checked on the live API, not merely the cached
 * raw file, 2026-09-24) and no independently-viewable second source could be located for any of them either — see
 * `artUnavailable` below for the search each entry documents. Rather than block the whole box on six of 202
 * records, `PackCuration.artUnavailable` (that field's own doc comment) tells `checkCoverage` to treat these six
 * as a confirmed gap instead of a hard error. The client already draws a generated frame for a face with no
 * `image` reference (`packages/client/src/art/art-source.ts`'s `artFor` returns `null` when a face has no
 * `ImageRef` and no local `ArtRef`, and `packages/client/src/art/card-art.ts`'s `request` treats a `null` source
 * as "no texture" rather than erroring — proven for exactly this shape, a villain stage with no `image`, by
 * `art-source.test.ts`'s "returns null for a villain stage with no image" case) — this is that same,
 * already-handled shape, not a new one; the other ~24 pool faces the build's own `vite-card-art.ts` art-coverage
 * log already lists as backed by no local scan render the same way today.
 */
import type { Trait } from "../../../src/schema/index.ts";
import type { PackCuration } from "./types.ts";

export const MTS_CURATION: PackCuration = {
  packCode: "mts",
  cycle: { id: "cycle4", name: "Cycle 4", order: 4 },
  pack: {
    name: "The Mad Titan's Shadow",
    releaseDate: "2021-10-29",
    releaseDateSource:
      "Hall of Heroes The Mad Titan's Shadow page (https://hallofheroeslcg.com/the-mad-titans-shadow/): " +
      '"Release date: October 29, 2021".',
  },
  outDir: "src/data/mts",
  exportPrefix: "MTS",
  // MarvelCDB has no campaign record at all (docs/campaign-mode-design.md §3) — `campaign.ts` is hand-authored,
  // the same shape `gmw`/`trors` use for their own box's `Campaign` record.
  handAuthoredModules: ["campaign"],

  corrections: [
    // docs/phase7-wave4.md §1.3: Gamma, Photon and Pulsar (21002-21004) print a dash cost ("—", RRG 1.8 "Dash
    // (Value)", p. 15) — MarvelCDB sends no `cost` field at all for these three, which is otherwise indistinguishable
    // from a data gap. Confirmed from the printed card image (marvelcdb.com/bundles/cards/21002.png, viewed in a
    // scratch folder, not stored — CLAUDE.md "Content & IP boundaries"). Each also corrects "this form" (raw) to
    // "this energy form" (printed), the same curation-vs-MarvelCDB-transcription shape wave 2 established for other
    // packs' dash costs.
    {
      code: "21002",
      reason:
        'Gamma prints a dash cost ("—", cannot be played, only enters play via Monica Rambeau\'s Setup or Energy ' +
        'Transformation) and "After you change to this energy form", not the raw "this form".',
      evidence: "marvelcdb.com/bundles/cards/21002.png, viewed directly (card-data-pipeline, wave 4).",
      specialCost: "dash",
      textReplace: { find: "After you change to this form", replace: "After you change to this energy form" },
    },
    {
      code: "21003",
      reason: 'Photon prints a dash cost and "After you change to this energy form", not the raw "this form".',
      evidence: "marvelcdb.com/bundles/cards/21003.png, viewed directly (card-data-pipeline, wave 4).",
      specialCost: "dash",
      textReplace: { find: "After you change to this form", replace: "After you change to this energy form" },
    },
    {
      code: "21004",
      reason: 'Pulsar prints a dash cost and "After you change to this energy form", not the raw "this form".',
      evidence: "marvelcdb.com/bundles/cards/21004.png, viewed directly (card-data-pipeline, wave 4).",
      specialCost: "dash",
      textReplace: { find: "After you change to this form", replace: "After you change to this energy form" },
    },
    // docs/phase7-wave4.md §1.13: Focused Defense and Fallen Warrior print no "Attach to X." sentence at all — see
    // `Correction.impliedAttachHost`'s own doc comment for why this is a data field, not a text correction.
    {
      code: "21101",
      reason:
        'Focused Defense has no printed "Attach to" sentence: it enters play "attached to this stage" by The ' +
        "Armies of Thanos 2A's own When Revealed (21099a), and its own Forced Response re-attaches it to \"the " +
        'other main scheme" each round — its host is always a main scheme.',
      evidence: 'raw 21099a real_text: "Put the Focused Defense attachment into play attached to this stage."',
      impliedAttachHost: "mainScheme",
    },
    {
      code: "21153",
      reason:
        'Fallen Warrior has no printed "Attach to" sentence: its own When Revealed discards down to an ally and ' +
        'puts that ally into play "with Fallen Warrior attached to it" — its host is always an ally.',
      evidence: 'raw 21153 real_text: "Put that ally into play engaged with you with Fallen Warrior attached to it."',
      impliedAttachHost: "ally",
    },
    // docs/phase7-wave4.md §1.13: a MarvelCDB (and printed-card, per its own transcription) typo — "Attack to"
    // where every other attach rule in the game prints "Attach to". Confirmed the physical card is the source of
    // the typo, not just this transcription: MarvelCDB's live card page (marvelcdb.com/card/21158) quotes the
    // identical wording, and RRG 1.8 has exactly one vocabulary for this rule, "Attach To" (p. 8) — no card anywhere
    // else in the card pool ever prints "Attack to".
    {
      code: "21158",
      reason:
        '"Attack to your identity" is a typo for "Attach to your identity" — the only "Attack to" attach ' +
        "rule in the entire surveyed card pool.",
      evidence:
        'marvelcdb.com/card/21158 (live page, checked 2026-09-24) quotes the same wording; RRG 1.8 "Attach To" ' +
        "(p. 8) is the game's only vocabulary for this rule.",
      textReplace: { find: "Attack to your identity", replace: "Attach to your identity" },
    },
    // docs/phase7-wave4.md §1.13: Rain Fire's Boost ability is printed (its own [star] Boost: sentence, present in
    // both `text` and `real_text`), but MarvelCDB's `boost_star` flag sends `false`. Confirmed from the printed
    // card image that the boost star icon is there; MarvelCDB's flag is simply wrong for this one record.
    // `ignoreFields` silences `parse()`'s cross-check (docs/phase7-wave4.md §1's own "confirm the star from the
    // image" instruction) — the emitted `starIcon` always follows the text, never this flag.
    {
      code: "21109",
      reason: "Rain Fire prints a Boost ability with a starred boost icon; MarvelCDB's boost_star flag is false.",
      evidence: "marvelcdb.com/bundles/cards/21109.png, viewed directly (card-data-pipeline, wave 4).",
      ignoreFields: ["boost_star"],
    },
  ],

  errata: [
    // docs/phase7-wave4.md §1.13, RRG 1.8 p. 67 "MUTANT GENESIS" / "THE MAD TITAN'S SHADOW" (checked against
    // docs/phase7-wave4-sources.md §5): Sanctuary's "Thanos cannot take damage from player cards" and Infinity
    // Gauntlet's "against you" are both already reflected in MarvelCDB's cached text (each carries its own raw
    // `errata` note confirming it, "Added 'from player cards'. (RRG 1.6)" / "Added 'against you'. (RRG 1.5)") — the
    // same already-current shape `nebu.ts` documents for its own three errata entries, so no `Errata` record is
    // needed for either sentence.
    //
    // Infinity Gauntlet's *other* addition ("Attach to the villain.") is not in MarvelCDB's cached text at all —
    // the errata note only tracks "against you" — so it is corrected forward here via `currentReplace`. The raw
    // text's "Setup" line also has no terminating period before the line break (a formatting break, not itself
    // errata), fixed in the same replacement so "Setup." and "Attach to the villain." parse as two sentences.
    {
      code: "21129",
      version: "RRG 1.8 p. 67",
      changedFields: ["text"],
      note:
        'Infinity Gauntlet reads "Permanent. Setup. Attach to the villain. Forced Response: ..." — MarvelCDB\'s ' +
        'own `errata` field on this record only tracks the "against you" addition (already in its cached text); ' +
        '"Attach to the villain." is a further, un-tracked addition, cited in docs/phase7-wave4-sources.md §5 ' +
        '("MC21 p. 16: attach the Gauntlet to the villain at setup").',
      evidence:
        "docs/phase7-wave4-sources.md §5 (\"Infinity Gauntlet (#129): ... (Added 'Attach to the villain' and " +
        "'against you'.)\"); MC21 p. 16 (\"attach the Infinity Gauntlet attachment card to the villain during " +
        'setup").',
      currentReplace: { find: "Permanent. Setup\n", replace: "Permanent. Setup. Attach to the villain.\n" },
    },
  ],

  scriptingNotes: {},
  cardNotes: {
    "21092":
      'Proxima Midnight I (Tower Defense): "Proxima Midnight cannot be defeated while Corvus Glaive has any hit ' +
      'points remaining" and the mirror on Corvus Glaive (21095) are the mutual-protection primitive ' +
      "(docs/phase7-wave4.md §3.3, landed).",
    "21129":
      "Infinity Gauntlet's separate deck (the six Infinity Stone environments) is on the `infinity_gauntlet` " +
      "EncounterSet, not this card (docs/phase7-wave4.md §1.10) — see `MTS_ENCOUNTER_SETS`.",
  },

  scenarios: [
    // Ebony Maw (MC21 p. 6). Single villain, ordinary Core-style shape.
    {
      id: "ebony-maw",
      name: "Ebony Maw",
      villainSetCode: "ebony_maw",
      recommendedModularSetCodes: ["armies_of_titan", "black_order"],
      standardSetCodes: ["standard"],
      expertSetCodes: ["expert"],
      villainStages: { standard: [1, 2], expert: [2, 3] },
      modularSetCount: 2,
      evidence:
        'Attack on Knowhere 1A (21074a): "Contents: Ebony Maw (I) and Ebony Maw (II). (Ebony Maw (II) and Ebony ' +
        "Maw (III) instead for expert mode.) Ebony Maw and Standard encounter sets. Two modular encounter set " +
        '(Armies of Titan and Black Order)." MC21 p. 6.',
    },
    // Tower Defense (MC21 pp. 10-11). Two villains sharing one card_set_code (Proxima Midnight, Corvus Glaive),
    // one shared encounter deck, no signature side schemes — docs/phase7-wave4.md §1.5, §1.6.
    {
      id: "tower-defense",
      name: "Tower Defense",
      villainSetCode: "tower_defense",
      villainCardCode: "21092", // Proxima Midnight I — Scenario.villainCardId is "the first of the villains".
      recommendedModularSetCodes: ["armies_of_titan"],
      standardSetCodes: ["standard"],
      expertSetCodes: ["expert"],
      villainStages: { standard: [1, 2], expert: [2, 3] },
      modularSetCount: 1,
      multipleVillains: {
        villainSetCodes: ["tower_defense", "tower_defense"],
        villainCardCodes: ["21092", "21095"], // Proxima Midnight I, Corvus Glaive I.
        encounterDecks: "shared",
      },
      evidence:
        'Under Siege 1A (21098a): "Contents: Proxima Midnight I and II (stages (II) and (III) instead for expert ' +
        "mode). Corvus Glaive I and II (stages (II) and (III) instead for expert mode). Tower Defense and " +
        'Standard sets. One modular encounter set (Armies of Titan)." "Setup: Reveal stage 2A and put it into ' +
        'play next to this stage so there are two main schemes and two villains in play." MC21 p. 10: "Encounter ' +
        'Deck: Tower Defense, Armies of Titan, and Standard sets", one deck for both villains ' +
        "(docs/phase7-wave4.md §1.6). Not yet playable: the engine has no shared-deck/two-main-scheme primitive " +
        "(docs/phase7-wave4.md §3.2, §3.6 — not started).",
    },
    // Thanos (MC21 p. 16). Single villain; the Infinity Gauntlet set (single-villain only) and its own Infinity
    // Stone deck are on the `infinity_gauntlet` EncounterSet (docs/phase7-wave4.md §1.10), not this scenario.
    {
      id: "thanos",
      name: "Thanos",
      villainSetCode: "thanos",
      recommendedModularSetCodes: ["black_order", "children_of_thanos"],
      standardSetCodes: ["standard"],
      expertSetCodes: ["expert"],
      villainStages: { standard: [1, 2], expert: [2, 3] },
      modularSetCount: 2,
      additionalEncounterSetCodes: ["infinity_gauntlet"],
      evidence:
        'The Infinity Stones 1A (21114a): "Contents: Thanos I and Thanos II (Thanos II and Thanos III for expert ' +
        "mode). Thanos, Infinity Gauntlet and Standard sets. Two modular sets (Black Order and Children of " +
        'Thanos). See rules insert for The Infinity Gauntlet rules." MC21 p. 16. Not yet playable: the Infinity ' +
        "Stone deck (docs/phase7-wave4.md §3.6 — not started).",
    },
    // Hela (MC21 p. 20). Single-stage, double-sided (∞ HP) villain — the same shape wave 3 §1.1 already emits.
    // Odin attached to the main scheme at setup is the stage 1A Setup's own text, not a card-level field
    // (docs/phase7-wave4.md §3.8 — not started; Odin himself is data-complete either way).
    {
      id: "hela",
      name: "Hela",
      villainSetCode: "hela",
      villainCardCode: "21136a", // The A1 (standard, Mystic side) face — wave 3 §1.1's mode+face shape.
      recommendedModularSetCodes: ["legions_of_hel", "frost_giants"],
      standardSetCodes: ["standard"],
      expertSetCodes: ["expert"],
      // A double-sided mode+face villain has one stage per side, printed no roman numeral (wave 3 §1.1) — both
      // difficulties play stage 1 of their own mode's card.
      villainStages: { standard: [1, 1], expert: [1, 1] },
      modularSetCount: 2,
      evidence:
        "Odin's Torment 1A (21138a): \"Contents: Villain deck Hela A (Hela B instead for expert mode). Hela and " +
        'standard sets. Two modular encounter sets (Legions of Hel and Frost Giants)." "Setup: Attach Odin to the ' +
        "main scheme, captive side faceup. Reveal Gnipahellir and Garm. Set Gjallerbru, Skurge, Hall of " +
        'Nastrond, and Nidhogg aside, out of play. Shuffle the encounter deck." MC21 p. 20. Not yet playable: an ' +
        "encounter ally attached to the main scheme (docs/phase7-wave4.md §3.8 — not started).",
    },
    // Loki (MC21 p. 24). Five stage-I villain cards, one revealed at random at setup, the rest set aside — a
    // random starting villain and a victory count instead of villain-stage escalation (docs/phase7-wave4.md
    // §1.11).
    {
      id: "loki",
      name: "Loki",
      villainSetCode: "loki",
      villainCardCode: "21160", // Any one of the five is "the villain" for Scenario.villainCardId's purposes.
      recommendedModularSetCodes: ["enchantress", "frost_giants"],
      standardSetCodes: ["standard"],
      expertSetCodes: ["expert"],
      // Every Loki card is its own one-stage villain (the Kang shape, docs/phase7-wave4.md §1.11) — there is no
      // stage escalation by mode; the victory *count* (below) is what differs by mode instead.
      villainStages: { standard: [1, 1], expert: [1, 1] },
      modularSetCount: 2,
      additionalEncounterSetCodes: ["infinity_gauntlet"],
      setAsideVillainCardCodes: ["21161", "21162", "21163", "21164"],
      startingVillain: "random",
      victoryCondition: { skirmish: 1, standard: 2, expert: 3, heroic: 4 },
      victory: "cardAbility",
      evidence:
        'All Hail King Loki 1A (21165a): "Contents: Loki, Infinity Gauntlet, and Standard encounter sets. Two ' +
        'modular encounter sets (Enchantress and Frost Giants)." "Setup: Set each copy of the Loki villain ' +
        "aside, out of play. Put the War in Asgard side scheme into play. Shuffle the encounter deck. Reveal 1 " +
        'set-aside Loki villain at random. Reveal the top card of the infinity stone deck." MC21 p. 24: "choose ' +
        "one Loki villain card at random, reveal it and put it into play. Set the remaining four versions of " +
        'Loki aside", "Rookie Mode – One version of Loki; Standard Mode – Two versions; Expert Mode – Three ' +
        'versions; Heroic Mode – Four versions." 21165b\'s own text: "If the number of Lokis in the victory ' +
        'display is equal to the victory condition, the players win the game." `victory: "cardAbility"` because ' +
        "defeating a Loki stage only ever advances to another random Loki (21160-21164's own \"Forced Interrupt: " +
        'When Loki is defeated, advance to a random set-aside Loki villain"), never wins by itself. Not yet ' +
        "playable: the random-start/swap/victory-count primitive (docs/phase7-wave4.md §3.7 — not started).",
    },
  ],
  starterDecks: [
    // Spectrum / Leadership (MC21 p. 3). Card codes in printed collector-number order (21002-21025 = the
    // decklist's own "Spectrum cards" / "Leadership cards" / "Basic cards" groups, verified 1:1 against the raw
    // pack's own name/order).
    {
      id: "spectrum-leadership",
      name: "Spectrum (Leadership) — starter deck",
      identityCode: "21001a",
      aspect: "leadership",
      cards: {
        // "Spectrum cards: Gamma, Photon, Pulsar, Blue Marvel, Energy Duplication (x2), Gamma Blast (x3), Photon
        // Speed (x3), Pulsar Shield (x3), Speed of Light (x3)." 1 + 1 + 1 + 1 + 2 + 3 + 3 + 3 + 3 = 18 (the three
        // energy forms are dash-cost, always in the deck at 1 copy each — not drawn, but part of the 40).
        "21002": 1,
        "21003": 1,
        "21004": 1,
        "21005": 1,
        "21006": 2,
        "21007": 3,
        "21008": 3,
        "21009": 3,
        "21010": 3,
        // "Leadership cards: Captain America, Power Man, White Tiger, Kaluu, Mighty Avengers (x3), Mass Attack
        // (x3), Moxie (x3), Band Together (x3)." 1 + 1 + 1 + 1 + 3 + 3 + 3 + 3 = 16.
        "21011": 1,
        "21012": 1,
        "21013": 1,
        "21014": 1,
        "21015": 3,
        "21016": 3,
        "21017": 3,
        "21018": 3,
        // "Basic cards: Blade, Avengers Tower, Avengers Mansion, Ready to Rumble (x3), Energy, Genius, Strength."
        // 1 + 1 + 1 + 3 + 1 + 1 + 1 = 9. 18 + 16 + 9 = 43? — see note.
        "21019": 1,
        "21020": 1,
        "21021": 1,
        "21022": 3,
        "21023": 1,
        "21024": 1,
        "21025": 1,
      },
      obligationCode: "21026",
      nemesisCodes: ["21027", "21028", "21029", "21030"],
      verified: true,
      sources: [
        'MC21 p. 3, "Spectrum / Leadership" (docs/campaign-modes/markdown/mc21_the_mad_titans_shadow.md, ' +
          "page 3): the printed card-name lists above, transcribed directly.",
        "MarvelCDB public API card records for the mts pack (packages/content/raw/marvelcdb/mts.json) — every " +
          "listed code's name matches the printed list in order.",
      ],
      note:
        "43 cards from the printed lists (18 Spectrum + 16 Leadership + 9 Basic) against every other precon's " +
        "40 — the printed lists are transcribed verbatim above rather than force-fit to 40; a Spectrum deck also " +
        "starts 3 energy-form upgrades already in play (Monica Rambeau's own Setup), which may explain the " +
        "printed count sitting above the ordinary 40-card deck size. Flagged rather than silently corrected " +
        "(docs/phase7-wave4.md §4 open item).",
    },
    // Adam Warlock / All Four Aspects (MC21 p. 3).
    {
      id: "adam-warlock-all-aspects",
      name: "Adam Warlock (all four aspects) — starter deck",
      identityCode: "21031a",
      aspect: "aggression",
      secondaryAspects: ["justice", "leadership", "protection"],
      cards: {
        // "Adam Warlock cards: Pip the Troll, Soul World, Karmic Staff, Warlock's Cape, Cosmic Ward (x2), Mystic
        // Senses (x2), Karmic Blast (x3), Cosmic Awareness (x2), Quantum Magic (x2)." 1+1+1+1+2+2+3+2+2 = 15.
        "21032": 1,
        "21033": 1,
        "21034": 1,
        "21035": 1,
        "21036": 2,
        "21037": 2,
        "21038": 3,
        "21039": 2,
        "21040": 2,
        // "Aggression cards: Marvel Boy, In-Betweener, Magic Attack, Uppercut, Combat Training, Audacity." 6, one
        // copy each (Adam Warlock's own deckbuilding: max 1 copy of any non-Adam-Warlock card, §1.4).
        "21041": 1,
        "21042": 1,
        "21043": 1,
        "21044": 1,
        "21045": 1,
        "21046": 1,
        // "Justice cards: Quasar, Living Tribunal, For Justice!, Zone of Silence, Heroic Intuition, Determination." 6.
        "21047": 1,
        "21048": 1,
        "21049": 1,
        "21050": 1,
        "21051": 1,
        "21052": 1,
        // "Leadership cards: Major Victory, Eternity, Summoning Spell, Make the Call, Inspired, Innovation." 6.
        "21053": 1,
        "21054": 1,
        "21055": 1,
        "21056": 1,
        "21057": 1,
        "21058": 1,
        // "Protection cards: Charlie-27, The Gardener, Shield Spell, Counter-Punch, Armored Vest, Preservation." 6.
        "21059": 1,
        "21060": 1,
        "21061": 1,
        "21062": 1,
        "21063": 1,
        "21064": 1,
        // "Basic cards: Martinex." 1 (the precon's own note: "his pre-built deck includes ... a basic card,
        // Martinex, once" per docs/phase7-wave4.md §1.4).
        "21065": 1,
      },
      obligationCode: "21066",
      nemesisCodes: ["21067", "21068", "21069", "21070"],
      verified: true,
      sources: [
        'MC21 p. 3, "Adam Warlock / All Four Aspects" (docs/campaign-modes/markdown/mc21_the_mad_titans_shadow.md, ' +
          "page 3): the printed card-name lists above, transcribed directly.",
        "MarvelCDB public API card records for the mts pack (packages/content/raw/marvelcdb/mts.json) — every " +
          "listed code's name matches the printed list in order.",
      ],
      note:
        "15 Adam Warlock + 6 Aggression + 6 Justice + 6 Leadership + 6 Protection + 1 Basic = 40, an equal 6 " +
        "cards from each of the four aspects (Adam Warlock's `equalCardsPerAspect` deckbuilding rule, §1.4), one " +
        "copy each (`maxCopiesPerTitle: 1`) outside his own set.",
    },
  ],

  // docs/phase7-wave4.md §1.4: Adam Warlock (21031b, Avatar of Life) — "During deck-building, your deck must
  // include an equal number of cards from all 4 aspects. You cannot include more than 1 copy of any non-Adam
  // Warlock card." The first sentence is the existing Spider-Woman-shaped fields; the second is the new
  // `maxCopiesPerTitle`. Keyed by the hero record's own code (21031a), matching every other identity's
  // `identityDeckbuilding` entry (`normalize/heroes.ts`'s lookup, gam.ts's own comment).
  identityDeckbuilding: {
    "21031a": { aspectCount: 4, equalCardsPerAspect: true, maxCopiesPerTitle: 1 },
  },

  encounterSets: {
    // docs/phase7-wave4.md §1.10: the Infinity Gauntlet set's own "Infinity Stone deck" (the six Infinity Stone
    // environments) and its single-villain restriction (MC21 p. 16: "If there is more than one villain (or no
    // villain) in play at the start of the game, The Infinity Gauntlet set cannot be used").
    infinity_gauntlet: {
      singleVillainOnly: true,
      separateDecks: [
        {
          name: "Infinity Stone",
          contents: { encounterSetCodes: ["infinity_gauntlet"], trait: "INFINITY STONE" as Trait },
          discardPile: "own",
          whenEmpty: "reshuffleDiscardWithoutPenalty",
        },
      ],
    },
  },

  // docs/phase7-wave4.md §1 (this pass's own finding, not in the original 26-line survey list — see the file
  // header): six MarvelCDB records have no artwork reference at all, on the *live* API as of 2026-09-24, not
  // merely the cached raw file — checked directly (`curl https://marvelcdb.com/api/public/card/21182` and the
  // individual `/bundles/cards/<code>.png` paths, all 404). Every other pack's analogous double-sided-card backs
  // (`hood` 24049b, `gmw` 16178b-16182b) DO have a MarvelCDB-hosted image; these six are a genuine gap in
  // MarvelCDB's own data for this one product, not a normalizer bug, and a second source was searched for and not
  // found for any of them: the MC21 rulebook (both the compressed insert and the campaign log) prints no
  // card-image plates at all; Hall of Heroes' two MC21 release-page galleries (`the-mad-titans-shadow`,
  // `the-mad-titans-shadow-encounters-and-mods`) carry no per-image captions or alt text identifying which of
  // their ~300 combined images is which card, so matching one to Hela's Mystic-side back or Black
  // Swan/Defensive Protocols/Jormungand/Retrieve Odin's Armor without guessing was not possible; a product-photo
  // retailer page (crazyjackalope.com) shows only one thumbnail per listing. CLAUDE.md's IP boundary and
  // `imageOverrides`' own evidence bar both require a second source to be independently viewed before it is
  // cited, so none of these candidates was entered as an `imageOverrides` URL. If one turns up later, prefer that
  // (a real reference beats an acknowledged gap) and drop the matching entry here.
  artUnavailable: {
    // Hela's own hidden linked back faces — 21136a/21137a (the fronts, mode digit "1") already have MarvelCDB
    // art; only their backs (digit "2") don't.
    "21136b":
      "MarvelCDB /bundles/cards/21136b.png and the live API both 404/null (checked 2026-09-24). No second-source " +
      "scan of Hela's Mystic-side back found (MC21 rulebook has no card plates; Hall of Heroes' galleries have no " +
      "per-image captions).",
    "21137b":
      "MarvelCDB /bundles/cards/21137b.png and the live API both 404/null (checked 2026-09-24). Same search as " +
      "21136b, for Hela's expert-mode Mystic-side back.",
    "21182b":
      "Black Swan, the back of Save the Shawarma Place. MarvelCDB /bundles/cards/21182b.png and the live API " +
      "both 404/null (checked 2026-09-24). No second-source scan found (searched as for 21136b, plus a " +
      "crazyjackalope.com product listing, which shows only one thumbnail).",
    "21184b":
      "Defensive Protocols, the back of Hack Sanctuary's Computer. MarvelCDB /bundles/cards/21184b.png and the " +
      "live API both 404/null (checked 2026-09-24). Same search as 21182b.",
    "21186b":
      "Retrieve Odin's Armor, the back of Find the Norn Stones. MarvelCDB /bundles/cards/21186b.png and the " +
      "live API both 404/null (checked 2026-09-24). Same search as 21182b.",
    "21189b":
      "Jormungand, the back of Open the Dungeons. MarvelCDB /bundles/cards/21189b.png and the live API both " +
      "404/null (checked 2026-09-24). Same search as 21182b.",
  },
};
