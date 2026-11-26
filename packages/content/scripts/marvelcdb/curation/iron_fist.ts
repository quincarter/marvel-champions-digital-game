/**
 * Iron Fist Hero Pack (MC64, cycle 11, Fear No Evil wave) curation.
 *
 * History: until 2026-11-25 this pack was hand-transcribed as a scan-only pack (MarvelCDB lacked it). MarvelCDB now
 * carries it (https://marvelcdb.com/api/public/cards/iron_fist, 33 records, raw cache packages/content/raw/marvelcdb/
 * iron_fist.json), so the data is MarvelCDB-sourced like `luke_cage.ts`. The provisional codes 64034 to 64037
 * (obligation, Davos, Steel Serpent, Crane Daughter) are the real 64026 to 64029, and the quantities are MarvelCDB's.
 *
 * Evidence abbreviation: "image" is the official card image `Iron_Fist_EN/<code>_<name>.png` (1500 x 2150; card images
 * contributed by bluefireF5ran; kept outside the repo, never wired into the data; the bundled art is
 * `assets/card-art/bundles/cards/<code>.png`). Images read for this curation: both identity faces, 64013, 64014, 64021,
 * 64026 to 64029 and 64032. Each matched MarvelCDB in text, stats, traits, boost icons and unique marker except as the
 * corrections below say. 64029's scheme icon is the acceleration icon (MarvelCDB agrees; the earlier fan preview's
 * crisis reading was wrong). Davos prints the traits K'un-Lun. Martial Artist.
 *
 * Starter deck: no printed list is available, so MarvelCDB decklist 69859 stands in, `verified: false`.
 */
import type { PackCuration } from "./types.ts";

/** MarvelCDB drops the consequential-damage icon the printed text carries; our text token for it is "[cost]". */
const costIconText = (code: string, name: string, find: string, replace: string) => ({
  code,
  reason: `MarvelCDB drops the consequential-damage icon that the printed text of ${name} carries after "damage" (our text token "[cost]").`,
  evidence: `Card image Iron_Fist_EN/${code}_*.png: "consequential damage (icon)".`,
  textReplace: { find, replace },
});

export const IRON_FIST_CURATION: PackCuration = {
  packCode: "iron_fist",
  cycle: { id: "cycle11", name: "Fear No Evil", order: 11 },
  pack: {
    name: "Iron Fist",
    releaseDate: "2026-11-13",
    releaseDateSource:
      'MarvelCDB pack list (https://marvelcdb.com/api/public/packs/, code iron_fist, "available": "2026-11-13"), the same day as Elektra; FFG and Hall of Heroes give only "November 2026" (product code MC64en).',
  },
  outDir: "src/data/iron_fist",
  exportPrefix: "IRON_FIST",

  corrections: [
    costIconText(
      "64014",
      "Iron Fist (Lin Lie)",
      "consequential damage from this attack",
      "consequential damage ([cost]) from this attack",
    ),
    costIconText("64021", "Colleen Wing", "-1 consequential damage after", "-1 consequential damage ([cost]) after"),
    costIconText("64032", "Sensei", "consequential damage after they", "consequential damage ([cost]) after they"),
    {
      code: "64013",
      reason:
        "THW and ATK print a dash: Helpful Bystander has no thwart or attack value (RRG 1.8 Dash (Value), p. 15). MarvelCDB sets attack_star and thwart_star on those stats; the card prints no star there (the icons under each dash are consequential-damage pips, moot under a dash).",
      evidence: "Card image Iron_Fist_EN/64013_helpful_bystander.png: dash THW and ATK, one pip under each, no star.",
      clearStarFlags: ["attack_star", "thwart_star"],
    },
  ],
  errata: [],

  scriptingNotes: {},
  cardNotes: {
    "64013":
      "Helpful Bystander: THW and ATK both print a dash (image), so it can neither thwart nor attack; HP 1 (Vulnerable). No thwart or attack value is emitted, as Hulk's dash THW (luke_cage 62020). The pip under each dash is a consequential-damage icon, moot under the dash.",
    "64029":
      "Steel Serpent prints the acceleration icon, 4 threat per player and 2 boost icons (image); its Forced Interrupt gives Davos +3 ATK.",
  },

  scenarios: [],
  starterDecks: [
    {
      id: "iron-fist-protection",
      name: "Iron Fist (Protection) — Iron Fist Hero Pack starter deck",
      identityCode: "64001a",
      aspect: "protection",
      cards: {
        "64002": 3, // Deep Breathing
        "64003": 1, // Dragon Punch
        "64004": 2, // Fists of Fury
        "64005": 2, // The Way of Things
        "64006": 1, // Lei Kung
        "64007": 1, // Book of the Iron Fist
        "64008": 1, // Channel the Iron Fist
        "64009": 1, // Embody the Dragon
        "64010": 1, // Feel the Flow
        "64011": 1, // Keep 'Em Coming
        "64012": 1, // Redirect Chi
        "64013": 1, // Helpful Bystander
        "64014": 1, // Iron Fist (Lin Lie)
        "64015": 3, // Defiance
        "64016": 3, // Demoralize
        "64017": 1, // The Night Nurse
        "64018": 3, // Redirection Mastery
        "64019": 3, // No Time to Bleed
        "64020": 3, // Tonfa
        "64021": 1, // Colleen Wing
        "64022": 1, // Luke Cage
        "64023": 3, // Punch, Reverse Punch
        "64024": 1, // Power Man and Iron Fist
        "64025": 1, // Thunder Dojo
      },
      obligationCode: "64026", // Lack of Chi
      nemesisCodes: ["64027", "64028", "64029"], // Davos, Crane Daughter, Steel Serpent
      verified: false,
      sources: [
        'STAND-IN, NOT A PRINTED LIST: no decklist card or insert page for Iron Fist is available. Counts follow MarvelCDB public decklist 69859 ("Iron Fist - precon deck", posted 2026-11-16, "precon deck for the Iron Fist (protection aspect)"). Every copy count is within the record\'s quantity. Replace with the printed list when the owner supplies it.',
      ],
      note: "40 cards. Unverified against the printed card.",
    },
  ],
};
