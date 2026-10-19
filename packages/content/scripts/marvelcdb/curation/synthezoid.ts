/**
 * Synthezoid Smackdown (MC57) curation: the scenario pack's 81 top-level MarvelCDB records, no heroes. She-Hulk
 * (registration) and Vision (resistance) are four-stage leaders (`printedType: "leader"`) with a 10-card set each, four
 * main scheme stages (two cards of two stages, one per side), eight 5-card modular sets, eight competitive-only leader
 * player cards and the Standard PvP set printed again. The two preconstructed scenarios are below.
 *
 * CHRONOLOGY (owner decision 2026-10-19, docs/phase7-synthezoid.md): the pack is cycle 10 ("Civil War"), released after
 * Civil War (2025-10-17) and before Wonder Man (2026-02-20). It is never grouped with Fear No Evil (cycle 11).
 *
 * Evidence abbreviations: "scan" is `assets/card-art/bundles/cards/<code>.png` (gitignored, read directly, never wired
 * into the data), "MC57 p. N" is the box rulebook (docs/campaign-modes/mc57_rulebook-web.pdf, printed pages), "RRG" is
 * the v1.8 rules reference, "survey" is docs/phase7-synthezoid-survey.md and "spec" is docs/phase7-synthezoid.md.
 *
 * Faces with no local scan (recorded here because no scan can check them; survey section 4): the main scheme faces
 * 57005a, 57005b, 57006a, 57006b, 57044a, 57044b, 57045a, 57045b (the MC57 rulebook's competitive diagrams, pp. 10 to
 * 11, print 57005b and 57044b in full), and the PvP reprints 57036 to 57039a/b and 57078 to 57081a/b (the Civil War
 * scans 56125 to 56128 and 56203 to 56206 are stand-ins; their text is identical, the collector number differs).
 */
import type { CivilWarSide } from "../../../src/schema/index.ts";
import type { Correction, EncounterSetCuration, PackCuration, ScenarioCuration } from "./types.ts";

const REGISTRATION: CivilWarSide = "registration";
const RESISTANCE: CivilWarSide = "resistance";

const sided = (side: CivilWarSide, extra: Partial<EncounterSetCuration> = {}): EncounterSetCuration => ({
  side,
  ...extra,
});

/** One Standard PvP printing's evidence (the set is printed once per side, as in Civil War). */
const PVP_EVIDENCE =
  'MC57 p. 3 ("1 Standard PvP Encounter Set") and the competitive diagrams (pp. 10 to 11) print Choosing Sides as 128A beside the registration area and 206A beside the resistance area. MarvelCDB files both printings under `standard_pvp` with `duplicate_of_code` naming the Civil War cards (56125 to 56128a, 56203 to 56206a); spec section 1.6: emitted as two side-tagged competitive-only sets so a decklist or a printed-number lookup of 570xx resolves, with each card keeping `duplicateOfCardId`.';

const fiveCardScenario = (s: {
  readonly id: string;
  readonly name: string;
  readonly side: CivilWarSide;
  readonly villainSetCode: string;
  readonly mainSchemeSetCode: string;
  readonly recommendedModularSetCodes: readonly string[];
  readonly stages: readonly [string, string];
  readonly evidence: string;
}): ScenarioCuration => ({
  id: s.id,
  name: s.name,
  villainSetCode: s.villainSetCode,
  mainSchemeSetCode: s.mainSchemeSetCode,
  recommendedModularSetCodes: s.recommendedModularSetCodes,
  standardSetCodes: ["standard"],
  expertSetCodes: ["expert"],
  // "Leader (I), Leader (II)" standard; "(III), (IV)" for expert (MC57 pp. 6 and 7).
  villainStages: { standard: [1, 2], expert: [3, 4] },
  // The precon uses all four of the pack's sets (MC57 pp. 6 and 7); a custom scenario takes three or four (MC56 p. 4).
  modularSetCount: 4,
  modularSetCountRange: { min: 3, max: 4 },
  side: s.side,
  recommendedMainSchemeStageCodes: s.stages,
  evidence: s.evidence,
});

const choosingSides = (code: string, copyOf: string): Correction => ({
  code,
  reason: `MarvelCDB sends no starting threat (\`base_threat: null\`) for Choosing Sides ${code}. The card is the reprint of Civil War's ${copyOf}, which prints 4 with the per player icon.`,
  evidence: `Scan ${copyOf}.png (read 2026-10-18, spec section 1.6 and survey section 4): "4" with the per player icon, no scheme icons; the raw record of ${copyOf} carries base_threat 4 and base_threat_fixed false. Scan of ${code} itself does not exist yet (the reprints have no local scan): check it when one arrives.`,
  startingThreat: 4,
});

export const SYNTHEZOID_CURATION: PackCuration = {
  packCode: "synthezoid",
  cycle: { id: "cycle10", name: "Civil War", order: 10 },
  pack: {
    name: "Synthezoid Smackdown",
    // Hall of Heroes says only "December, 2025" (no day). The 2025-12-05 below is the US availability date a source
    // gave (Fantasy Flight Games / Asmodee listing); the same listing says select markets had it on 2025-11-21. Both
    // fall after Civil War (2025-10-17) and before Wonder Man (2026-02-20), so the order does not depend on the choice.
    releaseDate: "2025-12-05",
    releaseDateSource:
      'Hall of Heroes Synthezoid Smackdown page (https://hallofheroeslcg.com/synthezoid-smackdown/), used as a pointer: "Release date: December, 2025" with no day (hallofheroes-llms.txt). The day is UNCHECKED against a primary source: a search (2026-10-18, survey section 1) returned an FFG announcement that the pack was available in select markets on 2025-11-21 and in the US on 2025-12-05 (Asmodee listing). 2025-12-05 is recorded; either date puts the pack after Civil War and before Wonder Man. The date is not printed in the MC57 rulebook.',
  },
  outDir: "src/data/synthezoid",
  exportPrefix: "SYNTHEZOID",
  handAuthoredModules: [],
  keepStagePrintedCardIds: ["synthezoid_registration", "synthezoid_resistance"],

  corrections: [
    // M2 (spec section 3): "Mass form." is a label, not the identity-form keyword.
    ...(["57046a", "57046b"] as const).map((code): Correction => ({
      code,
      reason: `${code} prints "Mass form." as a label: the Vision leader stages (57040, 57042) name "Vision's mass form attachment". The keyword parser reads every "X form." line as the identity \`form\` keyword that grants an identity extra forms (RRG 1.8 "Form, Change Form", p. 21), which this encounter attachment does not.`,
      evidence: `Scan ${code}.png (survey section 4: both faces exist as PNG, read before scripting) prints "Permanent. Mass form." with no form rule; 57040 and 57042 Setup text: "The enemy team finds Vision's mass form attachment and attaches it to Vision, Dense side faceup." RRG 1.8 "Form, Change Form" (p. 21) is about identities. Text is kept as printed; only the keyword is withheld.`,
      labelSentences: ["Mass form."],
    })),
    // Dense has no "Attach to" sentence (survey gap G4): Vision's Setup attaches it. Same shape as cw 56098 and 56174.
    {
      code: "57046a",
      reason:
        'Dense (the front of the double-sided Dense / Intangible attachment) prints no "Attach to" sentence: Vision\'s Setup attaches it ("The enemy team finds Vision\'s mass form attachment and attaches it to Vision, Dense side faceup."). Without the field the normalizer reports an attachment with no attach rule. Never applied to text. The host is the leader, a villain-kind host like "Attach to Iron Man." (cw 56065).',
      evidence:
        'Raw text of 57046a ("Permanent. Mass form.") and the Setup of 57040 and 57042; spec section 2.2 and section 8.1 D3 item 4; cw Energy Channel 56098 and Finesse 56174 are the same shape.',
      impliedAttachHost: { kind: "villain" },
    },
    // Mad Jack's Platform: the chooser (the Resistance Fighter 56191 shape).
    {
      code: "57029",
      reason: `Mad Jack's Platform prints "Attach to a minion of the enemy team's choice." The parser reads the host (a minion) and drops the chooser; the engine asks for a data host at the reveal without reading any ability, so the chooser is data. Never applied to text.`,
      evidence: `Raw text of 57029: "Attach to a minion of the enemy team's choice. Otherwise, this card gains surge." MC57 p. 4 (the enemy team is the players, resolved by the grim rule, word for word MC56 p. 6); owner's answer 6 = A of wave 10 (the first player makes the choice, in a prompt marked as the enemy team's). The cw twin is Resistance Fighter 56191.`,
      hostChosenBy: "enemyTeam",
    },
    // Choosing Sides (the PvP reprints): starting threat 4 per player.
    choosingSides("57039a", "56128a"),
    choosingSides("57081a", "56206a"),
  ],

  // One Standard PvP set printed twice (registration copy 57036 to 57039, resistance copy 57078 to 57081).
  setRecodes: [
    {
      codes: ["57036", "57037", "57038", "57039a"],
      setCode: "standard_pvp_registration_mc57",
      setName: "Standard PvP (Registration, Synthezoid Smackdown)",
      reason:
        "MarvelCDB files the registration printing under `standard_pvp`, the same set code as the resistance printing; the side exists only in the code range.",
      evidence: PVP_EVIDENCE,
    },
    {
      codes: ["57078", "57079", "57080", "57081a"],
      setCode: "standard_pvp_resistance_mc57",
      setName: "Standard PvP (Resistance, Synthezoid Smackdown)",
      reason:
        "MarvelCDB files the resistance printing under `standard_pvp`, the same set code as the registration printing; the side exists only in the code range.",
      evidence: PVP_EVIDENCE,
    },
  ],

  encounterSets: {
    // Sides: the leader's colors (MC57 p. 3; the precon pages 6 and 7; spec section 1.3).
    she_hulk_leader: sided(REGISTRATION),
    synthezoid_registration: sided(REGISTRATION),
    shield_ops: sided(REGISTRATION),
    thunderbolts_modular: sided(REGISTRATION),
    taskmaster_modular: sided(REGISTRATION),
    deadly_duo: sided(REGISTRATION),
    standard_pvp_registration_mc57: sided(REGISTRATION, { competitiveOnly: true }),
    vision_leader: sided(RESISTANCE),
    synthezoid_resistance: sided(RESISTANCE),
    young_avengers: sided(RESISTANCE),
    scarlet_twins: sided(RESISTANCE),
    moon_knight_modular: sided(RESISTANCE),
    royal_guard: sided(RESISTANCE),
    standard_pvp_resistance_mc57: sided(RESISTANCE, { competitiveOnly: true }),
  },

  errata: [
    {
      code: "57065",
      version: "RRG 1.8",
      changedFields: ["text"],
      note: 'Moon Knight (Moon Knight modular set minion): the When Revealed gains "(Limit once per phase.)". MarvelCDB still carries the printed wording.',
      evidence:
        'RRG 1.8 Appendix V, "Synthezoid Smackdown Scenario Pack" (p. 70, mc_rulesreference_v18_compressed.md lines 5182 to 5186): "MOON KNIGHT (#65) Should read: When Revealed: Resolve the \\"When Revealed\\" ability of the topmost treachery in the encounter discard pile. (Limit once per phase.) (Added \\"(Limit once per phase.)\\")"',
      currentReplace: {
        find: "topmost treachery in the encounter discard pile.",
        replace: "topmost treachery in the encounter discard pile. (Limit once per phase.)",
      },
    },
    {
      code: "57076",
      version: "RRG 1.8",
      changedFields: ["text"],
      note: 'Phased Out (Vision basic event, competitive only): "Hero Interrupt" is "Hero Action". The card chooses an attachment with the text "Hero Action" or "Hero Response". MarvelCDB still carries the printed wording.',
      evidence:
        'RRG 1.8 Appendix V, "Synthezoid Smackdown Scenario Pack" (p. 70, lines 5188 to 5190): "PHASED OUT (#76) Should read: Action: Choose an attachment on the enemy leader with the text \'Hero Action\' or \'Hero Response\' and discard it. (Changed \\"Hero Interrupt\\" to \\"Hero Action\\".)" FFG ruling March 19, 2026, Ruling 1 (marvel-champions-rulings-post-rrg-1-7.md lines 644 to 652): the card should have said "Hero Action". The two agree. Printed order is "Hero Response" or "Hero Interrupt"; the RRG lists the current pair as Hero Action then Hero Response.',
      currentReplace: {
        find: '"Hero Response" or "Hero Interrupt"',
        replace: '"Hero Action" or "Hero Response"',
      },
    },
  ],

  scriptingNotes: {},
  cardNotes: {
    "57005a":
      "Registration main scheme card (stages 57005a/b and 57006a/b); no local scan of any of the four faces. The A faces are word for word Civil War's registration 1A and 2A (checked against the cw record, not a scan). 57005b Enforce the Law has the same text as Civil War's 56200b Going Underground and 57006b Mighty Avengers the same as 56142b Secret Avengers (survey section 2). The MC57 rulebook's competitive diagram (p. 10) prints 57005b in full.",
    "57044a":
      "Resistance main scheme card (stages 57044a/b and 57045a/b); no local scan of any of the four faces. The A faces are word for word Civil War's resistance 1A and 2A (checked against the cw record, not a scan). 57044b Protect Secret Identities has the same text as Civil War's 56122b Public Outrage (the raw escalation field is starred because the text mentions threat) and 57045b Expose Overreach the same as 56124b No Going Back. The MC57 rulebook's competitive diagram (p. 11) prints 57044b in full.",
    "57036":
      "PvP reprint of 56125 with no local scan (the Civil War scan is a stand-in). Boost icons are not recorded on the raw record; take them from 56125.",
    "57037":
      "PvP reprint of 56126 with no local scan (the Civil War scan is a stand-in). Boost icons are not recorded on the raw record; take them from 56126.",
    "57038": "PvP reprint of 56127 with no local scan (the Civil War scan is a stand-in).",
    "57039a":
      "PvP reprint of Choosing Sides 56128a with no local scan; starting threat 4 per player is taken from the Civil War copy (correction). Prints no scheme icons on the Civil War copy.",
    "57039b": "PvP reprint of Now It's Personal 56128b with no local scan (the Civil War scan is a stand-in).",
    "57078":
      "PvP reprint of 56203 with no local scan (the Civil War scan is a stand-in). Boost icons are not recorded on the raw record.",
    "57079":
      "PvP reprint of 56204 with no local scan (the Civil War scan is a stand-in). Boost icons are not recorded on the raw record.",
    "57080": "PvP reprint of 56205 with no local scan (the Civil War scan is a stand-in).",
    "57081a":
      "PvP reprint of Choosing Sides 56206a with no local scan; starting threat 4 per player is taken from the Civil War copy (correction).",
    "57081b": "PvP reprint of Now It's Personal 56206b with no local scan (the Civil War scan is a stand-in).",
    "57046a":
      "Dense (ATK 1, front) and Intangible (SCH 1, back) of the one double-sided permanent attachment; boost icons are not recorded on the raw record and are read from the scan before scripting (survey section 4).",
    "57012":
      "Legal Practice prints 3 starting threat with the per player icon (scan 57012.png, read 2026-10-18; survey section 4).",
    "57054":
      "Just Passing Through prints 3 starting threat with the per player icon (scan 57054.png, read 2026-10-18; survey section 4).",
    "57016":
      "Homeland Security prints a plain 3 starting threat (fixed; scan 57016.png, read 2026-10-18; survey section 4). The other seven fixed side scheme thresholds (57021, 57026, 57031, 57059, 57064, 57068, 57073) are raw only, unchecked against scans.",
  },

  // The two main scheme cards: MarvelCDB sends no image path for any of their faces and no local scan exists (header,
  // `cardNotes`). Named by card id, which exempts each art-less face of the card (checks.ts).
  artUnavailable: {
    "57005a":
      "MarvelCDB sends imagesrc null for 57005a, 57005b, 57006a and 57006b (as for every Civil War main scheme face, which the client finds as a local scan); the pack's four scans are not in assets/card-art/bundles/cards (survey section 4).",
    "57044a":
      "MarvelCDB sends imagesrc null for 57044a, 57044b, 57045a and 57045b; the pack's four scans are not in assets/card-art/bundles/cards (survey section 4).",
  },

  scenarios: [
    fiveCardScenario({
      id: "registration-she-hulk",
      name: "Registration: She-Hulk",
      side: REGISTRATION,
      villainSetCode: "she_hulk_leader",
      mainSchemeSetCode: "synthezoid_registration",
      recommendedModularSetCodes: ["shield_ops", "thunderbolts_modular", "taskmaster_modular", "deadly_duo"],
      stages: ["57005b", "57006b"],
      evidence:
        'MC57 p. 6: "Leader Deck: She-Hulk (I), She-Hulk (II) ... (III), (IV) for expert mode. Main Scheme Deck: Enforce the Law (1B), Mighty Avengers (2B). Encounter Deck: She-Hulk, S.H.I.E.L.D. Ops, Thunderbolts, Taskmaster, Deadly Duo, and Standard encounter sets." (spec section 2.1, read from the rulebook). Each set can be removed and added to other scenarios of the same side (MC57 p. 6; MC56 p. 4).',
    }),
    fiveCardScenario({
      id: "resistance-vision",
      name: "Resistance: Vision",
      side: RESISTANCE,
      villainSetCode: "vision_leader",
      mainSchemeSetCode: "synthezoid_resistance",
      recommendedModularSetCodes: ["young_avengers", "scarlet_twins", "moon_knight_modular", "royal_guard"],
      stages: ["57044b", "57045b"],
      evidence:
        'MC57 p. 7: "Leader Deck: Vision (I), Vision (II) ... (III), (IV) for expert mode. Main Scheme Deck: Protect Secret Identities (1B), Expose Overreach (2B). Encounter Deck: Vision, Young Avengers, Scarlet Twins, Moon Knight, Royal Guard, and Standard encounter sets." (spec section 2.2, read from the rulebook).',
    }),
  ],

  starterDecks: [],
};
