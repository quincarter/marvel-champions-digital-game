/**
 * X-23 (Laura Kinney) Hero Pack (Cycle 7) curation.
 *
 * - **X-23's Claws (43002, upgrade): dash cost, confirmed.** A Permanent signature weapon, exhausted for its own
 *   Hero Action rather than played for a resource cost. MarvelCDB sends no `cost` at all; confirmed against the
 *   card's own MarvelCDB listing ("Cost: —").
 * - **Puncture Wound (43012, attachment): `HostQualifiers.attackedThisTurnBy`**, landed by
 *   `game-rules-architect` (docs/phase7-wave2.md §7.4) — "Attach to an enemy that X-23 or Honey Badger attacked
 *   this turn" now parses to `{ kind: "qualified", category: "enemy", attackedThisTurnBy: ["X-23", "Honey
 *   Badger"] }`. **Data only, per the architect's own note:** the engine records no per-turn attack history yet,
 *   so this qualifier resolves to no legal host until it does — 43012 carries correct data but must not be
 *   marked playable before that engine primitive lands (docs/phase7-wave1.md §3.1).
 */
import type { PackCuration } from "./types.ts";

export const X23_CURATION: PackCuration = {
  packCode: "x23",
  cycle: { id: "cycle7", name: "NeXt Evolution", order: 7 },
  pack: {
    name: "X-23",
    releaseDate: "2023-11-17",
    releaseDateSource:
      'Hall of Heroes X-23/Laura Kinney page (https://hallofheroeslcg.com/x-23-laura-kinney/): "Release date: November 17, 2023"',
  },
  outDir: "src/data/x23",
  exportPrefix: "X23",

  corrections: [
    {
      code: "43002",
      reason:
        'X-23\'s Claws is a Permanent signature weapon, exhausted for its own Hero Action rather than played for a resource cost: raw sends no `cost` at all — the printed-dash pattern (RRG 1.8 "Dash (Value)", p. 15), not a data gap.',
      evidence: 'MarvelCDB card listing (marvelcdb.com/card/43002), "Cost: —"',
      specialCost: "dash",
    },
  ],
  errata: [
    {
      code: "43036",
      version: "RRG 1.8",
      changedFields: ["text"],
      note: 'Front Line Specialist: "Your hero gets +4 hit points." is now "Your identity gets +4 hit points." MarvelCDB carries the current wording; the scan prints "hero".',
      evidence:
        'RRG 1.8 p. 69, X-23 Hero Pack (#36) errata ("Changed \'hero\' to \'identity\'"); scan 43036.png prints "Your hero gets +4 hit points."; MarvelCDB errata "Changed hero to identity." (RRG 1.6).',
      printedReplace: { find: "Your identity gets +4 hit points.", replace: "Your hero gets +4 hit points." },
    },
  ],

  scriptingNotes: {},
  cardNotes: {
    "43012":
      "attackedThisTurnBy is data only (docs/phase7-wave2.md §7.4) — the engine has no per-turn attack history yet, so this card resolves to no legal host and must not be marked playable until that primitive lands.",
  },

  scenarios: [],
  starterDecks: [
    {
      id: "x-23-aggression",
      name: "X-23 (Aggression) — X-23 Hero Pack starter deck",
      identityCode: "43001a",
      aspect: "aggression",
      cards: {
        "43002": 1, // X-23's Claws
        "43003": 1, // Honey Badger
        "43004": 2, // Animal Instinct
        "43005": 3, // Claw Mastery
        "43006": 2, // Regenerative Longevity
        "43007": 1, // Sisterly Bond
        "43008": 1, // Sisterhood
        "43009": 1, // Adamantium Lacing
        "43010": 1, // Grim Resolve
        "43011": 1, // Pain Tolerance
        "43012": 2, // Puncture Wound
        "43013": 1, // Boom Boom
        "43014": 1, // Rictor
        "43015": 1, // Shatterstar
        "43016": 3, // Critical Hit
        "43017": 3, // Moment of Triumph
        "43018": 1, // Keep Them Busy
        "43019": 3, // "Now I'm Mad"
        "43020": 3, // The Direct Approach
        "43021": 1, // Specialized Training
        "43022": 1, // Energy
        "43023": 1, // Genius
        "43024": 1, // Strength
        "43025": 1, // IPAC
        "43026": 1, // X-Bunker
        "43027": 3, // Endurance
      },
      obligationCode: "43028",
      nemesisCodes: ["43029", "43030", "43031", "43032", "43033"],
      verified: true,
      sources: ['X-23 Hero Pack printed decklist card, "X-23 Deck" (photo supplied by the owner, 2026-10-04)'],
      note: "41 cards (identity, obligation and nemesis set excluded): 16 X-23 (X-23's Claws 43002 is Permanent), 16 Aggression, 9 basic. Read from the pack's printed decklist card (the owner's photo, 2026-10-04): entries 2-27 with the quantities here; it lists the four Specialist upgrades (43034-43037) apart, under \"Linked Cards\", so they are not in the deck. 43038-43040 (the other aspects' cards) are not on the decklist card.",
    },
  ],
};
