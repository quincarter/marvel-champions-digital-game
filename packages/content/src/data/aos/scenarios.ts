// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/aos (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/aos.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/aos.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack aos [--offline]

import { cardId, encounterSetId, scenarioId, setCode } from "../../schema/index.js";
import type { Scenario } from "../../schema/index.js";

/** black-widow: MC50 p. 9 and 50067a Contents: "Villain Deck: Black Widow (I), Black Widow (II). Remove Black Widow (I) and add Black Widow (III) for expert mode. Main Scheme Deck: The Widow's Web. Encounter Deck: Black Widow, A.I.M. Abduction, A.I.M. Science, and Standard encounter sets." A.I.M. Abduction and A.I.M. Science can be removed from this scenario and added to others (scenario customization).; batroc: MC50 p. 11 and 50087a Contents: "Villain Deck: Batroc (A). Flip Batroc (A) to Batroc (B) for expert mode. Main Scheme Deck: Infiltrate A.I.M. Island Embassy, Locate Missing Person, Extract Captives. Encounter Deck: Batroc, A.I.M. Science, Batroc's Brigade, and Standard." "The players' objective in this scenario is not to defeat the villain, Batroc, but instead to advance through the three stages of the main scheme" (p. 11, Infiltrating the Embassy). A.I.M. Science and Batroc's Brigade can be removed. Rescued Captive allies are set aside by 50087a Setup (scripting).; modok: MC50 p. 13 and 50104a Contents: "Villain Deck: M.O.D.O.K. (A). Flip M.O.D.O.K. (A) to M.O.D.O.K. (B) for expert mode. Main Scheme Deck: Upgrading Adaptoids. Encounter Deck: M.O.D.O.K., Scientist Supreme, and Standard." Scientist Supreme can be removed. The Holding Cell deck and the Adaptoid environments are built by 50104a Setup (scripting). 50103a: M.O.D.O.K. is defeated only when no Holding Cell is in play.; thunderbolts: MC50 p. 15 and 50130a Contents/Setup: "Villain Deck: Citizen V (A). Flip Citizen V (A) to Citizen V (B) for expert mode. Main Scheme Deck: Apprehending Rogue Agents. Encounter Deck: Thunderbolts and Standard. You will also need 1[per_hero] modular encounter sets, plus one additional set, each containing an Elite, Thunderbolt minion: Gravitational Pull, Hard Sound, Pale Little Spider, Power of the Atom, Supersonic, and The Leaper."; baron-zemo: MC50 p. 18 and 50167a Contents: "Villain Deck: Baron Zemo (A1). Remove Baron Zemo (A1) and add Baron Zemo (B1) for expert mode. Main Scheme Deck: Zemo's Manipulations, The Accusation, Fighting Zemo. Encounter Deck: Baron Zemo, S.H.I.E.L.D. Executive Board, Executive Board Evidence, Scientist Supreme, S.H.I.E.L.D., and Standard." Scientist Supreme and S.H.I.E.L.D. can be removed. Setup prepares the evidence and puts each Board Member environment into play (scripting). */
export const AOS_SCENARIOS: readonly Scenario[] = [
  {
    id: scenarioId("black-widow"),
    name: "Black Widow",
    packCode: setCode("aos"),
    villainCardId: cardId("50064"),
    mainSchemeCardId: cardId("50067a"),
    encounterSetIds: [encounterSetId("black_widow_villain")],
    recommendedModularSetIds: [encounterSetId("a.i.m._abduction"), encounterSetId("a.i.m._science")],
    standardEncounterSetIds: [encounterSetId("standard")],
    expertEncounterSetIds: [encounterSetId("expert")],
    villainStages: { standard: [1, 2], expert: [2, 3] },
    modularSetCount: 2,
  },
  {
    id: scenarioId("batroc"),
    name: "Batroc",
    packCode: setCode("aos"),
    villainCardId: cardId("50086a"),
    mainSchemeCardId: cardId("50087a"),
    encounterSetIds: [encounterSetId("batroc")],
    recommendedModularSetIds: [encounterSetId("a.i.m._science"), encounterSetId("batrocs_brigade")],
    standardEncounterSetIds: [encounterSetId("standard")],
    expertEncounterSetIds: [encounterSetId("expert")],
    villainStages: { standard: [1, 1], expert: [2, 2] },
    modularSetCount: 2,
    victory: "cardAbility",
  },
  {
    id: scenarioId("modok"),
    name: "M.O.D.O.K.",
    packCode: setCode("aos"),
    villainCardId: cardId("50103a"),
    mainSchemeCardId: cardId("50104a"),
    encounterSetIds: [encounterSetId("m.o.d.o.k.")],
    recommendedModularSetIds: [encounterSetId("scientist_supreme")],
    standardEncounterSetIds: [encounterSetId("standard")],
    expertEncounterSetIds: [encounterSetId("expert")],
    villainStages: { standard: [1, 1], expert: [2, 2] },
    modularSetCount: 1,
  },
  {
    id: scenarioId("thunderbolts"),
    name: "Thunderbolts",
    packCode: setCode("aos"),
    villainCardId: cardId("50129a"),
    mainSchemeCardId: cardId("50130a"),
    encounterSetIds: [encounterSetId("thunderbolts")],
    recommendedModularSetIds: [],
    standardEncounterSetIds: [encounterSetId("standard")],
    expertEncounterSetIds: [encounterSetId("expert")],
    villainStages: { standard: [1, 1], expert: [2, 2] },
    modularSetCount: 0,
    setAsideModularSetCount: { base: 1, perPlayer: 1 },
    modularSetPool: {
      setIds: [
        encounterSetId("gravitational_pull"),
        encounterSetId("hard_sound"),
        encounterSetId("pale_little_spider"),
        encounterSetId("power_of_the_atom"),
        encounterSetId("supersonic"),
        encounterSetId("the_leaper"),
      ],
      restricted: true,
    },
  },
  {
    id: scenarioId("baron-zemo"),
    name: "Baron Zemo",
    packCode: setCode("aos"),
    villainCardId: cardId("50165a"),
    mainSchemeCardId: cardId("50167a"),
    encounterSetIds: [
      encounterSetId("baron_zemo"),
      encounterSetId("s.h.i.e.l.d._executive_board"),
      encounterSetId("executive_board_evidence"),
    ],
    recommendedModularSetIds: [encounterSetId("scientist_supreme"), encounterSetId("s.h.i.e.l.d.")],
    standardEncounterSetIds: [encounterSetId("standard")],
    expertEncounterSetIds: [encounterSetId("expert")],
    villainStages: { standard: [1, 1], expert: [1, 1] },
    modularSetCount: 2,
    expertVillains: { villainCardId: cardId("50166a"), setAsideVillainCardIds: [] },
  },
];
