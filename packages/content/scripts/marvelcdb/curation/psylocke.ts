/**
 * Psylocke (Betsy Braddock) Hero Pack (Cycle 7) curation.
 *
 * - **Psi-Knife (41002a, upgrade): dash cost, confirmed.** A Permanent signature weapon (flips to Psi-Katana,
 *   `41002b`, via its own Hero Resource). MarvelCDB sends no `cost` at all on either face; confirmed against the
 *   card's own MarvelCDB listing ("Cost: —").
 * - **Psi-Knife (41002a) has no `imagesrc` at all on MarvelCDB — resolved via local art, not a curation entry.**
 *   The repo's own card scan (`assets/card-art/bundles/cards/41002a.png`) fills this in through `withLocalArt`
 *   (`scripts/marvelcdb/normalize/art.ts`, `scripts/marvelcdb/local-art.ts`), the same fallback that unblocked
 *   Jubilee's identity pair; no `imageOverrides` entry needed. Confirmed via `survey.ts --pack psylocke`
 *   (0 issues) once the local-art bundle covered `41002a`/`41002b`.
 *
 * Normalizes cleanly and is registered for emission — no remaining schema/parser gap found for this pack.
 */
import type { PackCuration } from "./types.ts";

export const PSYLOCKE_CURATION: PackCuration = {
  packCode: "psylocke",
  cycle: { id: "cycle7", name: "NeXt Evolution", order: 7 },
  pack: {
    name: "Psylocke",
    releaseDate: "2023-09-22",
    releaseDateSource:
      'Hall of Heroes Psylocke/Betsy Braddock page (https://hallofheroeslcg.com/psylocke-betsy-braddock/): "Release date: September 22, 2023"',
  },
  outDir: "src/data/psylocke",
  exportPrefix: "PSYLOCKE",

  corrections: [
    {
      code: "41002a",
      reason:
        'Psi-Knife is a Permanent signature weapon, flipped by its own Hero Resource rather than played for a resource cost: raw sends no `cost` at all — the printed-dash pattern (RRG 1.8 "Dash (Value)", p. 15), not a data gap.',
      evidence: 'MarvelCDB card listing (marvelcdb.com/card/41002a), "Cost: —"',
      specialCost: "dash",
    },
    {
      code: "41008",
      reason:
        'MarvelCDB text reads "Exhaust Training Regiment"; the card title and the scan both read "Training Regimen" (typo in the source).',
      evidence: 'Scan 41008.png: title "Training Regimen", text "Exhaust Training Regimen"',
      textReplace: { find: "Training Regiment", replace: "Training Regimen" },
    },
    ...["41032", "41033"].map((code) => ({
      code,
      reason:
        'MarvelCDB reads "Play only if your hero has the PSIONIC trait."; the card prints "your identity" (the form-independent identity restriction the parser reads as requiresIdentityTrait).',
      evidence: `Card scan assets/card-art/bundles/cards/${code}.png: "Play only if your identity has the PSIONIC trait."`,
      textReplace: { find: "Play only if your hero has the", replace: "Play only if your identity has the" },
    })),
  ],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [
    {
      id: "psylocke-justice",
      name: "Psylocke (Justice) — Psylocke Hero Pack starter deck",
      identityCode: "41001a",
      aspect: "justice",
      cards: {
        "41002a": 2, // Psi-Knife / Psi-Katana
        "41003": 1, // Angel
        "41004": 3, // Flurry of Blades
        "41005": 3, // Mental Detection
        "41006": 2, // Psionic Redirect
        "41007": 2, // Telepathic Suggestion
        "41008": 1, // Training Regimen
        "41009": 1, // Martial Arts Training
        "41010": 1, // Psionic Training
        "41011": 1, // Weapons Training
        "41012": 1, // Captain Britain
        "41013": 1, // Cypher
        "41014": 3, // Concussive Blow
        "41015": 3, // Upside the Head
        "41016": 1, // Lay the Trap (Justice player side scheme)
        "41017": 3, // Float Like a Butterfly
        "41018": 1, // Pete Wisdom
        "41019": 3, // Directed Force
        "41020": 1, // Soaring Hearts
        "41021": 3, // The Power of the Mind
        "41022": 1, // IPAC
        "41023": 1, // X-Bunker
        "41024": 3, // Telepathy
      },
      obligationCode: "41025",
      nemesisCodes: ["41026", "41027", "41028", "41029"],
      verified: true,
      sources: [
        'Psylocke Hero Pack printed decklist card, "Psylocke Deck" (https://hallofheroeslcg.com/wp-content/uploads/2023/10/photo-oct-07-2023-4-42-12-pm.jpg, the "Starter Deck" link on the Hall of Heroes Psylocke page, https://hallofheroeslcg.com/psylocke-betsy-braddock/), transcribed 2026-10-04',
      ],
      note: "42 cards (identity, obligation and nemesis set excluded): 17 Psylocke, 12 Justice (Lay the Trap is the in-aspect player side scheme), 13 basic. The printed card numbers equal the codes' last digits; every title and quantity matches raw/marvelcdb/psylocke.json quantity/deck_limit. The pack's Aggression, Leadership and Protection extras (41030-41033 other than basic Telekinesis) are not in the precon.",
    },
  ],
};
