/**
 * Civil War (MC56, cycle 10 custom scenario expansion) curation: the box's 214 top-level MarvelCDB records. Tigra and
 * Hulkling's hero kits, the four leaders (a leader is a four-stage villain, `printedType: "leader"`), each leader's
 * 10-card set and four competitive-only basic player cards, the sixteen main schemes (one card per side, eight stages),
 * the sixteen modular sets and the two printings of the Standard PvP set. The four preconstructed scenarios and the
 * two starter decks are below. Hercules and Wonder Man are separate packs.
 *
 * Evidence abbreviations: "scan" is `assets/card-art/bundles/cards/<code>.png` (gitignored, read directly, never wired
 * into the data), "MC56 p. N" is the box rulebook (docs/campaign-modes/mc56_rulebook-web_1.pdf, printed pages),
 * "RRG" is the v1.8 rules reference, "survey" is docs/phase7-wave10-data-survey.md and "spec" is
 * docs/phase7-wave10.md.
 */
import type { CivilWarSide } from "../../../src/schema/index.ts";
import type { Correction, EncounterSetCuration, PackCuration, ScenarioCuration, StarterDeckCuration } from "./types.ts";

/** A transcription typo in MarvelCDB's text, confirmed against the scan (survey section 10). */
const typo = (code: string, title: string, find: string, replace: string, scanReads: string): Correction => ({
  code,
  reason: `MarvelCDB reads "${find}" in ${title}; the card prints "${replace}".`,
  evidence: `Scan ${code}.png (read 2026-10-11, survey section 10, "checked"): ${scanReads}. Raw text of the same record carries the typo.`,
  textReplace: { find, replace },
});

/** A leader-by-name or implied host for an attachment with no "Attach to" sentence (survey gap G4). */
const ownSetup = (code: string, title: string, setter: string): Correction => ({
  code,
  reason: `${title} prints no "Attach to" sentence: ${setter} attaches it. Without the field the normalizer reports an attachment with no attach rule. Never applied to text.`,
  evidence: `Raw text and scan ${code}.png (the card has no host line); survey gap G4 and spec section 2 (the leader's or another card's Setup / When Revealed attaches it).`,
  impliedAttachHost: "ownWhenRevealed",
});

const REGISTRATION: CivilWarSide = "registration";
const RESISTANCE: CivilWarSide = "resistance";

const sided = (side: CivilWarSide, extra: Partial<EncounterSetCuration> = {}): EncounterSetCuration => ({
  side,
  ...extra,
});

/** One Standard PvP printing's evidence (the set is printed once per side, MC56 pp. 3 and 15). */
const PVP_EVIDENCE =
  'MC56 p. 3 ("1 Standard PvP Encounter Set. This set replaces the standard encounter set when playing in competitive mode") and p. 15 (the callouts print "STANDARD PVP (5/5)" beside each side\'s area). MarvelCDB files both printings under `standard_pvp` (survey sections 3.5 and G3); the owner decided on 2026-10-11 to emit two side-tagged copies of the 5-card set (survey section 11 item 4, recommended default).';

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
  // "Leader (I), Leader (II)" standard; "(III), (IV)" for expert (MC56 pp. 7 and 8; 56063a Contents).
  villainStages: { standard: [1, 2], expert: [3, 4] },
  // The precon recommends four sets; a custom scenario takes three or four from the side (MC56 p. 4).
  modularSetCount: 4,
  modularSetCountRange: { min: 3, max: 4 },
  side: s.side,
  recommendedMainSchemeStageCodes: s.stages,
  evidence: s.evidence,
});

export const CW_CURATION: PackCuration = {
  packCode: "cw",
  cycle: { id: "cycle10", name: "Civil War", order: 10 },
  pack: {
    name: "Civil War",
    releaseDate: "2025-10-17",
    releaseDateSource:
      'Hall of Heroes Civil War page (https://hallofheroeslcg.com/civil-war/), used as a pointer: "Release date: October 17, 2025" (survey section 0 item 5; hallofheroes-llms.txt). The date is not printed in the MC56 rulebook.',
  },
  outDir: "src/data/cw",
  exportPrefix: "CW",
  handAuthoredModules: [],

  corrections: [
    // Five transcription typos (scan checked, survey section 10).
    typo("56023", "In Too Deep", "engage3d", "engaged", 'the Choose line prints "Each minion engaged with you"'),
    typo(
      "56027",
      "Madame Masque's When Revealed",
      "Underwold",
      "Underworld",
      'the When Revealed prints "Criminal Underworld side scheme"',
    ),
    typo(
      "56086",
      "S.H.I.E.L.D. Helicarrier's When Defeated",
      "1 damager to",
      "1 damage to",
      'the When Defeated prints "deals 1 damage to each character they control"',
    ),
    typo("56158", "Switching Sides", "enmy", "enemy", 'the When Revealed prints "any player on the enemy team"'),
    typo("56178", "Inconspicuous", "Chooose", "Choose", 'the When Revealed prints "Choose:" over two bullets'),
    {
      code: "56069",
      reason:
        'MarvelCDB labels the Mark V Armor ability "Forced Response: When Iron Man would take any amount of damage, place it here instead."; the card prints "Forced Interrupt". "Would take" is an interrupt window: as a Forced Response it would open after the damage was taken, with nothing left to replace.',
      evidence:
        'Scan 56069.png (read in the registration scan check, docs/phase7-wave10-scan-check-cw-registration.md, "Corrections owed in the data" item 2): the label is Forced Interrupt; the rest of the text is unchanged.',
      textReplace: {
        find: "Forced Response: When Iron Man would take",
        replace: "Forced Interrupt: When Iron Man would take",
      },
    },
    ...(["56127", "56205"] as const).map((code): Correction => ({
      code,
      reason: `MarvelCDB reads "The card gains [boost] for each player on your team." in Targeted Strike's Boost; the card prints "This card gains".`,
      evidence: `Scan ${code}.png (docs/phase7-wave10-scan-check-cw-registration.md item 5 for 56127; docs/phase7-wave10-scan-check-cw-resistance.md item 3 for 56205): both printings read "This card gains [boost] for each player on your team."`,
      textReplace: { find: "The card gains [boost]", replace: "This card gains [boost]" },
    })),
    {
      code: "56118",
      reason: `MarvelCDB reads "Attack to Paladin." in Paladin's Pistol; the card prints "Attach to Paladin. Otherwise, attach to the enemy leader." Without the fix the normalizer finds no attach rule.`,
      evidence:
        'Scan 56118.png (read 2026-10-11, survey section 10, checked): the host line is "Attach to Paladin." The ifAble host (Paladin, otherwise the enemy leader) follows from the second sentence.',
      textReplace: { find: "Attack to Paladin.", replace: "Attach to Paladin." },
    },
    // Iron Man III: the one leader whose first stage prints "When Revealed" in the cache where the card prints "Setup".
    {
      code: "56061",
      reason:
        'MarvelCDB labels Iron Man III\'s ability "When Revealed: The enemy team searches the encounter deck for an Iron Man attachment and your team reveals it." The card prints "Setup:", like every other first leader stage (56059, 56092, 56094, 56137, 56139, 56168, 56170). Left as a When Revealed it would never resolve in expert mode, when stage III is the leader put into play at setup.',
      evidence:
        'Scan 56061.png (read 2026-10-11): the text box ends "Setup: The enemy team searches the encounter deck for an Iron Man attachment and your team reveals it." (footer "IRON MAN (3/14) / HIT POINTS 16"). Spec section 4.1 question 8 (closed) and section 8.1 item 3; survey section 3.1.',
      textReplace: {
        find: "When Revealed: The enemy team searches the encounter deck for an Iron Man attachment",
        replace: "Setup: The enemy team searches the encounter deck for an Iron Man attachment",
      },
    },
    {
      code: "56055",
      reason:
        'Super Skrull is Hulkling\'s nemesis minion (his nemesis set is 56055 to 56058) but prints no Nemesis reminder line, so the parser cannot set the flag. Without it, "your nemesis minion" finds nothing for Hulkling. Never applied to text.',
      evidence:
        "docs/phase7-wave10-box-heroes.md B8.1 (correction owed: nemesisMinion on 56055, prints no reminder line); raw/marvelcdb/cw.json 56055 is the minion of the hulkling nemesis set; The Hood 56024 (Tigra) is the parsed counterpart.",
      nemesisMinion: true,
    },
    // Attachments with no "Attach to" sentence (survey gap G4).
    ownSetup(
      "56057",
      "Fantastic Powers",
      "Super Skrull's own When Revealed (56055: find Super Skrull and attach it to him)",
    ),
    ownSetup("56080", "Drafted", "its own When Revealed (it attaches itself to a revealed or chosen minion)"),
    {
      code: "56098",
      reason:
        'Energy Channel prints no "Attach to" sentence: Captain Marvel\'s Setup attaches it. Without the field the normalizer reports an attachment with no attach rule. Never applied to text. The host is the leader, a villain-kind host like "Attach to Iron Man." (56065).',
      evidence:
        'Scan 56098.png (read 2026-10-11): no host line, "Permanent." then the Forced Response. Spec section 2.3 (Captain Marvel\'s Setup finds the permanent attachment and attaches it); survey gap G4.',
      impliedAttachHost: { kind: "villain" },
    },
    {
      code: "56174",
      reason:
        'Finesse prints no "Attach to" sentence: Spider-Woman\'s Setup attaches it ("The enemy team finds Finesse and attaches it to Spider-Woman."). Never applied to text. The host is the leader, a villain-kind host like "Attach to Iron Man." (56065).',
      evidence:
        'Scan 56168.png (read 2026-10-11): "Setup: The enemy team finds Finesse and attaches it to Spider-Woman." Spec section 2.5; survey gap G4.',
      impliedAttachHost: { kind: "villain" },
    },
    {
      code: "56084",
      reason:
        'Life Model Decoy prints "The enemy team attaches this card to a minion or their leader. (Limit 1 per character.)", a sentence the parser does not read as an attach rule. Never applied to text; "their leader" is the enemy leader (MC56 p. 6: in cooperative play the leader in play is "the enemy leader"; RRG p. 26 a leader follows the villain rules).',
      evidence:
        'Raw text and Maria Hill 56083 scan (read 2026-10-11): "The enemy team searches the encounter deck and discard pile for a copy of Life Model Decoy and attaches it to Maria Hill." Survey gap G4 ("a minion or their leader").',
      impliedAttachHost: { kind: "anyOf", hosts: [{ kind: "minion" }, { kind: "leader", of: "enemy" }] },
    },
    {
      code: "56084",
      reason: `Life Model Decoy's attach sentence gives the choice of host to the enemy team ("The enemy team attaches this card to a minion or their leader.") and carries a limit in parentheses ("(Limit 1 per character.)"), which the parser does not read as a restriction on an encounter card. Both are data, because the engine applies a data host at the reveal without reading any ability: a character already holding a copy is not a legal host, and several legal hosts are the enemy team's choice. Never applied to text.`,
      evidence: `Raw text of 56084 (both sentences as quoted). RRG 1.8 "Max, Maximum" (p. 28): "'Max 1 per [game element]' restricts the number of copies of that card that can be attached to each indicated game element"; "Attach To" (p. 8): legality is checked when the card would be attached. MC56 p. 6: "Any rule or ability that refers to 'the enemy team' refers to the players. Resolve these abilities using the grim rule". Owner's answer to spec question 6 = A (2026-10-11): the first player makes the choice in a prompt marked as the enemy team's.`,
      hostChosenBy: "enemyTeam",
      attachmentMaxPerHost: 1,
    },
    {
      code: "56191",
      reason: `Resistance Fighter prints "Attach to a minion of the enemy team's choice." The parser reads the host (a minion) and drops the chooser; the engine asks for a data host at the reveal without reading any ability, so the chooser is data. Never applied to text.`,
      evidence: `Raw text of 56191: "Attach to a minion of the enemy team's choice. Otherwise, this card gains surge." MC56 p. 6 (the enemy team is the players, resolved by the grim rule); owner's answer to spec question 6 = A (2026-10-11). Survey gap G5.`,
      hostChosenBy: "enemyTeam",
    },
    // Yellow Jacket's title erratum (RRG 1.8 p. 70): MarvelCDB carries the printed title; the schema holds one `name`.
    ...(["56019", "56073"] as const).map((code): Correction => ({
      code,
      reason: `MarvelCDB carries the printed title "Yellow Jacket"; RRG 1.8 Appendix V (p. 70) corrects it to "Yellowjacket". The card has one \`name\` field, which the engine matches by title (the Yellowjacket villain, "Attach to Yellowjacket", the unique rule), so it holds the current title; the printed title is kept in the errata record (\`errata\` below) and the provenance note.`,
      evidence: `RRG 1.8 Appendix V, "Civil War Expansion", p. 70: "YELLOW JACKET (#${code.slice(3)}): Title should read \\"Yellowjacket\\"." Scan ${code}.png prints "Yellow Jacket". The flavor of 56123b prints "Yellowjacket".`,
      name: "Yellowjacket",
    })),
  ],

  // One Standard PvP set printed twice (registration copy 56125 to 56128, resistance copy 56203 to 56206).
  setRecodes: [
    {
      codes: ["56125", "56126", "56127", "56128a"],
      setCode: "standard_pvp_registration",
      setName: "Standard PvP (Registration)",
      reason:
        "MarvelCDB files the registration printing under `standard_pvp`, the same set code as the resistance printing; the side exists only in the code range.",
      evidence: PVP_EVIDENCE,
    },
    {
      codes: ["56203", "56204", "56205", "56206a"],
      setCode: "standard_pvp_resistance",
      setName: "Standard PvP (Resistance)",
      reason:
        "MarvelCDB files the resistance printing under `standard_pvp`, the same set code as the registration printing; the side exists only in the code range.",
      evidence: PVP_EVIDENCE,
    },
  ],

  encounterSets: {
    // Sides: the leaders' sets, the main scheme sets and the modular sets, by the code ranges of survey sections 3.2 to
    // 3.4 and the rulebook's per-side layout (MC56 pp. 4, 7 and 8; ruling Jan 11, 2026 R1).
    iron_man_leader: sided(REGISTRATION),
    captain_marvel_leader: sided(REGISTRATION),
    registration: sided(REGISTRATION),
    mighty_avengers: sided(REGISTRATION),
    the_initiative: sided(REGISTRATION),
    // The cards print the set title "Maria Hill" (scan 56083.png; MC56 p. 7). The Agents of S.H.I.E.L.D. hero card set
    // shares the title, but that is a card set, not an encounter set (its encounter set is "Maria Hill Nemesis"), and
    // every lookup of an encounter set is by id, so the printed name is kept.
    maria_hill_modular: sided(REGISTRATION),
    dangerous_recruits: sided(REGISTRATION),
    cape_killer: sided(REGISTRATION),
    martial_law: sided(REGISTRATION),
    heroes_for_hire: sided(REGISTRATION),
    paladin: sided(REGISTRATION),
    standard_pvp_registration: sided(REGISTRATION, { competitiveOnly: true }),
    captain_america_leader: sided(RESISTANCE),
    spider_woman_leader: sided(RESISTANCE, { name: "Spider-Woman" }),
    resistance: sided(RESISTANCE),
    new_avengers: sided(RESISTANCE),
    secret_avengers: sided(RESISTANCE),
    namor_modular: sided(RESISTANCE),
    atlanteans: sided(RESISTANCE),
    spider_man_modular: sided(RESISTANCE),
    defenders: sided(RESISTANCE),
    hells_kitchen: sided(RESISTANCE),
    cloak_and_dagger_modular: sided(RESISTANCE),
    standard_pvp_resistance: sided(RESISTANCE, { competitiveOnly: true }),
  },

  errata: [
    {
      code: "56019",
      version: "RRG 1.8",
      changedFields: ["name", "text"],
      note: 'Yellow Jacket (basic ally): the title and the Response text read "Yellowjacket". The print is "Yellow Jacket".',
      evidence:
        'RRG 1.8 Appendix V, "Civil War Expansion" (p. 70, mc_rulesreference_v18_compressed.md line 5168): "YELLOW JACKET (#19) Title should read \\"Yellowjacket\\". Text should read: Response: After Yellowjacket enters play, search the top 5 cards of your deck for an upgrade and add it to your hand. (Changed \\"Yellow Jacket\\" to \\"Yellowjacket\\".)"',
      currentReplace: { find: "After Yellow Jacket enters play", replace: "After Yellowjacket enters play" },
    },
    {
      code: "56073",
      version: "RRG 1.8",
      changedFields: ["name"],
      note: 'Yellow Jacket (Mighty Avengers minion): the title reads "Yellowjacket". The print is "Yellow Jacket"; the text names no one.',
      evidence:
        'RRG 1.8 Appendix V, "Civil War Expansion" (p. 70, mc_rulesreference_v18_compressed.md line 5174): "YELLOW JACKET (#73) Title should read \\"Yellowjacket\\"."',
    },
    {
      code: "56098",
      version: "RRG 1.8",
      changedFields: ["text"],
      note: 'Energy Channel: the cost arrow after "remove all of them" is gone; Captain Marvel attacks as part of the effect ("and"). The print has "remove all of them → Captain Marvel attacks that character".',
      evidence:
        'RRG 1.8 Appendix V, "Civil War Expansion" (p. 70, mc_rulesreference_v18_compressed.md line 5178): "ENERGY CHANNEL (#98) Should read: Forced Response: After a leader, hero, or ally attacks Captain Marvel, place 1 energy counter here. Then, if there are at least 4 energy counters here, remove all of them and Captain Marvel attacks that character. This attack gains overkill. (Changed \\u2192 to \\"and\\".)" Rulings Jan 26, 2026 (5) and Jun 2, 2026 (4).',
      currentReplace: {
        find: "remove all of them → Captain Marvel attacks",
        replace: "remove all of them and Captain Marvel attacks",
      },
    },
  ],

  scriptingNotes: {},
  cardNotes: {
    "56135":
      'Alpha Flight Recruit prints its title misspelled "Alpha Flgiht Recruit" (scan 56135.png; docs/phase7-wave10-scan-check-cw-registration.md item 7). A printing error, not an erratum (no RRG p. 70 entry): the data keeps the correct name "Alpha Flight Recruit"; the owner decides whether the displayed title follows the print.',
    "56209":
      'The raw markup is malformed ("Action<b/>:"); the normalizer reads it as the Action label ("56209.recruited-by-cap-action"), matching the print "Action: Choose a minion engaged with you ..." (docs/phase7-wave10-scan-check-cw-resistance.md item 5).',
    "56100":
      "Captain Marvel's set (14 printed slots: 56092 to 56095 leader stages plus 10 cards) is consistent with the raw quantities. Printed positions 5, 6, 7, 8, 10, 12, 14 on 56098, 56099, 56100, 56101, 56102, 56103, 56104 and the missing 9, 11, 13 are the second copies of 56101, 56102 and 56100 (raw quantities 2, 2, 2 and 1 on 56103 sum to 10 cards, 14 with the four leader stages). Raw set_position 9, 11, 13 for 56101 to 56103 is MarvelCDB's numbering of the copies; set_position is not emitted. Checked against docs/phase7-wave10-scan-check-cw-registration.md correction 6.",
    "56106":
      "Unregistered Super prints an acceleration icon on the obligation (scan 56106.png, read 2026-10-11: the icon sits beside the encounter-set footer); it counts while the card is in play (spec section 1.7). 56114 is the same card in Heroes for Hire.",
  },

  // MC56: 56128b (Now It's Personal, back of the registration copy) and 56206a (Choosing Sides, front of the
  // resistance copy) have no scan of their own yet. assets/card-art/bundles/cards/56206a.png is a copy of 56128a and
  // 56128b.png is a copy of 56206b, stand-ins taken from the other side's copy of the same card (2026-10-13): the
  // printed text is identical, but the collector number in the corner differs (128A vs 206A, 206B vs 128B) and the
  // art on the registration copy of Now It's Personal may differ (the resistance copy shows Captain America). Replace
  // the two files when real scans arrive. No `artUnavailable` entry is needed: the ingest finds the files.
  artUnavailable: {},

  scenarios: [
    fiveCardScenario({
      id: "registration-iron-man",
      name: "Registration: Iron Man",
      side: REGISTRATION,
      villainSetCode: "iron_man_leader",
      mainSchemeSetCode: "registration",
      recommendedModularSetCodes: ["mighty_avengers", "the_initiative", "maria_hill_modular", "dangerous_recruits"],
      stages: ["56063b", "56064b"],
      evidence:
        'MC56 p. 7: "Leader Deck: Iron Man (I), Iron Man (II) ... (III), (IV) for expert mode. Main Scheme Deck: Cut Off Support (1B), Negative Zone Prison (2B). Encounter Deck: Iron Man, Mighty Avengers, The Initiative, Maria Hill, Dangerous Recruits, and Standard encounter sets." Each set can be removed and added to other scenarios of the same side (MC56 p. 4). Survey section 4.',
    }),
    fiveCardScenario({
      id: "registration-captain-marvel",
      name: "Registration: Captain Marvel",
      side: REGISTRATION,
      villainSetCode: "captain_marvel_leader",
      mainSchemeSetCode: "registration",
      recommendedModularSetCodes: ["cape_killer", "martial_law", "heroes_for_hire", "paladin"],
      stages: ["56096b", "56097b"],
      evidence:
        'MC56 p. 7: "Leader Deck: Captain Marvel (I), Captain Marvel (II) ... (III), (IV) for expert mode. Main Scheme Deck: S.H.I.E.L.D. Recruits (1B), Hunting Rebel Heroes (2B). Encounter Deck: Captain Marvel, Cape-Killer, Martial Law, Heroes for Hire, Paladin, and Standard encounter sets." (The page spells the set "Cape-Killer" and, in its footnote, "Cape-Killers"; the set is `cape_killer`, "Cape-Killer".) Survey section 4.',
    }),
    fiveCardScenario({
      id: "resistance-captain-america",
      name: "Resistance: Captain America",
      side: RESISTANCE,
      villainSetCode: "captain_america_leader",
      mainSchemeSetCode: "resistance",
      recommendedModularSetCodes: ["new_avengers", "secret_avengers", "namor_modular", "atlanteans"],
      stages: ["56141b", "56142b"],
      evidence:
        'MC56 p. 8: "Leader Deck: Captain America (I), Captain America (II) ... (III), (IV) for expert mode. Main Scheme Deck: Gathering Support (1B), Secret Avengers (2B). Encounter Deck: Captain America, New Avengers, Secret Avengers, Namor, Atlanteans, and Standard encounter sets." (The main scheme 56142b and the modular set `secret_avengers` share a title.) Survey section 4.',
    }),
    fiveCardScenario({
      id: "resistance-spider-woman",
      name: "Resistance: Spider-Woman",
      side: RESISTANCE,
      villainSetCode: "spider_woman_leader",
      mainSchemeSetCode: "resistance",
      recommendedModularSetCodes: ["spider_man_modular", "defenders", "hells_kitchen", "cloak_and_dagger_modular"],
      stages: ["56172b", "56173b"],
      evidence:
        'MC56 p. 8: "Leader Deck: Spider-Woman (I), Spider-Woman (II) ... (III), (IV) for expert mode. Main Scheme Deck: Open Rebellion (1B), Neighborhood Protectors (2B). Encounter Deck: Spider-Woman, Spider-Man, Defenders, Hell\'s Kitchen, Cloak & Dagger, and Standard encounter sets." Survey section 4.',
    }),
  ],

  starterDecks: [
    {
      id: "tigra-aggression",
      name: "Tigra / Aggression",
      identityCode: "56001a",
      aspect: "aggression",
      cards: {
        // Tigra's 15 hero cards
        "56002": 1, // Moon Knight
        "56003": 1, // Precinct HQ
        "56004": 1, // Cat's Head Amulet
        "56005": 2, // Sharp Claws
        "56006": 2, // Cat-Like Reflexes
        "56007": 3, // Hunted
        "56008": 3, // Tooth and Claw
        "56009": 2, // Feline Senses
        // 21 Aggression
        "56010": 1, // Two-Gun Kid
        "56011": 1, // Spider-Girl
        "56012": 3, // Air Cover
        "56013": 3, // Aggressive Conditioning
        "56014": 3, // Suppressing Fire
        "56015": 3, // "Bring It!"
        "56016": 3, // Coup de Grace
        "56017": 3, // Savage Strike
        "56018": 1, // Audacity
        // 4 basic
        "56019": 1, // Yellow Jacket (current title Yellowjacket)
        "56020": 1, // Energy
        "56021": 1, // Genius
        "56022": 1, // Strength
      },
      obligationCode: "56023",
      nemesisCodes: ["56024", "56025", "56026", "56027", "56028"],
      verified: true,
      sources: [
        "MC56 rulebook p. 18 (docs/campaign-modes/mc56_rulebook-web_1.pdf), rendered and read against the list on 2026-10-11 (survey section 10.2: names and counts match the markdown, the Tigra and Hulkling columns told apart on the page image)",
      ],
      note: "40 cards: 15 Tigra, 21 Aggression, 4 basic. The page lists titles and quantities, not codes; each title was matched to raw/marvelcdb/cw.json (every copy count is within the record's quantity).",
    },
    {
      id: "hulkling-protection",
      name: "Hulkling / Protection",
      identityCode: "56029a",
      aspect: "protection",
      cards: {
        // Hulkling's 15 hero cards
        "56030": 1, // Wiccan
        "56031": 1, // Altman Residence
        "56032": 1, // Winged Shape
        "56033": 1, // Hulk Shape
        "56034": 1, // Armored Shape
        "56035": 1, // Imitation Shape
        "56036": 1, // Alien Physiology
        "56037": 3, // Shapeshifter Strike
        "56038": 2, // Armored Defense
        "56039": 2, // Impersonation
        "56040": 1, // Shapeshifter
        // 21 Protection
        "56041": 1, // Patriot
        "56042": 1, // Brother Voodoo
        "56043": 1, // Hidden Base
        "56044": 1, // The Night Nurse
        "56045": 1, // Excelsior
        "56046": 3, // Defensive Conditioning
        "56047": 3, // "I Can Do This All Day"
        "56048": 3, // Taunt
        "56049": 3, // Tackle
        "56050": 3, // Cuts Both Ways
        "56051": 1, // Preservation
        // 4 basic
        "56052": 1, // Iron Lad
        "56053": 3, // Assess the Situation
      },
      obligationCode: "56054",
      nemesisCodes: ["56055", "56056", "56057", "56058"],
      verified: true,
      sources: [
        "MC56 rulebook p. 18 (docs/campaign-modes/mc56_rulebook-web_1.pdf), rendered and read against the list on 2026-10-11 (survey section 10.2)",
      ],
      note: "40 cards: 15 Hulkling, 21 Protection, 4 basic. The page lists titles and quantities, not codes; each title was matched to raw/marvelcdb/cw.json.",
    },
  ] satisfies readonly StarterDeckCuration[],
};
