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

  // Scripting hand-off notes (docs/phase7-wave7-data-survey.md §8 step 12), comments only so the emitted data does not
  // change. Reading taken, question or ruling behind it (docs/phase7-wave7.md §4.1), script under
  // packages/cards/src/wave7/psylocke/. No dotted acronym traits here (docs/trait-split-report.md: no change).
  // - 41001a Psi-Energy Control: an interrupt to her basic power, so a flip resolves before the power's value is read
  //   (Knife to Katana on a basic attack gives that attack +1 ATK and piercing). Offered when a stun cancels the basic
  //   attack (2026-10-06, the owner's inference from RRG 1.8 status priority). identity.ts.
  // - 41002a/b Psi-Knife / Psi-Katana: the Katana's piercing is on her basic attacks only, not an event's attack.
  //   Restricted is a state limit (2026-10-06): a play or flip into a third restricted card resolves, then the player
  //   chooses and discards down to two (RRG "Restricted"); after a flip the limit is checked at once (Q38 = A). A flip
  //   Body Swapped forbids is not offered (`cannotFlip`). support-upgrades-allies.ts, identity.ts.
  // - 41004-41007 Flurry of Blades, Mental Detection, Psionic Redirect, Telepathic Suggestion: a base effect plus one
  //   per Knife and one per Katana, read as the clause resolves. Each "for each" iteration is its own choice, so the
  //   same target may be chosen twice. Telepathic Suggestion cancels a When Revealed: a canceled one gives no Surge and
  //   does not count as resolved for Pete Wisdom (FFG August 3, 2026 - Ruling 3; 2026-10-06). events.ts.
  // - 41006 Psionic Redirect, a "(defense)" ability: using one makes the hero the defender and DEF is not applied; only
  //   one player may resolve a "(defense)" ability per attack, the same hero may use further ones (2026-10-06).
  //   events.ts.
  // - 41013 Cypher: a confused enemy the attack defeats still counts, so he draws; the attack damaged it while it was
  //   confused (2026-10-06). support-upgrades-allies.ts.
  // - 41018 Pete Wisdom: after the player resolves a treachery; an obligation is not one. support-upgrades-allies.ts.
  // - 41019 Directed Force: one extra damage bonus per attack across all copies; the Katana's piercing counts.
  //   events.ts.
  // - 41020 Soaring Hearts: Team-Up (Angel and Psylocke) is card data; Archangel is not "Angel", so it cannot be played
  //   in Archangel form (Q37 = A). events.ts.
  // - 41025 Body Swapped, 41026 Chimera: flips and exhausts every PSI-ENERGY upgrade, one already on its Katana side
  //   included (Q43 = A). "[mental] resources on cards you control" reads cards in play, hand, deck and discard pile as
  //   printed (Q39 = C, RRG p. 31). obligation-nemesis.ts.
  // - 41028 Psionic Illusion: a printed wild icon matches any named type (Q40 = B). obligation-nemesis.ts.
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
