/**
 * Age of Apocalypse (MC45, cycle 8 campaign box) curation, pass 1: cards only. Bishop and Magik's hero kits, the five
 * scenarios' encounter cards, the modular sets and the campaign cards 164-183. The scenarios, starter decks and the
 * hand-authored `campaign.ts` are later steps (docs/phase7-wave8-data-survey.md §8 steps 5 to 7), so this curation
 * lists none yet and must not be emitted: `ingest --pack aoa` stays a `--dry-run` until then.
 *
 * Evidence abbreviations: "scan" is `assets/card-art/bundles/cards/<code>.png` (gitignored, read directly, small
 * scans enlarged; never wired into the data), "RRG" is the v1.8 rules reference, "survey" is
 * docs/phase7-wave8-data-survey.md, "spec" is docs/phase7-wave8.md.
 *
 * Left open on purpose (they wait on the campaign spec pass, not on a hack here): the mission side scheme b faces
 * 45166b to 45170b ("Finished.", survey gap 4), the `Mission Response` ability kind of 45180a to 45183a (gap 5),
 * Sidekick 45015's host (gap 2), and the missing back face 45104b with 45104a's wrong link (gap 8: no curation
 * mechanism adds a record, see the handoff note).
 */
import type { PackCuration } from "./types.ts";

export const AOA_CURATION: PackCuration = {
  packCode: "aoa",
  cycle: { id: "cycle8", name: "Age of Apocalypse", order: 8 },
  pack: {
    name: "Age of Apocalypse",
    releaseDate: "2024-03-29",
    // UNVERIFIED: the sources doc's release table is the only source so far (no FFG product page or Hall of Heroes
    // release page has been read for this date). Check it against https://hallofheroeslcg.com/the-age-of-apocalypse/
    // before the pack is emitted.
    releaseDateSource:
      "UNVERIFIED: docs/phase7-wave8-sources.md release table (March 29, 2024, Age of Apocalypse MC45); not cross-checked against an FFG or Hall of Heroes page",
  },
  outDir: "src/data/aoa",
  exportPrefix: "AOA",
  // MarvelCDB has no campaign record (docs/campaign-mode-design.md §3): `campaign.ts` (`AOA_CAMPAIGN`) is
  // hand-authored, survey §8 step 7. Ingest refuses a named module whose file is missing, so a real (non dry-run)
  // ingest cannot run before that file exists.
  handAuthoredModules: ["campaign"],

  corrections: [
    {
      code: "45129",
      reason:
        "MarvelCDB sends no `scheme` for Velociraptor, so the normalizer cannot tell a printed 1 from a dash or zero. The card prints SCH 1.",
      evidence:
        "Scan 45129.png: SCH 1, ATK 1 with a reminder star, boost 3, Savage Land (3/8). Survey §4.6 (scan checked) and spec §1.22. Scans 45128.png (Pterosaur, SCH 0) and 45115.png (Tusk, SCH 0) were read too; raw already carries scheme 0 for both, so neither needs a correction.",
      scheme: 1,
    },
    {
      code: "45105b",
      reason:
        'MarvelCDB reads "heal 5[per_hero] hit points from him"; the card prints "heal 5[per_hero] damage from him".',
      evidence:
        'Scan 45105b.png (419 wide, small): "Attach to Apocalypse and heal 5 (per-hero icon) damage from him. He cannot take damage while a PRELATE minion is in play." Spec §1.14 and §1.22.',
      textReplace: { find: "hit points from him", replace: "damage from him" },
    },
    {
      code: "45140",
      reason: 'MarvelCDB reads "deal Gladiator by yourself" in the Boost; the card prints "to yourself".',
      evidence:
        'Scan 45140.png: "Boost: If Trial by Combat is in play, deal Gladiator to yourself as a facedown encounter card." Spec §1.22.',
      textReplace: { find: "deal Gladiator by yourself", replace: "deal Gladiator to yourself" },
    },
    {
      code: "45125",
      reason: 'MarvelCDB reads "an additional boost card for this attacks"; the card prints "for this attack".',
      evidence:
        'Scan 45125.png: "When Revealed (Hero): Dark Beast attacks you. Give him an additional boost card for this attack." Spec §1.22.',
      textReplace: { find: "boost card for this attacks.", replace: "boost card for this attack." },
    },
    {
      code: "45124",
      reason:
        'Cruel Experiment prints no "Attach to" sentence: it attaches itself from its own When Revealed. Without the field the normalizer reports an attachment with no attach rule and builds no card. Never applied to text.',
      evidence:
        'Scan 45124.png: text box is "Attached minion gets +2 hit points and gains guard." and "When Revealed: Discard cards from the top of the encounter deck until you discard a minion. Reveal that minion and attach Cruel Experiment to it."; stat boxes +1 SCH and +1 ATK; Condition trait. FFG ruling February 20, 2026 - Ruling 4 (an attachment without "attach to" text attaches when its When Revealed triggers; corrects RRG 1.8 "Reveal", p. 38). Spec §3.25.',
      impliedAttachHost: "ownWhenRevealed",
    },
    {
      code: "45171a",
      reason:
        "Mission Team, a campaign support that is put into play by the campaign instructions, prints no cost box; MarvelCDB sends no cost.",
      evidence:
        'Scan 45171a.png: support, Mission trait, no cost oval; footer "BASIC / CAMPAIGN 171A". Survey §4.6 (scan checked).',
      specialCost: "dash",
    },
  ],

  errata: [
    {
      code: "45017",
      version: "RRG 1.8",
      changedFields: ["text"],
      note: 'Suit Up: "an upgrade that can be attached to that ally" is now "an upgrade that can be attached to an ally". MarvelCDB still carries the print. The printed "(Shuffle.)" reminder stays in the current text: the erratum lists exactly one change.',
      evidence:
        'RRG 1.8 p. 69 (Age of Apocalypse errata, SUIT UP (#17)): "Should read: Alter-Ego Action: Search your deck and discard pile for an ally and an upgrade that can be attached to an ally. Add them to your hand. (Changed “can be attached to that ally” to “can be attached to an ally”.)" The RRG line omits the italic "(Shuffle.)"; scan 45017.png prints "Alter-Ego Action: Search your deck and discard pile for an ally and an upgrade that can be attached to that ally. Add them to your hand. (Shuffle.)" with the reminder in italics.',
      currentReplace: { find: "can be attached to that ally", replace: "can be attached to an ally" },
    },
    {
      code: "45171a",
      version: "RRG 1.8",
      changedFields: ["text"],
      note: 'Mission Team, first bullet: "this phase" was added by the erratum ("Reduce the cost of the next ally played to the mission this phase by 2."). MarvelCDB carries the current wording (its own errata field says "Added this phase. (RRG 1.6)"), so the printed text is reconstructed by dropping it.',
      evidence:
        'RRG 1.8 p. 69 (MISSION TEAM (#171A)): "The first bullet should read: Reduce the cost of the next ally played to the mission this phase by 2. (Added this phase.)" Scan 45171a.png prints "Reduce the cost of the next ally played to the mission by 2." (no "this phase").',
      printedReplace: { find: "to the mission this phase by 2", replace: "to the mission by 2" },
    },
  ],

  // Scripting hand-off notes are survey §8 step 11; none yet.
  scriptingNotes: {},

  cardNotes: {
    "45171a":
      "Mission Team prints no cost box (scan 45171a.png): a dash cost, 'specialCost: dash'. It is put into play by the campaign instructions, never played from a hand.",
    "45179a":
      "Mister Sinister's Overseer face prints a dash for both SCH and ATK (scan 45179a.png: both stat badges empty, HP 5 per hero, Victory 5): it never schedules or attacks. The stat fields carry 0 and mean 'no value', as for Robert Kelly (32066).",
    "45180a":
      "The Shadow King's Overseer face prints a dash for both SCH and ATK (scan 45180a.png, HP 5 per hero, Victory 5, Mission Response). The stat fields carry 0 and mean 'no value'.",
    "45181a":
      "Abyss's Overseer face prints a dash for both SCH and ATK (scan 45181a.png, HP 5 per hero, Victory 5, Mission Response). The stat fields carry 0 and mean 'no value'.",
    "45182a":
      "Sugar Man's Overseer face prints a dash for both SCH and ATK (scan 45182a.png, HP 5 per hero, Victory 5, Mission Response; the rulebook p. 5 callout shows 'ATK -' and 'SCH -' for this card). The stat fields carry 0 and mean 'no value'.",
    "45183a":
      "Mikhail Rasputin's Overseer face prints a dash for both SCH and ATK (scan 45183a.png, HP 5 per hero, Victory 5, Mission Response). The stat fields carry 0 and mean 'no value'.",
  },

  // Later steps (survey §8 steps 5 and 6): the five scenarios and the Bishop and Magik starter decks.
  scenarios: [],
  starterDecks: [],

  // Survey gap 11: campaign-specific sets whose cards carry the `encounter` faction, so they are not detected from
  // the faction the way `aoa_basic_campaign` (faction `campaign`) is. Rulebook MC45 pp. 3 to 5 and 14 (the survey's
  // §4.5): the mission, Overseer and campaign cards are used only in campaign mode.
  encounterSets: {
    aoa_mission: { campaignSpecific: true },
    aoa_campaign: { campaignSpecific: true },
    age_of_apocalypse: { campaignSpecific: true },
    overseer: { campaignSpecific: true },
  },
};
