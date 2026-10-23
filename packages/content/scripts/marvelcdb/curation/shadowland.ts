/**
 * Shadowland Scenario Pack (MC65, cycle 11, released 2026-10-16) curation: a scenario pack with no heroes, three
 * scenarios (Shadows in the Night, Shadow Labyrinth, Heart of Shadow), the Dark Protégé villain set and three modular
 * sets (Black Flower, Deadly Contraptions, Ninja Swarm), 90 printed cards. MarvelCDB has no Shadowland pack, so there is
 * no raw cache (`scanOnly`) and every record is an added record transcribed from
 * the Hall of Heroes preview scans (docs/phase7-shadowland.md section 3), as Fear No Evil's scenario half was.
 *
 * Every printed card is transcribed: 90 printed copies, 73 distinct card records. The Hall of Heroes previews gave 45 card
 * images (300 x 426); the remaining faces were transcribed from full-size card images, and
 * those images are now saved too, so every face has a scan under `assets/card-art/bundles/cards/` and no
 * `artUnavailable` entry is left (#360 also replaced the 45 preview scans with full-size copies). The three scenario
 * records (`shadowland-scenarios.ts`) are wired in and the pack is in the content index.
 *
 * Evidence abbreviations: "scan" is the Hall of Heroes preview `mc65_cards_<stem>.png` (https://hallofheroeslcg.com/
 * shadowland/; also saved as `assets/card-art/bundles/cards/<code>.png`), "insert" is the box rules insert
 * (docs/campaign-modes/markdown/mc65_shadowland.md, printed pages) and "spec" is docs/phase7-shadowland.md.
 */
import type { Correction, PackCuration } from "./types.ts";
import { SHADOWLAND_SCENARIO_RECORDS } from "./shadowland-scenarios.ts";
import { BLACK_FLOWER_RECORDS } from "./shadowland-encounter/black-flower.ts";
import { DARK_PROTEGE_RECORDS } from "./shadowland-encounter/dark-protege.ts";
import { DEADLY_CONTRAPTIONS_RECORDS } from "./shadowland-encounter/deadly-contraptions.ts";
import { HEART_OF_SHADOW_RECORDS } from "./shadowland-encounter/heart-of-shadow.ts";
import { NINJA_SWARM_RECORDS } from "./shadowland-encounter/ninja-swarm.ts";
import { SHADOW_LABYRINTH_RECORDS } from "./shadowland-encounter/shadow-labyrinth.ts";
import { SHADOWS_IN_THE_NIGHT_RECORDS } from "./shadowland-encounter/shadows-in-the-night.ts";

export const SHADOWLAND_CURATION: PackCuration = {
  packCode: "shadowland",
  // CHRONOLOGY (spec section 1.1, default Q1): cycle 11 with Fear No Evil, Jessica Jones and Luke Cage, placed after
  // Luke Cage (2026-08-21) by release date. The cycle name stays the one those three pack records carry.
  cycle: { id: "cycle11", name: "Fear No Evil", order: 11 },
  pack: {
    name: "Shadowland",
    releaseDate: "2026-10-16",
    releaseDateSource:
      'Hall of Heroes (https://hallofheroeslcg.com/shadowland/, "October 16, 2026", read 2026-10-19; announced 2026-07-27 by FFG, https://www.fantasyflightgames.com/en/news/2026/7/28/creeping-corruption/, product code MC65en). MarvelCDB has no Shadowland pack yet, so the date is not cross-checked there.',
  },
  outDir: "src/data/shadowland",
  exportPrefix: "SHADOWLAND",
  scanOnly: true,
  // MarvelCDB has no campaign record: `campaign.ts` (`SHADOWLAND_CAMPAIGN`) is hand-authored from MC65 pp. 4, 5 (task D4).
  handAuthoredModules: ["campaign"],

  addedRecords: [
    ...SHADOWS_IN_THE_NIGHT_RECORDS,
    ...DARK_PROTEGE_RECORDS,
    ...NINJA_SWARM_RECORDS,
    ...SHADOW_LABYRINTH_RECORDS,
    ...DEADLY_CONTRAPTIONS_RECORDS,
    ...HEART_OF_SHADOW_RECORDS,
    ...BLACK_FLOWER_RECORDS,
  ],

  corrections: [
    {
      code: "65037",
      reason: "Shifting Corridors prints the infinity symbol for hit points (no per player icon).",
      evidence:
        'Scan 65037.png (mc65_cards_shifting_corridors.png), footer "SHADOW LABYRINTH (1/11) / HIT POINTS (infinity)"; insert p. 13 "Infinite Hit Points".',
      infiniteHp: true,
    },
    {
      code: "65038b",
      reason:
        "Into the Labyrinth 1B prints the infinity symbol in the threshold circle: no threat target, the stage ends only through its own Forced Interrupt (the last threat removed).",
      evidence:
        'Image 65038B.webp, top-left circle: infinity symbol; text "When the last threat is removed from this scheme, advance to stage 2A". Encoded as a dashed targetThreat (no value emitted), as the Wave 6 dashed main scheme thresholds are.',
      dashedThreatFields: ["targetThreat"],
    },
    {
      code: "65040",
      reason:
        'Whisper in the Dark prints no "Attach to" sentence: its own When Revealed puts the set-aside chosen villain into play "with this card attached", so it attaches to the villain when it is revealed.',
      evidence:
        'Image 65040.webp, When Revealed text; RRG 1.8 "Reveal" (p. 38) step 2 and the ruling of Feb 20, 2026 (4). Never applied to text.',
      impliedAttachHost: "ownWhenRevealed",
    },
    ...(
      [
        ["65064", "Mark of the Wicked"],
        ["65065", "Pull of Power"],
      ] as const
    ).map(([code, title]): Correction => ({
      code,
      reason: `${title} prints no "Attach to" sentence: its own When Revealed lets the revealing player attach it to their identity ("You may attach this card to your identity. If you do not, ...").`,
      evidence: `Scan ${code}.png, When Revealed text; RRG 1.8 "Reveal" (p. 38) step 2 and the ruling of Feb 20, 2026 (4): an attachment with no "attach to" text attaches when its When Revealed triggers. Never applied to text.`,
      impliedAttachHost: "ownWhenRevealed",
    })),
    ...(["65072a", "65072b"] as const).map((code) => ({
      code,
      reason:
        "Creeping Corruption prints a dash in the cost box: it never has a cost, it enters play through Setup or the campaign instructions.",
      evidence: `Scan ${code}.png (cost box holds a dash); insert pp. 9 and 14 (put into play under each player's control). RRG Dash (Value), p. 15.`,
      specialCost: "dash" as const,
    })),
  ],
  errata: [],
  // Each Dark Protégé villain is ONE double-sided card (A: HP 15 per hero, B: HP 18) flipped by the main scheme.
  villainFlipSets: ["dark_protege"],

  scriptingNotes: {},
  /**
   * Second-pass (D3) uncertainty record: fields the 300 x 426 previews leave less than certain, or that the scans cannot
   * settle. Every other face was read twice (once at 3x with an unsharp mask, once on a per-region 3x/4x crop) and agrees.
   */
  cardNotes: {
    "65003a":
      "Double-sided environment 3A/3B (VILLAIN POSITION). Both faces print the same text; which face starts up is the scenario's Setup (the 1A face, not previewed).",
    "65004a":
      "Double-sided environment 4A/4B (HERO POSITION). The resource icons on side A (two fist-like glyphs, [physical]) and side B (two lightning bolts, [energy]) were matched by glyph against Tenacity 01093 and Media Coverage 02049; a first pass had read side A as [mental].",
    "65010":
      "Two copies are inferred from the footers: this card is 10/13 and the next collector number (11) is 12/13, so 11/13 is a second copy (not previewed).",
    "65011": "Two copies are inferred: this card is 12/13 and the set total is 13 (13/13 not previewed).",
    "65037":
      "SCH and ATK both print 0 with a star (the Forced Interrupt replaces its activation); hit points print the infinity symbol (correction infiniteHp). The preview does not show whether the card has a back face: the footer carries no A/B letter.",
    "65044":
      "Two copies are inferred: this card is 8/11 and Sudden Shift (collector 45) is 10/11, so 9/11 is a second copy (not previewed).",
    "65045": "Two copies are inferred: this card is 10/11 and the set total is 11 (11/11 not previewed).",
    "65018": "Resource icons read by glyph, in print order [energy][mental][physical] (see 65004a).",
    "65057":
      "Krahllak is a three-card villain: stage I (65057, HP 18), II (65058, HP 21), III (65059, HP 25), each one-sided with no B side. Dark Invitation 1A lists Krahllak (I) and (II) for normal mode and (II) and (III) for expert. Stage I's text ('Steady.' plus the Interrupt; no Toughness) was re-checked 2026-10-22 against the Hall of Heroes preview.",
    "65070":
      "Two copies are inferred: this card is 14/17 and Submit or Suffer (collector 71) is 16/17, so 15/17 is a second copy. The corner scheme icon is the hazard icon (card with a plus), as in-text on Strategic Positioning 65008.",
    "65071": "Two copies are inferred: this card is 16/17 and the set total is 17 (17/17 not previewed).",
    "65072a":
      "One double-sided upgrade (72A Setup side, 72B OVERPOWERING side), four copies (positions 1 to 4: Aka's footer is 5/13). The cost box prints a dash on both faces. Side B prints 'If there are at least 5 corruption counters here, you are defeated' (spec Q8).",
  },

  // The three scenario records (`shadowland-scenarios.ts`).
  scenarios: SHADOWLAND_SCENARIO_RECORDS,
  starterDecks: [],
};
