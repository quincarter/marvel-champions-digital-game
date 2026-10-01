/**
 * Phoenix (Jean Grey) Hero Pack (Cycle 6) curation.
 *
 * One hand correction: Phoenix Force (34002a/34002b) prints a dash cost — it is a "Permanent" identity upgrade
 * that enters play via Jean Grey's own hero-kit text, not paid for from hand. MarvelCDB gives it `cost: null`
 * on both faces. Confirmed printed dash from the card's own MarvelCDB listing ("Cost: —"), the same evidence
 * standard used for trors' Hydra Campaign upgrades (docs/phase7-wave2.md §1.3/§5.1's `specialCost` mechanism).
 *
 * Burning Hunger (34002's obligation, 34028) has no `text`/`real_text` at all in MarvelCDB's raw record, so its
 * text is supplied from the card scan `assets/card-art/bundles/cards/34028.png` through the `find: ""` form of
 * `textReplace` (the Nova "Bring the War!" precedent; no new Correction field was needed).
 *
 * **Precon:** transcribed 2026-10-01 from the pack's own printed decklist card (see `sources` below); no scenario data (hero pack).
 */
import type { PackCuration } from "./types.ts";

export const PHOENIX_CURATION: PackCuration = {
  packCode: "phoenix",
  cycle: { id: "cycle6", name: "Cycle 6", order: 6 },
  pack: {
    name: "Phoenix",
    releaseDate: "2022-09-30",
    releaseDateSource:
      'Hall of Heroes Jean Grey/Phoenix page (https://hallofheroeslcg.com/jean-grey-phoenix/): "Release date: September 30, 2022"',
  },
  outDir: "src/data/phoenix",
  exportPrefix: "PHOENIX",

  corrections: [
    {
      code: "34002a",
      reason:
        'Phoenix Force is a "Permanent" upgrade that enters play through Jean Grey\'s own hero-kit text (Setup/flip, not played from hand): raw sends no `cost` at all on either face (34002a/34002b) — the printed-dash pattern (RRG 1.8 "Dash (Value)", p. 15), not a data gap.',
      evidence: 'MarvelCDB card listing (marvelcdb.com/card/34002a), "Cost: —"',
      specialCost: "dash",
    },
    {
      code: "34003",
      reason:
        'MarvelCDB transcribes the second ability as "Response"; the card prints "Forced Interrupt: When Cyclops leaves play, remove 2 power counters from Phoenix Force." (docs/phase7-wave6.md §6.1).',
      evidence: "Card scan assets/card-art/bundles/cards/34003.png (Phoenix 2/16, Cyclops ally), read 2026-10-01.",
      textReplace: {
        find: "Response: When Cyclops leaves play",
        replace: "Forced Interrupt: When Cyclops leaves play",
      },
    },
    {
      code: "34016",
      reason:
        'MarvelCDB reads "+1 THW point"; the card prints "Attached ally gets +1 THW and +2 hit points." (docs/phase7-wave6.md §6.1).',
      evidence: "Card scan assets/card-art/bundles/cards/34016.png (Phoenix 16/16, Mission Training), read 2026-10-01.",
      textReplace: { find: "+1 THW point and", replace: "+1 THW and" },
    },
    {
      code: "34031",
      reason:
        'MarvelCDB\'s raw text for Fiery Rage is only "Peril.", dropping the reminder text and the When Revealed — transcribed verbatim from the scan (docs/phase7-wave6.md §6.1).',
      evidence:
        'Card scan assets/card-art/bundles/cards/34031.png (Phoenix Nemesis 3/5, Treachery), read 2026-10-01: "Peril. (While you are resolving this card, other players cannot help you.) When Revealed: If Dark Phoenix is in play, she activates against you. If Dark Phoenix is not in play, place 1 threat on Consume the World and this card gains surge."',
      textReplace: {
        find: "Peril.",
        replace:
          "Peril. (While you are resolving this card, other players cannot help you.)\nWhen Revealed: If Dark Phoenix is in play, she activates against you. If Dark Phoenix is not in play, place 1 threat on Consume the World and this card gains surge.",
      },
    },
    {
      code: "34028",
      reason:
        "MarvelCDB's raw record for Burning Hunger has no `text` or `real_text` field at all — transcribed verbatim from the card scan. The flavour line is italic on the card, kept as the first line.",
      evidence:
        "Card scan assets/card-art/bundles/cards/34028.png (Phoenix 28, Obligation), read 2026-10-01; UNLEASHED and RESTRAINED are bold-italic trait names on the scan.",
      textReplace: {
        find: "",
        replace:
          "Give to the Jean Grey player.\nWhen Revealed: If you have the UNLEASHED trait, search the encounter deck, discard pile, and set-aside area for Dark Phoenix and reveal her. Then, remove Burning Hunger from the game. If you have the RESTRAINED trait, remove 1 power counter from Phoenix Force and this card gains surge. Discard this card.",
      },
    },
  ],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [
    {
      id: "phoenix-justice",
      name: "Phoenix (Justice) — Phoenix Hero Pack starter deck",
      identityCode: "34001a",
      aspect: "justice",
      cards: {
        "34002a": 1, // Phoenix Force
        "34003": 1, // Cyclops
        "34004": 1, // White Hot Room
        "34005": 1, // Phoenix Suit
        "34006": 1, // Rise from the Ashes
        "34007": 1, // Telekinetic Shield
        "34008": 1, // Mental Paralysis
        "34009": 1, // Mind Control
        "34010": 2, // Telekinetic Attack
        "34011": 2, // Psychic Blast
        "34012": 2, // Telepathic Trickery
        "34013": 2, // Phoenix Firebird
        "34014": 1, // Banshee
        "34015": 1, // Marvel Girl
        "34016": 3, // Mission Training
        "34017": 3, // Psychic Manipulation
        "34018": 3, // Mutant Peacekeepers
        "34019": 3, // Swift Retribution
        "34020": 2, // Passion for Justice
        "34021": 1, // Storm
        "34022": 1, // Cerebro
        "34023": 1, // Psychic Rapport
        "34024": 3, // Down Time
        "34025": 1, // Energy
        "34026": 1, // Genius
        "34027": 1, // Strength
      },
      obligationCode: "34028",
      nemesisCodes: ["34029", "34030", "34031"],
      verified: true,
      sources: [
        'Phoenix Hero Pack printed decklist card, "Phoenix Deck" (https://hallofheroeslcg.com/wp-content/uploads/2022/09/jean.jpg, the "Starter Deck" link on the Hall of Heroes Jean Grey/Phoenix page, https://hallofheroeslcg.com/jean-grey-phoenix/), transcribed 2026-10-01 from a photo of the card',
      ],
      note: "Single printed source (no MarvelCDB decklist found); every code and quantity cross-checked against raw/marvelcdb/phoenix.json quantity/deck_limit. The list totals 41 player cards (legal, 40-50).",
    },
  ],
};
