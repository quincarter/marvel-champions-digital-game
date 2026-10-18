/**
 * Jessica Jones Hero Pack (MC61, cycle 11, Fear No Evil wave) curation.
 *
 * Evidence abbreviations: "scan" is `assets/card-art/bundles/cards/<code>.png` (gitignored, read directly, never wired
 * into the data), "survey" is docs/phase7-wave11-data-survey.md and "spec" is docs/phase7-wave11-hero-packs.md (H1,
 * H8.1). Emitted before `luke_cage`: 62024 Unbreakable Bond reprints 61027.
 *
 * - 61002 Alias Investigations is Permanent and put into play by 61001b's Setup: a dash cost.
 * - 61031 Purple Man's ATK and SCH are read from the board ("[star] ..."), emitted 0 with a note, not a dash: a dash
 *   cannot be modified (RRG 1.8 "Dash (Value)", p. 15) and the spec's stacking rule (H3.10) needs a modifiable stat.
 * - 61033a/b/c are named "Suggestion ([energy])" etc. by MarvelCDB; 61032 Indomitable Will refers to "each Suggestion
 *   obligation" by title, so the three carry the title "Suggestion".
 * - 61040 Mitigated Threat ("Attach to a card.") emits `attachesTo: { kind: "anyCard" }` (spec H3.11), which the
 *   engine's host list resolves (HT6): any card in play other than itself.
 * - Starter deck: no printed list exists (survey section 10), so MarvelCDB decklist 65137 stands in, `verified: false`.
 */
import type { PackCuration } from "./types.ts";

const SUGGESTION_NAME = (code: string, icon: string) => ({
  code,
  reason: `MarvelCDB names this card "Suggestion ([${icon}])"; the card's title is "Suggestion" and 61032 Indomitable Will refers to "each Suggestion obligation" by title. The resource icon is a printed qualifier of the text, not part of the title.`,
  evidence: `Spec H1 (corrections owed, "unchecked, no scan"); 61032 raw text "each Suggestion obligation"; 61033a-c raw text, which names the [${icon}] icon in its Forced Action.`,
  name: "Suggestion",
});

export const JJ_CURATION: PackCuration = {
  packCode: "jj",
  cycle: { id: "cycle11", name: "Fear No Evil", order: 11 },
  pack: {
    name: "Jessica Jones",
    releaseDate: "2026-08-21",
    releaseDateSource:
      'MarvelCDB pack list (https://marvelcdb.com/api/public/packs/, code jj, "available": "2026-08-21"), also the day decklist 65137 was posted; a pointer, since FFG gives only "August, 2026".',
  },
  outDir: "src/data/jj",
  exportPrefix: "JJ",

  corrections: [
    {
      code: "61002",
      reason:
        "Alias Investigations is Permanent and enters play through Jessica Jones's Setup, never from a hand: raw sends no `cost` at all, the printed-dash pattern (RRG 1.8 Dash (Value), p. 15), as Ionic Physiology 58002.",
      evidence: "Raw record (no cost); spec H1 corrections table; survey section 6. No local scan checked.",
      specialCost: "dash",
    },
    SUGGESTION_NAME("61033a", "energy"),
    SUGGESTION_NAME("61033b", "mental"),
    SUGGESTION_NAME("61033c", "physical"),
  ],
  errata: [],

  scriptingNotes: {},
  cardNotes: {
    "61002":
      "Alias Investigations: dash cost (Permanent; 61001b's Setup puts it into play), as Ionic Physiology 58002.",
    "61031":
      "Purple Man: ATK and SCH print as a star and are set by his text (SCH = the highest SCH or THW among characters in play; ATK = the highest ATK). Emitted 0, not a dash, so the engine can stack modifiers on the computed value (spec H1, H3.10).",
  },

  scenarios: [],
  starterDecks: [
    {
      id: "jj-justice",
      name: "Jessica Jones (Justice) — Jessica Jones Hero Pack starter deck",
      identityCode: "61001a",
      aspect: "justice",
      cards: {
        "61002": 1, // Alias Investigations (Permanent, put into play by Setup)
        "61003": 1, // Luke Cage
        "61004": 2, // "Big Mistake"
        "61005": 1, // Breakthrough
        "61006": 3, // Snooping Around
        "61007": 1, // Piecing It All Together
        "61008": 1, // Calling in Favors
        "61009": 1, // 4K Digital Camcorder
        "61010": 1, // Circumstantial Evidence
        "61011": 1, // Leather Jacket
        "61012": 1, // "Now I'm Ticked Off!"
        "61013": 1, // Reluctant Flier
        "61014": 1, // Stakeout
        "61015": 1, // Captain Marvel
        "61016": 1, // Spider-Woman
        "61017": 1, // Squirrel Girl
        "61018": 3, // Lay Down the Law
        "61019": 3, // Strategy Session
        "61020": 1, // Run Them to Ground
        "61021": 1, // Lay the Trap
        "61022": 1, // Determination
        "61023": 3, // Grapnel Launcher
        "61024": 3, // Entrapment
        "61025": 1, // Hellcat
        "61026": 3, // Joys of Life
        "61027": 1, // Unbreakable Bond
        "61028": 1, // Second Chance
        "61029": 1, // Defend Our City
      },
      obligationCode: "61030", // Work-Life Balance
      nemesisCodes: ["61031", "61032", "61033a", "61033b", "61033c"], // Purple Man, Indomitable Will, Suggestion x3
      verified: false,
      sources: [
        'STAND-IN, NOT A PRINTED LIST: no decklist card or insert page for Jessica Jones is available (the Hall of Heroes page prints "Starter Deck" as plain text; the MC61 insert has no list). Counts follow MarvelCDB public decklist 65137 ("Jessica Jones precon deck", posted 2026-08-21), as tabulated in docs/phase7-wave11-data-survey.md section 10. Every copy count is within the record\'s quantity. Replace with the printed list when the owner supplies it.',
      ],
      note: "41 entries: the 40-card listing plus the Permanent Alias Investigations (61002), which Setup puts into play (the Wonder Man rule). Unverified against the printed card.",
    },
  ],
};
