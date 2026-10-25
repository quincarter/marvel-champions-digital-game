/**
 * Wonder Man (Simon Williams) Hero Pack (Cycle 10, Civil War) curation.
 *
 * - **Errata: Ionic Physiology (58002)**, RRG 1.8 p. 70 (cost arrow to "Then"); the printed text keeps the arrow.
 * - **Deck-building rule (Simon Williams 58001b, "Ionic Energy Being").** The printed alter-ego text: "You may
 *   include events with a printed [energy] resource icon from any aspect in your deck." (raw 58001b `text`; raw
 *   `deck_options: [{ resource: ["energy"], type: ["event"] }]`.) Curated as `identityDeckbuilding["58001a"]`, an
 *   `offAspectAllowance` by card type and printed resource with no `maxCards` (docs/phase7-wave10-hero-packs.md
 *   H1.5, H3.15). Keyed on 58001a, the hero record's own code, as `gam` and `cyclops` key theirs.
 * - **Starter deck: Wonder Man / Justice, from a stand-in source.** The printed decklist card could not be found, so
 *   the owner supplied a screenshot of the precon as listed on a card database ("Wonder Man - precon deck", docs/
 *   decklists/wonder-man-precon-deck.png, 2026-10-12) and said to treat it as his decklist card. It is NOT a scan of
 *   the insert, so `verified` is false. The listing's 40 cards plus Ionic Physiology 58002 (the Permanent hero card,
 *   listed apart from the 40) make 41 entries: the hero-kit rule lists every kit card at its full quantity. The three
 *   off-aspect energy events (Bombs Away 58017, Stronger Together 58019, Unified Strike 58020) are covered by his
 *   own `offAspectAllowance` (`offAspectAllowanceCodes`). The data records 58020 as Leadership and 58019 as
 *   Protection; the screenshot shows the two with the same icon colour, which is not a conflict for the deck.
 *
 * - **Ionic Physiology (58002, upgrade) and Cameo (58031, support): dash cost, confirmed.** Ionic Physiology is
 *   Permanent, entering play by its own text; Cameo is a `Setup:` search-and-attach support, never played for a
 *   resource cost. Both send no `cost` at all on MarvelCDB; both confirmed against their own MarvelCDB listing
 *   ("Cost: —").
 * - **Coordinated Effort (58032, upgrade): `AttachmentHost { kind: "encounterCard" }`**, landed by
 *   `game-rules-architect` (docs/phase7-wave2.md §7.2) in response to this pipeline's schema request — "Attach
 *   to an encounter card in play. Max 1 per encounter card." parses automatically once the request landed; no
 *   further curation needed. Normalizes cleanly.
 */
import type { PackCuration } from "./types.ts";

export const WONDER_MAN_CURATION: PackCuration = {
  packCode: "wonder_man",
  cycle: { id: "cycle10", name: "Civil War", order: 10 },
  pack: {
    name: "Wonder Man",
    releaseDate: "2026-02-20",
    releaseDateSource:
      'Hall of Heroes Simon Williams/Wonder Man page (https://hallofheroeslcg.com/simon-williams-wonder-man/): "Release date: February 20, 2026"',
  },
  outDir: "src/data/wonder_man",
  exportPrefix: "WONDER_MAN",

  corrections: [
    {
      code: "58026",
      reason:
        'Grim Reaper is Wonder Man\'s nemesis minion (the only minion of the wonder_man_nemesis set, 58026 to 58029) but prints no Nemesis reminder line, so the parser cannot set the flag. Without it, "your nemesis minion" finds nothing for Wonder Man. Never applied to text.',
      evidence:
        "raw/marvelcdb/wonder_man.json: 58026 is the one minion in wonder_man_nemesis and its text carries no reminder line (Ares 59036 and The Hood 56024 print one); same fix as cw 56055 (docs/phase7-wave10-box-heroes.md B8.1).",
      nemesisMinion: true,
    },
    {
      code: "58002",
      reason:
        'Ionic Physiology is Permanent, entering play through its own text rather than being paid for from hand: raw sends no `cost` at all — the printed-dash pattern (RRG 1.8 "Dash (Value)", p. 15), not a data gap.',
      evidence: 'MarvelCDB card listing (marvelcdb.com/card/58002), "Cost: —"',
      specialCost: "dash",
    },
    {
      code: "58031",
      reason:
        "Cameo is a Setup: search-and-attach support, never played for a resource cost: raw sends no `cost` at all — same reasoning as 58002.",
      evidence: 'MarvelCDB card listing (marvelcdb.com/card/58031), "Cost: —"',
      specialCost: "dash",
    },
  ],
  errata: [
    {
      code: "58002",
      version: "RRG 1.8",
      changedFields: ["text"],
      note: 'Ionic Physiology: the cost arrow before "heal 1 damage from your identity" became "Then" (tucking the event is no longer a cost). MarvelCDB and the card print the arrow; the printed text keeps it.',
      evidence:
        'RRG 1.8 p. 70 (Wonder Man errata, IONIC PHYSIOLOGY (#2), docs/rules/mc_rulesreference_v18_compressed.md line 5150): "Should read: Response: After you play an event with a printed [energy] resource, tuck that event from your discard pile under this card. Then, heal 1 damage from your identity. (Changed cost arrow to “Then”.)"; ruling March 6, 2026 (3); scan 58002.png prints the arrow (scan check, "Known errata"). Raw text is the print.',
      currentReplace: { find: " → heal 1 damage", replace: ". Then, heal 1 damage" },
    },
  ],

  scriptingNotes: {},
  cardNotes: {},

  // Simon Williams 58001b, "Ionic Energy Being": "You may include events with a printed [energy] resource icon from
  // any aspect in your deck." A printed wild icon is not an energy icon (RRG 1.8 "Printed", p. 35).
  identityDeckbuilding: {
    "58001a": { offAspectAllowance: { cardType: "event", printedResource: "energy" } },
  },

  scenarios: [],
  starterDecks: [
    {
      id: "wonder-man-justice",
      name: "Wonder Man / Justice",
      identityCode: "58001a",
      aspect: "justice",
      offAspectAllowanceCodes: ["58017", "58019", "58020"],
      cards: {
        // His hero cards: 15 in the 40 plus Ionic Physiology (Permanent)
        "58002": 1, // Ionic Physiology
        "58003": 3, // Active Altruism
        "58004": 2, // Ionic Blast
        "58005": 3, // Starstruck
        "58006": 2, // Energy Siphon
        "58007": 1, // Wonder Fans
        "58008": 1, // Jet Belt
        "58009": 1, // Mr. Hollywood
        "58010": 1, // Signature Sunglasses
        "58011": 1, // "What Are You?"
        // 13 Justice
        "58012": 1, // Firebird
        "58013": 1, // Hawkeye
        "58014": 1, // Scarlet Witch
        "58015": 1, // Sentry
        "58016": 3, // Battlefield Benevolence
        "58018": 3, // Everywhere All at Once
        "58021": 3, // Heroic Conditioning
        // 3 basic
        "58022": 1, // Swordsman
        "58023": 1, // Energy
        "58024": 1, // Jarvis
        // 9 off-aspect energy events
        "58017": 3, // Bombs Away (Aggression)
        "58019": 3, // Stronger Together
        "58020": 3, // Unified Strike
      },
      obligationCode: "58025",
      nemesisCodes: ["58026", "58027", "58028", "58029"],
      verified: false,
      sources: [
        'Owner-supplied stand-in for the printed decklist card (the owner could not locate a hard copy): a screenshot of the precon as listed on a card database, "Wonder Man - precon deck" (Wonder Man (Simon Williams), Justice, 40 cards), saved as docs/decklists/wonder-man-precon-deck.png, 2026-10-12. Not a scan of the insert, not checked against the printed card.',
      ],
      note: "40 cards in the listing plus the Permanent Ionic Physiology (58002), so 41 entries. Names were matched to this pack's own codes 580NN; every copy count is within the record's quantity.",
    },
  ],
};
