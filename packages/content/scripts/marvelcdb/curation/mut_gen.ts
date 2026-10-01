/**
 * Mutant Genesis (MC32, cycle 6 campaign box) curation, pass 1: cards only. Colossus and Shadowcat hero kits, five
 * scenarios' encounter cards, the role sets and the campaign cards 171-195. docs/phase7-wave6.md §1 is the working
 * spec; the scenario records, starter decks and the hand-authored `campaign.ts` are later passes (docs/
 * phase7-wave6-data-survey.md §9 steps 4-5), so `scenarios` and `starterDecks` are empty here.
 *
 * Evidence abbreviations: "scan" is `assets/card-art/bundles/cards/<code>.png` (gitignored, read directly; never
 * wired into the data), "RRG" is the v1.8 rules reference, "spec" is docs/phase7-wave6.md. The survey
 * (`survey.ts --pack mut_gen`) reported 21 lines on the bare curation, all resolved below: the three main scheme B
 * sides' dashed threat values, three missing dash costs (32031a, 32171b, 32172b), cardNotes for Robert Kelly and
 * Mystique, and the four attach rules.
 */
import type { PackCuration } from "./types.ts";

export const MUT_GEN_CURATION: PackCuration = {
  packCode: "mut_gen",
  // The id stays "cycle6" (data-only.test.ts and the pool version read it); only the name changes, for this pack
  // alone. The other cycle 6 packs are renamed in a later step (docs/phase7-wave6-data-survey.md §5, §9 step 9).
  cycle: { id: "cycle6", name: "Mutant Genesis", order: 6 },
  pack: {
    name: "Mutant Genesis",
    releaseDate: "2022-09-30",
    releaseDateSource:
      "docs/phase7-wave6-sources.md release table (September 30, 2022; Hall of Heroes https://hallofheroeslcg.com/mutant-genesis/)",
  },
  outDir: "src/data/mut_gen",
  exportPrefix: "MUT_GEN",
  // MarvelCDB has no campaign record (docs/campaign-mode-design.md §3): pass 2 hand-authors `campaign.ts` and adds
  // `handAuthoredModules: ["campaign"]` in the same commit. Ingest refuses a named module whose file is missing, so
  // it is not listed yet.

  corrections: [
    {
      code: "32063b",
      reason:
        'Stalked by Sabretooth 1B prints a dash in the target-threat oval (RRG 1.8 "Target Threat", p. 43: upper left corner); MarvelCDB sends threat: null without threat_fixed. It advances only through Find the Senator\'s When Defeated (docs/phase7-wave6.md \u00a71.6).',
      evidence:
        'Card scan assets/card-art/bundles/cards/32063b.png: target oval "\u2014", acceleration +1 per hero (star), starting threat 0.',
      dashedThreatFields: ["targetThreat"],
    },
    {
      code: "32087b",
      reason:
        "Night of the Sentinels 1B prints a dash in the target-threat oval (RRG 1.8 p. 43); MarvelCDB sends threat: null without threat_fixed. It never advances by threat (docs/phase7-wave6.md \u00a71.6).",
      evidence:
        'Card scan assets/card-art/bundles/cards/32087b.png: target oval "\u2014", acceleration +1 per hero, starting threat 1 per hero.',
      dashedThreatFields: ["targetThreat"],
    },
    {
      code: "32125b",
      reason:
        "The Brotherhood Strikes! 1B prints a dash in all three values (target oval and both bottom boxes); MarvelCDB sends 0 / 0 / null with no *_fixed flag. It advances on its own When Revealed and never holds threat (docs/phase7-wave6.md \u00a71.5).",
      evidence: 'Card scan assets/card-art/bundles/cards/32125b.png: oval "\u2014", both bottom boxes "\u2014".',
      dashedThreatFields: ["startingThreat", "targetThreat", "acceleration"],
    },
    {
      code: "32031a",
      reason:
        "Solid (Shadowcat's mass-form upgrade, Permanent) prints a dash cost; MarvelCDB sends no cost on either face. Same pattern as vision 26002 (docs/phase7-wave6.md \u00a71.2).",
      evidence: 'Card scan assets/card-art/bundles/cards/32031a.png: cost oval "\u2014".',
      specialCost: "dash",
    },
    {
      code: "32171b",
      reason:
        "Metro P.D. (Permanent campaign support) prints a dash cost; MarvelCDB sends no cost (docs/phase7-wave6.md \u00a71.8).",
      evidence: 'Card scan assets/card-art/bundles/cards/32171b.png: cost oval "\u2014".',
      specialCost: "dash",
    },
    {
      code: "32172b",
      reason:
        "Magneto (campaign ally, put into play by a campaign rule or Master Mold's Setup) prints a dash cost; MarvelCDB sends no cost (docs/phase7-wave6.md \u00a71.8).",
      evidence: 'Card scan assets/card-art/bundles/cards/32172b.png: cost oval "\u2014", THW 2, ATK 3 (star), HP 5.',
      specialCost: "dash",
    },
    {
      code: "32174b",
      reason:
        'MarvelCDB titles the obligation "Reactive Defense"; the card prints "Reactivate Defenses", as does 174A\'s own When Defeated text (docs/phase7-wave6.md \u00a71.8).',
      evidence: 'Card scan assets/card-art/bundles/cards/32174b.png: title "Reactivate Defenses".',
      name: "Reactivate Defenses",
    },
    {
      code: "32153",
      reason: 'MarvelCDB drops the word "magnet" from Electromagnetic Blast\'s When Revealed.',
      evidence: 'Card scan assets/card-art/bundles/cards/32153.png: "Place 1 magnet counter on the main scheme."',
      textReplace: { find: "Place 1 counter on the main scheme", replace: "Place 1 magnet counter on the main scheme" },
    },
    {
      code: "32066",
      reason:
        'MarvelCDB reads "deal the damage to Robert Kelly"; the card prints "deal that damage" (the rulebook quotes the same wording).',
      evidence:
        'Card scan assets/card-art/bundles/cards/32066.png; MC32 p. 7 (Robert Kelly): "deal that damage to Robert Kelly".',
      textReplace: { find: "deal the damage to Robert Kelly", replace: "deal that damage to Robert Kelly" },
    },
    {
      code: "32092",
      reason: 'MarvelCDB misspells the card\'s own name in its text ("Wolfbane").',
      evidence: 'Card scan assets/card-art/bundles/cards/32092.png: "Wolfsbane\'s attacks gain piercing."',
      textReplace: { find: "Wolfbane's attacks", replace: "Wolfsbane's attacks" },
    },
    {
      code: "32187",
      reason: 'MarvelCDB misspells "Hero Response" as "Hero Reponse".',
      evidence: 'Card scan assets/card-art/bundles/cards/32187.png: "Hero Response".',
      textReplace: { find: "Hero Reponse", replace: "Hero Response" },
    },
    {
      code: "32191",
      reason: 'MarvelCDB misspells "Hero Response" as "Hero Reponse".',
      evidence: 'Card scan assets/card-art/bundles/cards/32191.png: "Hero Response".',
      textReplace: { find: "Hero Reponse", replace: "Hero Response" },
    },
    {
      code: "32170",
      reason:
        'Nano-Sentinel Tech prints no "Attach to" sentence: its own When Revealed searches for the nemesis minion, puts it into play and attaches this card to it (Old Grudge, sm 27172, precedent; RRG 1.8 "Reveal", p. 38).',
      evidence:
        'Card scan assets/card-art/bundles/cards/32170.png: "When Revealed: Search ... for your nemesis minion. Put it into play engaged with you and attach this card to it."',
      impliedAttachHost: "ownWhenRevealed",
    },
  ],
  errata: [
    {
      code: "32141b",
      version: "RRG 1.8",
      changedFields: ["text"],
      note: "Asteroid M: magnet counters are now removed before the Magnetic card is revealed. MarvelCDB (and the print) carry the old order.",
      evidence:
        "RRG 1.8 p. 68, Mutant Genesis errata; card scan assets/card-art/bundles/cards/32141b.png reads the old order (checked for 32141b).",
      currentReplace: {
        find: "discard cards from the encounter deck until a Magnetic card is discarded. Reveal that card, then remove 3 magnet counters from this scheme.",
        replace:
          "remove 3 of them and discard cards from the encounter deck until a Magnetic card is discarded. Reveal that card.",
      },
    },
    {
      code: "32142b",
      version: "RRG 1.8",
      changedFields: ["text"],
      note: "Factory Online: magnet counters are now removed before the Magnetic card is revealed. MarvelCDB (and the print) carry the old order.",
      evidence:
        "RRG 1.8 p. 68, Mutant Genesis errata; card scan assets/card-art/bundles/cards/32142b.png reads the old order (checked for 32141b).",
      currentReplace: {
        find: "discard cards from the encounter deck until a Magnetic card is discarded. Reveal that card, then remove 3 magnet counters from this scheme.",
        replace:
          "remove 3 of them and discard cards from the encounter deck until a Magnetic card is discarded. Reveal that card.",
      },
    },
    {
      code: "32143b",
      version: "RRG 1.8",
      changedFields: ["text"],
      note: "The Rule of Magnus: magnet counters are now removed before the Magnetic card is revealed. MarvelCDB (and the print) carry the old order.",
      evidence:
        "RRG 1.8 p. 68, Mutant Genesis errata; card scan assets/card-art/bundles/cards/32143b.png reads the old order (checked for 32141b).",
      currentReplace: {
        find: "discard cards from the encounter deck until a Magnetic card is discarded. Reveal that card, then remove 3 magnet counters from this scheme.",
        replace:
          "remove 3 of them and discard cards from the encounter deck until a Magnetic card is discarded. Reveal that card.",
      },
    },
    {
      code: "32088a",
      version: "RRG 1.8",
      changedFields: ["text"],
      note: 'Mutants at the Mall: Jubilee\'s replacement now discards any other ally version of Jubilee (added "ally"). MarvelCDB carries the old text.',
      evidence: "RRG 1.8 p. 68, Mutant Genesis errata (#88A).",
      currentReplace: {
        find: "discarding any other version of Jubilee",
        replace: "discarding any other ally version of Jubilee",
      },
    },
  ],

  scriptingNotes: {},
  cardNotes: {
    "32066":
      "Robert Kelly prints a dash for both THW and ATK (scan 32066.png): he never thwarts or attacks. Cost 0, HP 9, Senator ally the first player controls.",
    "32080":
      "Mystique prints a star on both SCH and ATK (scan 32080.png): her own text sets them equal to the villain's SCH and ATK. The stat boxes carry 0 and the ability is the value.",
  },

  scenarios: [],
  starterDecks: [],
};
