// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/aos (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/aos.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/aos.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack aos [--offline]

import { cardId, encounterSetId, setCode } from "../../schema/index.js";
import type { EncounterSet } from "../../schema/index.js";

export const AOS_ENCOUNTER_SETS: readonly EncounterSet[] = [
  { id: encounterSetId("a.i.m._abduction"), name: "A.I.M. Abduction", packCodes: [setCode("aos")] },
  { id: encounterSetId("a.i.m._science"), name: "A.I.M. Science", packCodes: [setCode("aos")] },
  { id: encounterSetId("baron_zemo"), name: "Baron Zemo", packCodes: [setCode("aos")] },
  { id: encounterSetId("batroc"), name: "Batroc", packCodes: [setCode("aos")] },
  { id: encounterSetId("batrocs_brigade"), name: "Batroc's Brigade", packCodes: [setCode("aos")] },
  { id: encounterSetId("black_widow_villain"), name: "Black Widow", packCodes: [setCode("aos")] },
  {
    id: encounterSetId("executive_board_evidence"),
    name: "Executive Board Evidence",
    packCodes: [setCode("aos")],
  },
  {
    id: encounterSetId("gravitational_pull"),
    name: "Gravitational Pull",
    packCodes: [setCode("aos")],
  },
  { id: encounterSetId("hard_sound"), name: "Hard Sound", packCodes: [setCode("aos")] },
  { id: encounterSetId("m.o.d.o.k."), name: "M.O.D.O.K.", packCodes: [setCode("aos")] },
  {
    id: encounterSetId("maria_hill_nemesis"),
    name: "Maria Hill Nemesis",
    packCodes: [setCode("aos")],
    nemesisOfIdentityId: cardId("50001a"),
  },
  {
    id: encounterSetId("nick_fury_nemesis"),
    name: "Nick Fury Nemesis",
    packCodes: [setCode("aos")],
    nemesisOfIdentityId: cardId("50034a"),
  },
  {
    id: encounterSetId("pale_little_spider"),
    name: "Pale Little Spider",
    packCodes: [setCode("aos")],
  },
  { id: encounterSetId("power_of_the_atom"), name: "Power of the Atom", packCodes: [setCode("aos")] },
  { id: encounterSetId("s.h.i.e.l.d."), name: "S.H.I.E.L.D.", packCodes: [setCode("aos")] },
  {
    id: encounterSetId("s.h.i.e.l.d._executive_board"),
    name: "S.H.I.E.L.D. Executive Board",
    packCodes: [setCode("aos")],
  },
  { id: encounterSetId("scientist_supreme"), name: "Scientist Supreme", packCodes: [setCode("aos")] },
  { id: encounterSetId("supersonic"), name: "Supersonic", packCodes: [setCode("aos")] },
  { id: encounterSetId("the_leaper"), name: "The Leaper", packCodes: [setCode("aos")] },
  { id: encounterSetId("thunderbolts"), name: "Thunderbolts", packCodes: [setCode("aos")] },
];
