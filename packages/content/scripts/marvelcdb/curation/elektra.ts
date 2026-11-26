/**
 * Elektra Hero Pack (MC63, cycle 11, Fear No Evil wave) curation. Started as a scan-only pack (MarvelCDB lacked it,
 * every record an added record transcribed from Hall of Heroes previews); MarvelCDB now carries the pack, so the data
 * comes from `raw/marvelcdb/elektra.json` (https://marvelcdb.com/api/public/cards/elektra, 39 records, fetched
 * 2026-11-25) and only the corrections below remain. The old placeholder codes 63040 to 63045 are gone: the obligation
 * is 63028 and the nemesis set 63029 to 63033 (Aka, The Fist Fits in the Hand, Hand Katana, Hand Blademaster, Hand
 * Archer).
 *
 * Evidence: the official card images (1500 x 2150, "Elektra_EN", card images contributed by bluefireF5ran; not wired
 * into the data) were read for the two identity faces, 63011, 63013, 63028 to 63033, 63038 and 63039. Each matched
 * MarvelCDB in text, stats, traits, boost icons and keywords except the one correction below. The rest of the pack was
 * not re-read against an image: the earlier transcription (preview images) and MarvelCDB agree on all of it.
 *
 * - The NINJA deck (Ninja Stars 63002, Ninja Strike 63003, Ninja Vanish 63004, two copies each: set positions 1 to 6)
 *   is a hero-owned deck of encounter-shaped treacheries, modelled as Hercules's Labor deck is (a `separateDecks`
 *   entry with `cardFamily: "encounter"`, no encounter set, `separateDeck: "Ninja"`); MarvelCDB files it under the
 *   `elektra_ninja_deck` set (parent `elektra`), aliased to Elektra's own set by `auxiliaryHeroSetCodes`.
 * - Starter deck: no printed list is available; MarvelCDB decklists 69860 and 70085 agree (see below).
 */
import type { PackCuration } from "./types.ts";

export const ELEKTRA_CURATION: PackCuration = {
  packCode: "elektra",
  cycle: { id: "cycle11", name: "Fear No Evil", order: 11 },
  pack: {
    name: "Elektra",
    releaseDate: "2026-11-13",
    releaseDateSource:
      'Hall of Heroes Elektra Natchios page (https://hallofheroeslcg.com/elektra-natchios/): "Release date: November 13, 2026" (product code MC63en); FFG gives only "November 2026".',
  },
  outDir: "src/data/elektra",
  exportPrefix: "ELEKTRA",

  corrections: [
    {
      code: "63038",
      reason:
        'MarvelCDB drops the cost icon from Moondragon\'s text; the card prints "takes +X consequential damage ([cost]) for this use" (the consequential-damage icon in parentheses, as on her stat boxes).',
      evidence:
        'Official card image Elektra_EN/63038_moondragon.png: "Moondragon gets +X to that power and takes +X consequential damage ([cost]) for this use, where X is equal to the chosen number."',
      textReplace: {
        find: "consequential damage for this use",
        replace: "consequential damage ([cost]) for this use",
      },
    },
    {
      code: "63027",
      reason:
        "MarvelCDB sends no `scheme_amplify` for the reprint, but the card prints the amplify icon centred under the text box, as its original 60031 (whose record carries `scheme_amplify: 1`).",
      evidence:
        "Official card image Elektra_EN/63027_dance_with_the_devil.png (amplify icon under the text); raw/marvelcdb/fne.json 60031 scheme_amplify 1.",
      amplifyIcons: 1,
    },
  ],
  errata: [],

  scriptingNotes: {},
  cardNotes: {
    "63030":
      "The Fist Fits in the Hand: the icon under the text box is the hazard icon (MarvelCDB scheme_hazard 1; the card shows a black plus-and-card icon), 3 per hero starting threat, 3 boost icons.",
  },

  scenarios: [],
  starterDecks: [
    {
      id: "elektra-aggression",
      name: "Elektra (Aggression) — Elektra Hero Pack starter deck",
      identityCode: "63001a",
      aspect: "aggression",
      cards: {
        "63005": 1, // Daredevil
        "63006": 2, // Acrobatic Prowess
        "63007": 2, // Killer Blow
        "63008": 2, // Move Unseen
        "63009": 2, // Sai Strike
        "63010": 1, // Resurrection Altar
        "63011": 1, // White Tiger
        "63012": 2, // Elektra's Sai
        "63013": 1, // History with the Hand
        "63014": 1, // Stealth Mastery
        "63015": 1, // Shang-Chi
        "63016": 1, // Black Cat
        "63017": 3, // Combo Move
        "63018": 3, // Chain Reaction
        "63019": 3, // Nerve Strike
        "63020": 3, // Flow of Battle
        "63021": 3, // Shuriken
        "63022": 1, // Stone
        "63023": 3, // Hunting Shadows
        "63024": 1, // Energy
        "63025": 1, // Genius
        "63026": 1, // Strength
        "63027": 1, // Dance with the Devil
      },
      obligationCode: "63028", // Conditioned by the Hand
      nemesisCodes: ["63029", "63030", "63031", "63032", "63033"], // Aka, The Fist Fits in the Hand, Hand Katana, Hand Blademaster, Hand Archer
      verified: false,
      sources: [
        'STAND-IN, NOT A PRINTED LIST: no decklist card or insert page for Elektra is available (the Hall of Heroes page prints "Starter Deck" as plain text). Counts follow MarvelCDB public decklist 69860 ("Elektra - precon deck", posted 2026-11-16) and decklist 70085 ("Elektra Precon", posted 2026-11-21, "Elektra\'s Preconstructed deck"), which list identical slots (40 cards, aggression). Every copy count is within the record\'s quantity. Replace with the printed list when the owner supplies it.',
      ],
      note: "40 cards: 15 Elektra, 17 Aggression, 8 basic. Unverified against the printed card.",
    },
  ],

  // Elektra's NINJA deck (alter-ego 1B: "begins the game with a NINJA deck"). Encounter-shaped cards, never in a hand,
  // discard pile or the player deck; shuffled into the encounter deck one at a time and returned by their own Boost.
  separateDecks: [
    {
      identityCode: "63001a",
      deckName: "Ninja",
      cardCodes: ["63002", "63003", "63004"],
      topCardFaceup: false,
      discardPile: "none",
      whenEmpty: "stayEmpty",
      cardFamily: "encounter",
    },
  ],
  auxiliaryHeroSetCodes: { elektra_ninja_deck: "elektra" },
};
