/**
 * NeXt Evolution (MC40, cycle 7 campaign box) curation, pass 1: cards only. Cable and Domino hero kits, five
 * scenarios' encounter cards, the modular sets and the campaign cards 190-204. docs/phase7-wave7.md is the working
 * spec; the scenario records, starter decks and the hand-authored `campaign.ts` are later passes (docs/
 * phase7-wave7-data-survey.md §8 steps 5-7), so `scenarios` and `starterDecks` are empty here.
 *
 * Evidence abbreviations: "scan" is `assets/card-art/bundles/cards/<code>.png` (gitignored, read directly, small
 * scans enlarged; never wired into the data), "RRG" is the v1.8 rules reference, "survey" is
 * docs/phase7-wave7-data-survey.md. The survey (`survey.ts --pack next_evol`) reported 40 lines on the bare
 * curation, all resolved below: the typos (§4.6), the 40154 type, the 40139b dashes, eight dash costs, 40130's
 * star stats and the attach hosts.
 */
import type { PackCuration } from "./types.ts";

const IDENTITY_TYPO_EVIDENCE =
  'Card scan assets/card-art/bundles/cards/%CODE%.png: "Attach to your identity." (Stryfe condition template, all four read).';

export const NEXT_EVOL_CURATION: PackCuration = {
  packCode: "next_evol",
  cycle: { id: "cycle7", name: "NeXt Evolution", order: 7 },
  pack: {
    name: "NeXt Evolution",
    releaseDate: "2023-08-18",
    releaseDateSource:
      "docs/phase7-wave7-sources.md release table (August 18, 2023; Hall of Heroes https://hallofheroeslcg.com/next-evolution/)",
  },
  outDir: "src/data/next_evol",
  exportPrefix: "NEXT_EVOL",
  // MarvelCDB has no campaign record (docs/campaign-mode-design.md §3): `campaign.ts` (`NEXT_EVOL_CAMPAIGN`) is
  // hand-authored, step 7. Ingest refuses a named module whose file is missing.
  handAuthoredModules: ["campaign"],

  corrections: [
    ...["40170", "40171", "40172", "40173"].map((code) => ({
      code,
      reason: 'MarvelCDB misspells the attach sentence as "Attach to your identify.", which the parser rejects.',
      evidence: IDENTITY_TYPO_EVIDENCE.replace("%CODE%", code),
      textReplace: { find: "Attach to your identify.", replace: "Attach to your identity." },
    })),
    {
      code: "40144",
      reason:
        'MarvelCDB misspells the villain as "Minister Sinister" in the attach sentence; the parser would read a named card that never matches.',
      evidence: 'Card scan assets/card-art/bundles/cards/40144.png: "Attach to Mister Sinister."',
      textReplace: { find: "Attach to Minister Sinister.", replace: "Attach to Mister Sinister." },
    },
    {
      code: "40144",
      reason: 'The same misspelling in the Forced Interrupt ("damage to Minister Sinister").',
      evidence:
        'Card scan assets/card-art/bundles/cards/40144.png: "When a player would deal damage to Mister Sinister".',
      textReplace: { find: "damage to Minister Sinister,", replace: "damage to Mister Sinister," },
    },
    {
      code: "40145",
      reason: 'MarvelCDB misspells the villain as "Minister Sinister" in the first line (the Boost line is right).',
      evidence:
        'Card scan assets/card-art/bundles/cards/40145.png: "for each SUPERPOWER attachment on Mister Sinister."',
      textReplace: { find: "attachment on Minister Sinister.", replace: "attachment on Mister Sinister." },
    },
    {
      code: "40121a",
      reason: 'MarvelCDB reads "Put Home Summers into play" in the Setup sentence; the ally is Hope Summers.',
      evidence:
        'Card scan assets/card-art/bundles/cards/40121a.png (enlarged): "Put Hope Summers into play under the first player\'s control." (40121 and 40121b carry no such sentence.)',
      textReplace: { find: "Put Home Summers", replace: "Put Hope Summers" },
    },
    {
      code: "40188",
      reason: 'MarvelCDB misspells the card\'s own name in its text ("Samarai").',
      evidence:
        'Card scan assets/card-art/bundles/cards/40188.png: "After Samurai attacks you, place 1 charge counter here."',
      textReplace: { find: "After Samarai attacks", replace: "After Samurai attacks" },
    },
    {
      code: "40130",
      reason:
        'MarvelCDB writes "Hope Summer\'s base THW and base ATK"; the card prints the possessive "Hope Summers\'s".',
      evidence:
        'Card scan assets/card-art/bundles/cards/40130.png: "Hope Summers\'s base THW and base ATK are equal to the THW and ATK of your hero."',
      textReplace: { find: "Hope Summer's base", replace: "Hope Summers's base" },
    },
    {
      code: "40130",
      reason:
        "Hope Summers (encounter-set ally, put into play by Setup) prints a dash cost; MarvelCDB sends no cost. THW and ATK are stars (cardNotes).",
      evidence: 'Card scan assets/card-art/bundles/cards/40130.png: cost oval "—", THW star, ATK star, HP 3.',
      specialCost: "dash",
    },
    {
      code: "40079",
      reason: "Morlock (encounter-set ally) prints a dash cost; MarvelCDB sends no cost.",
      evidence: 'Card scan assets/card-art/bundles/cards/40079.png: cost oval "—", THW 1, ATK 1, HP 5.',
      specialCost: "dash",
    },
    {
      code: "40037a",
      reason:
        'MarvelCDB reads "discarded from the top of the deck"; Domino prints "your deck". The icon stays [wild], as MarvelCDB has it.',
      evidence:
        'Card scan assets/card-art/bundles/cards/40037a.png (enlarged): "When counting resources on cards discarded from the top of your deck, count each printed [wild] icon twice." The icon is the wild resource, not physical (the rulebook markdown\'s [physical] is a conversion error).',
      textReplace: { find: "top of the deck", replace: "top of your deck" },
    },
    {
      code: "40154",
      reason: "MarvelCDB types High Ground as an attachment; it is a treachery (When Revealed, no attach rule).",
      evidence: "Card scan assets/card-art/bundles/cards/40154.png: type line TREACHERY, no attach sentence.",
      cardType: "treachery",
    },
    {
      code: "40092",
      reason:
        "Inhibitor Collar's red -1 ATK badge is the attachment stat box; stated explicitly so the attachment's attack modifier is not lost.",
      evidence: "Card scan assets/card-art/bundles/cards/40092.png: ATK badge −1.",
      attack: -1,
    },
    {
      code: "40173",
      reason:
        "Psychic Inertia prints two stat badges, -1 THW and -1 ATK. MarvelCDB sends attack -1 (read as a printed X without this) and files the THW badge under scheme.",
      evidence: "Card scan assets/card-art/bundles/cards/40173.png: badges −1 THW and −1 ATK.",
      attack: -1,
      thwart: -1,
    },
    {
      code: "40139b",
      reason:
        'Sinister Intent 1B prints a dash in the target-threat oval and both bottom boxes (RRG 1.8 "Dash (Value)", p. 15); MarvelCDB sends no threat values. It advances only through its own When Revealed.',
      evidence:
        'Card scan assets/card-art/bundles/cards/40139b.png (enlarged): target oval "—", both bottom boxes "—".',
      dashedThreatFields: ["startingThreat", "targetThreat", "acceleration"],
    },
    ...["40190a", "40191a", "40192a", "40193a", "40194a", "40195a"].map((code) => ({
      code,
      reason: "Campaign player side scheme (side A) prints a dash cost; MarvelCDB sends no cost.",
      evidence: `Card scan assets/card-art/bundles/cards/${code}.png (enlarged): cost box at the top right prints a dash.`,
      specialCost: "dash" as const,
    })),
    {
      code: "40105a",
      reason:
        "Hope's Captor prints no \"Attach to\" sentence: main scheme 40103's Setup attaches it to the villain (Permanent).",
      evidence:
        'Card scan assets/card-art/bundles/cards/40105a.png: Permanent, "reset attached villain\'s hit points".',
      impliedAttachHost: { kind: "villain" },
    },
    {
      code: "40123",
      reason:
        'Head of Steam prints its attach clause inside its own When Revealed ("Attach Head of Steam to Juggernaut and place 1 momentum counter on him"); Juggernaut is the scenario\'s villain.',
      evidence:
        'Card scan assets/card-art/bundles/cards/40123.png: "When Revealed: Attach Head of Steam to Juggernaut ..."',
      impliedAttachHost: { kind: "villain" },
    },
    {
      code: "40169",
      reason:
        "Mental Transferal's host is conditional (\"If Stryfe's Grasp is in play, attach to Hope Summers. Otherwise, attach to your identity.\"), a shape AttachmentHost cannot say. It is attached by its own reveal; the scripter picks the host (scriptingNotes).",
      evidence:
        'Card scan assets/card-art/bundles/cards/40169.png: "If Stryfe\'s Grasp is in play, attach to Hope Summers. Otherwise, attach to your identity."',
      impliedAttachHost: "ownWhenRevealed",
    },
  ],
  errata: [
    {
      code: "40092",
      version: "RRG 1.8",
      changedFields: ["text"],
      note: 'Inhibitor Collar: "Any player can do this." is now rules text; the print has it as parenthetical reminder text. MarvelCDB carries the current wording.',
      evidence:
        'RRG 1.8 p. 69, NeXt Evolution errata: "Action: Choose to either exhaust a character you control or take 3 damage → discard this card. Any player can do this."; card scan assets/card-art/bundles/cards/40092.png prints "(Any player can do this.)" in italics.',
      printedReplace: {
        find: "discard this card. Any player can do this.",
        replace: "discard this card. (Any player can do this.)",
      },
    },
  ],

  scriptingNotes: {
    "40169.mental-transferal-constant":
      "Host is conditional: attach to Hope Summers if Stryfe's Grasp (40168a) is in play, otherwise to the revealing player's identity.",
  },
  cardNotes: {
    "40130":
      "Hope Summers prints a star on both THW and ATK (scan 40130.png): her own text sets her base THW and ATK equal to the first player's hero's. The stat boxes carry 0 and the ability is the value. Dash cost, HP 3.",
  },

  identityDeckbuilding: {
    "40001a": { offAspectAllowance: { cardType: "player_side_scheme" } },
  },

  scenarios: [],
  starterDecks: [],
};
