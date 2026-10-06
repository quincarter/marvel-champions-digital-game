import { describe, expect, it } from "vitest";
import { parseTraits } from "./text.ts";

/** Every distinct raw `traits` / `real_traits` line with an internal period across raw/marvelcdb/*.json. */
const DOTTED: Array<[string, string[]]> = [
  ["A.I.M.", ["A.I.M."]],
  ["A.I.M. Genius.", ["A.I.M.", "GENIUS"]],
  ["Avenger. S.H.I.E.L.D.", ["AVENGER", "S.H.I.E.L.D."]],
  ["Cyborg. S.H.I.E.L.D.", ["CYBORG", "S.H.I.E.L.D."]],
  ["Elite. S.H.I.E.L.D.", ["ELITE", "S.H.I.E.L.D."]],
  ["Location. S.H.I.E.L.D.", ["LOCATION", "S.H.I.E.L.D."]],
  ["Persona. S.H.I.E.L.D.", ["PERSONA", "S.H.I.E.L.D."]],
  ["S.H.I.E.L.D.", ["S.H.I.E.L.D."]],
  ["S.H.I.E.L.D. Soldier.", ["S.H.I.E.L.D.", "SOLDIER"]],
  ["S.H.I.E.L.D. Soldier. Spy.", ["S.H.I.E.L.D.", "SOLDIER", "SPY"]],
  ["S.H.I.E.L.D. Spy.", ["S.H.I.E.L.D.", "SPY"]],
  ["S.H.I.E.L.D. Tactic.", ["S.H.I.E.L.D.", "TACTIC"]],
  ["S.H.I.E.L.D. Tech.", ["S.H.I.E.L.D.", "TECH"]],
  ["S.H.I.E.L.D. Vehicle.", ["S.H.I.E.L.D.", "VEHICLE"]],
  ["S.H.I.E.L.D. Web-Warrior.", ["S.H.I.E.L.D.", "WEB-WARRIOR"]],
];

describe("parseTraits", () => {
  it.each(DOTTED)("splits %s", (raw, expected) => {
    expect(parseTraits(raw)).toEqual(expected);
  });

  it("handles plain lines, missing final periods and empties", () => {
    expect(parseTraits("Avenger. Soldier.")).toEqual(["AVENGER", "SOLDIER"]);
    expect(parseTraits("Avenger. Soldier")).toEqual(["AVENGER", "SOLDIER"]);
    expect(parseTraits("S.W.O.R.D. Agent.")).toEqual(["S.W.O.R.D.", "AGENT"]);
    expect(parseTraits("S.H.I.E.L.D. Soldier")).toEqual(["S.H.I.E.L.D.", "SOLDIER"]);
    expect(parseTraits("")).toEqual([]);
    expect(parseTraits(null)).toEqual([]);
  });
});
