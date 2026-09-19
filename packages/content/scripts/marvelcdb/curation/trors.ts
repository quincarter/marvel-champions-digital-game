/**
 * The Rise of Red Skull curation. Evidence abbreviations:
 * - "raw": the pack's own cached raw record (`packages/content/raw/marvelcdb/trors.json`).
 * - "phase7 wave2 §N": docs/phase7-wave2.md section N, which researched this pack's rulebook and RRG errata.
 * - "RRG errata p.66": `mc_rulesreference_v18_compressed.pdf`'s printed errata page, cited there.
 * - "rulebook p.18": the Red Skull rulebook's spoiler edition
 *   (https://hallofheroeslcg.com/wp-content/uploads/2020/09/rorsrulesspoilers.pdf, linked from
 *   https://hallofheroeslcg.com/the-rise-of-red-skull/), printed page 18, "Starter Decks" — viewed as a page
 *   image and transcribed here (the spoiler-free rulebook the rest of this file cites has only 12 pages and does
 *   not include this section).
 *
 * **Scenarios not yet curated.** This pass only gets the pack's cards (heroes, campaign cards, five scenarios'
 * encounter cards) normalizing; the `ScenarioCuration` entries that would let `coreScenario`-style setup resolve
 * are a follow-up (docs/phase7-wave2.md §2.2 has the per-scenario setup notes already researched).
 *
 * **Starter decks curated from the rulebook's own "Starter Decks" page** (rulebook p.18), transcribed
 * item-by-item and cross-checked against raw (trors.json) by name, code and quantity — every item matched
 * exactly. Spider-Woman's needs two aspects (Aggression + Justice) per her Double-Agent ability (FAQ, RRG 1.8
 * p. 60, docs/phase7-wave2.md §1.2); her "Spider-Woman cards" section on the rulebook page mixes plain hero-kit
 * cards (Captain Marvel, Finesse, Jessica Drew's Apartment, Self-Propelled Glide) with her four aspect-printed
 * signature cards (Venom Blast/Pheromones/Contaminant Immunity/Inconspicuous), all identity-specific
 * (`aspect: hero:04031a`) regardless of their printed aspect color.
 */
import type { PackCuration } from "./types.ts";

export const TRORS_CURATION: PackCuration = {
  packCode: "trors",
  cycle: { id: "cycle1", name: "The Rise of Red Skull", order: 2 },
  pack: {
    name: "The Rise of Red Skull",
    releaseDate: "2020-09-04",
    releaseDateSource:
      'Hall of Heroes "The Rise of Red Skull (Encounter Cards)" page (https://hallofheroeslcg.com/the-rise-of-red-skull/): "Release date: September 4, 2020 (Originally July, 2020)" — the wide release date is used.',
  },
  outDir: "src/data/trors",
  exportPrefix: "TRORS",

  corrections: [
    {
      code: "04059",
      reason:
        'MarvelCDB\'s own transcription typo: Crossbones\' When Revealed searches for "Crossbone\'s Machine Gun", but the real card (04064) is titled "Crossbones\' Machine Gun". Uncorrected, this is a named search that finds nothing.',
      evidence: "raw (04059, 04064); docs/phase7-wave2.md §5.2",
      textReplace: { find: "Crossbone's Machine Gun", replace: "Crossbones' Machine Gun" },
    },
    {
      code: "04150",
      reason: 'MarvelCDB\'s own transcription typo, twice on this card: "When Reveled" for "When Revealed" — uncorrected, the trigger header regex does not match either line, so both abilities would parse as plain text.',
      evidence: "raw (04150); docs/phase7-wave2.md §5.2",
      textReplace: { find: "When Reveled (Alter-Ego)", replace: "When Revealed (Alter-Ego)" },
    },
    {
      code: "04150",
      reason: 'The second occurrence of the same typo, on the same card (see the other 04150 correction).',
      evidence: "raw (04150); docs/phase7-wave2.md §5.2",
      textReplace: { find: "When Reveled (Hero)", replace: "When Revealed (Hero)" },
    },
    {
      code: "04159a",
      reason:
        'The Hydra Campaign "Basic Thwart Upgrade" prints no cost (RRG 1.8 "Dash (Value)", p. 15): it enters play only through Setup. **Not independently confirmed against the card image** — read from its Setup-only text, matching docs/phase7-wave2.md §1.3\'s note that curation must confirm this before emitting; treat as unverified until a scan is checked.',
      evidence: "raw (04159a, cost: null); RRG 1.8 p. 15 \"Dash (Value)\"; docs/phase7-wave2.md §1.3/§5.1 (unconfirmed against the card image)",
      specialCost: "dash",
    },
    {
      code: "04160a",
      reason: 'The Hydra Campaign "Basic Attack Upgrade" — same reasoning and same caveat as 04159a.',
      evidence: "raw (04160a, cost: null); RRG 1.8 p. 15 \"Dash (Value)\"; docs/phase7-wave2.md §1.3/§5.1 (unconfirmed against the card image)",
      specialCost: "dash",
    },
    {
      code: "04161a",
      reason: 'The Hydra Campaign "Basic Defense Upgrade" — same reasoning and same caveat as 04159a.',
      evidence: "raw (04161a, cost: null); RRG 1.8 p. 15 \"Dash (Value)\"; docs/phase7-wave2.md §1.3/§5.1 (unconfirmed against the card image)",
      specialCost: "dash",
    },
    {
      code: "04162a",
      reason: 'The Hydra Campaign "Basic Recovery Upgrade" — same reasoning and same caveat as 04159a.',
      evidence: "raw (04162a, cost: null); RRG 1.8 p. 15 \"Dash (Value)\"; docs/phase7-wave2.md §1.3/§5.1 (unconfirmed against the card image)",
      specialCost: "dash",
    },
  ],
  errata: [
    {
      code: "04028",
      version: "RRG 1.8 p. 66",
      changedFields: ["text"],
      note:
        'Marked for Death\'s "places her faceup" reads "tucks her faceup", and "return Mockingbird to her owner\'s hand" reads "return the tucked Mockingbird to her owner\'s hand". MarvelCDB\'s cached text is still the pre-errata wording.',
      evidence: "raw (04028); RRG 1.8 p. 66; docs/phase7-wave2.md §5.2",
      currentReplace: {
        find: "places her faceup beneath this card. When this scheme is defeated, return Mockingbird to her owner's hand.",
        replace: "tucks her faceup beneath this card. When this scheme is defeated, return the tucked Mockingbird to her owner's hand.",
      },
    },
    {
      code: "04128a",
      version: "RRG 1.8 p. 66 (#128A)",
      changedFields: ["text"],
      note: '"Shuffle every other side scheme" reads "Shuffle every other encounter side scheme" — MarvelCDB\'s cached text is still the pre-errata wording.',
      evidence: "raw (04128a); RRG 1.8 p. 66; docs/phase7-wave2.md §1.8/§5.2",
      currentReplace: {
        find: "Shuffle every other side scheme into the side-scheme deck",
        replace: "Shuffle every other encounter side scheme into the side-scheme deck",
      },
    },
    {
      code: "04136",
      version: "RRG 1.8 p. 66",
      changedFields: ["text"],
      note:
        'Bitter Rival\'s "Exhaust a character you control for each side scheme in play." reads "For each side scheme in play, choose and exhaust a character you control." (the updated "For Each" rule, RRG 1.8 p. 20) — MarvelCDB\'s cached text is still the pre-errata wording.',
      evidence: "raw (04136); RRG 1.8 p. 66, p. 20 \"For Each\"; docs/phase7-wave2.md §3.12/§5.2",
      currentReplace: {
        find: "Exhaust a character you control for each side scheme in play.",
        replace: "For each side scheme in play, choose and exhaust a character you control.",
      },
    },
  ],

  scriptingNotes: {},
  cardNotes: {},

  identityDeckbuilding: {
    "04031a": {
      aspectCount: 2,
      equalCardsPerAspect: true,
    },
  },

  scenarios: [],
  starterDecks: [
    {
      id: "hawkeye-leadership",
      name: "Hawkeye (Leadership) — starter deck",
      identityCode: "04001a",
      aspect: "leadership",
      cards: {
        // Hawkeye cards (04002-04010), each at its printed kit quantity.
        "04002": 1, "04003": 1, "04004": 1, "04005": 2, "04006": 2, "04007": 2, "04008": 2, "04009": 2, "04010": 2,
        // Leadership aspect cards.
        "04011": 1, "04012": 1, "04013": 1, "04014": 1, "04015": 3, "04016": 3, "04017": 3, "04018": 2, "04019": 2,
        // Basic cards.
        "04020": 1, "04021": 1, "04022": 3, "04023": 1, "04024": 1, "04025": 1,
      },
      obligationCode: "04026",
      nemesisCodes: ["04027", "04028", "04029", "04030"],
      verified: true,
      sources: ["Red Skull rulebook (spoiler edition), p. 18, \"Hawkeye / Leadership\""],
    },
    {
      id: "spider-woman-aggression-justice",
      name: "Spider-Woman (Aggression & Justice) — starter deck",
      identityCode: "04031a",
      aspect: "aggression",
      secondaryAspects: ["justice"],
      cards: {
        // Spider-Woman cards (04032-04039): plain hero-kit cards and her four aspect-printed signature cards,
        // all identity-specific (aspect: hero:04031a) regardless of printed aspect color.
        "04032": 1, "04033": 2, "04034": 1, "04035": 2, "04036": 2, "04037": 2, "04038": 2, "04039": 3,
        // Aggression cards.
        "04040": 1, "04041": 2, "04042": 2, "04043": 3, "04044": 3,
        // Justice cards.
        "04045": 1, "04046": 2, "04047": 3, "04048": 2, "04049": 3,
        // Basic cards.
        "04050": 1, "04051": 1, "04052": 1,
      },
      obligationCode: "04053",
      nemesisCodes: ["04054", "04055", "04056", "04057"],
      verified: true,
      sources: ["Red Skull rulebook (spoiler edition), p. 18, \"Spider-Woman / Aggression & Justice\""],
      note:
        "40 cards = 15 Spider-Woman + 11 Aggression + 11 Justice + 3 Basic, matching docs/phase7-wave2.md §2.1's own count from the rulebook text (\"15 + 11 + 11 + 3 basic resources\").",
    },
  ],

  ignoredRecords: [
    {
      code: "10098",
      reason:
        'A second "Shang-Chi" record (`faction_code: "hero"`, `card_set_code: "taskmaster"`, `deck_limit: 1`), under a code in the Hulk pack\'s (10xxx) range, duplicating the real Captive ally 04098. Not a printed card.',
      evidence: "raw (10098); docs/phase7-wave2.md §4.5/§5.2",
    },
  ],
};
