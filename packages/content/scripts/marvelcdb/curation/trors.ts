/**
 * The Rise of Red Skull curation. Evidence abbreviations:
 * - "raw": the pack's own cached raw record (`packages/content/raw/marvelcdb/trors.json`).
 * - "phase7 wave2 §N": docs/phase7-wave2.md section N, which researched this pack's rulebook and RRG errata.
 * - "RRG errata p.66": `mc_rulesreference_v18_compressed.pdf`'s printed errata page, cited there.
 *
 * **Scenarios and starter decks not yet curated.** This pass only gets the pack's cards (heroes, campaign cards,
 * five scenarios' encounter cards) normalizing; the `ScenarioCuration`/`StarterDeckCuration` entries that would
 * let `coreScenario`-style setup and precons resolve are a follow-up (docs/phase7-wave2.md §2.2 has the per-
 * scenario setup notes already researched). Hawkeye and Spider-Woman's printed decklists (Red Skull rulebook,
 * p. 18) are a scan this pass has no way to read.
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

  scenarios: [],
  starterDecks: [],

  ignoredRecords: [
    {
      code: "10098",
      reason:
        'A second "Shang-Chi" record (`faction_code: "hero"`, `card_set_code: "taskmaster"`, `deck_limit: 1`), under a code in the Hulk pack\'s (10xxx) range, duplicating the real Captive ally 04098. Not a printed card.',
      evidence: "raw (10098); docs/phase7-wave2.md §4.5/§5.2",
    },
  ],
};
