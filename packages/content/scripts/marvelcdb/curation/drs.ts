/**
 * Doctor Strange Hero Pack curation. Evidence abbreviations:
 * - "raw": the pack's own cached raw record (`packages/content/raw/marvelcdb/drs.json`).
 * - "deck photo": the Doctor Strange Deck title-card back, printed decklist
 *   (https://hallofheroeslcg.com/wp-content/uploads/2020/06/doctorstrangestarterdeck.jpg, linked from the Hall of
 *   Heroes Doctor Strange page), viewed for verification only — not downloaded into the repo.
 * - "phase7 §N": docs/phase7-wave1.md section N.
 */
import type { PackCuration } from "./types.ts";

export const DRS_CURATION: PackCuration = {
  packCode: "drs",
  cycle: { id: "wave1", name: "Wave 1", order: 1 },
  pack: {
    name: "Doctor Strange",
    releaseDate: "2020-07-03",
    releaseDateSource: "Hall of Heroes Doctor Strange page (https://hallofheroeslcg.com/stephen-strange-doctor-strange/): \"Release date: July 3, 2020 (originally May, 2020)\"",
  },
  outDir: "src/data/drs",
  exportPrefix: "DRS",

  corrections: [],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],

  // The Invocation deck (docs/phase7-wave1.md §1.9): five Special-only events, never listed in the 40-card player
  // deck. MarvelCDB files them under `doctor_strange_invocation_deck` with no `deck_limit` and no identity link;
  // curation forces deckLimit 0 and separateDeck "Invocation" for each and lists them on 09001a's `separateDecks`.
  separateDecks: [
    {
      identityCode: "09001a",
      deckName: "Invocation",
      cardCodes: ["09032", "09033", "09034", "09035", "09036"],
    },
  ],

  starterDecks: [
    {
      id: "drs-protection",
      name: "Doctor Strange (Protection) — Hero Pack starter deck",
      identityCode: "09001a",
      aspect: "protection",
      cards: {
        "09002": 1, "09003": 2, "09004": 2, "09005": 2, "09006": 1, "09007": 2, "09008": 1, "09009": 1, "09010": 2, "09011": 1,
        "09012": 1, "09013": 1, "09014": 1, "09015": 3, "09016": 3, "09017": 2, "09018": 2, "09019": 1, "09020": 3,
        "09021": 3, "09022": 1, "09023": 1, "09024": 1, "09025": 1, "09026": 1,
      },
      obligationCode: "09027",
      nemesisCodes: ["09028", "09029", "09030", "09031"],
      verified: true,
      sources: [
        "Doctor Strange Deck title-card back, printed decklist (https://hallofheroeslcg.com/wp-content/uploads/2020/06/doctorstrangestarterdeck.jpg, linked from https://hallofheroeslcg.com/stephen-strange-doctor-strange/)",
      ],
      note:
        "The Invocation deck (Crimson Bands of Cyttorak, Images of Ikonn, Seven Rings of Raggadorr, Vapors of Valtorr, Winds of Watoomb, 09032-09036) is printed on the deck photo under its own \"Invocation Deck\" heading, separate from the 40-card player deck list above — per docs/phase7-wave1.md §1.9 it is not listed in `cards` at all; it comes from the identity's `separateDecks`.",
    },
  ],
};
