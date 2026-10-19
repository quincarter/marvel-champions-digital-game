import { CW_CARDS, SYNTHEZOID_CARDS } from "@mc/content";
import { describe, expect, it } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import { COMPETITIVE_STANDARD_PVP } from "../../cw/competitive/standard-pvp.js";
import { SYNTHEZOID_COMPETITIVE_STANDARD_PVP, SYNTHEZOID_COMPETITIVE_STANDARD_PVP_SKIPPED } from "./standard-pvp.js";
import { SYNTHEZOID_COMPETITIVE_LEADER_CARDS_SKIPPED } from "./leader-cards.js";

/** Reprint code to the Civil War code it repeats (docs/phase7-synthezoid.md section 1.6). */
const REPRINTS: Readonly<Record<string, string>> = {
  "57036": "56125",
  "57037": "56126",
  "57038": "56127",
  "57039a": "56128a",
  "57039b": "56128b",
  "57078": "56203",
  "57079": "56204",
  "57080": "56205",
  "57081a": "56206a",
  "57081b": "56206b",
};

/** Every ref, named literally so the wave 10 coverage guard sees each one. */
const REFS = [
  "57036.when-revealed",
  "57037.when-revealed-alter-ego",
  "57037.when-revealed-hero",
  "57038.when-revealed",
  "57038.boost",
  "57039a.choosing-sides-constant",
  "57039a.choosing-sides-forced-response",
  "57039b.now-its-personal-constant",
  "57039b.now-its-personal-action",
  "57078.when-revealed",
  "57079.when-revealed-alter-ego",
  "57079.when-revealed-hero",
  "57080.when-revealed",
  "57080.boost",
  "57081a.choosing-sides-constant",
  "57081a.choosing-sides-forced-response",
  "57081b.now-its-personal-constant",
  "57081b.now-its-personal-action",
];

describe("Synthezoid Smackdown Standard PvP (reprints of Civil War's)", () => {
  it("scripts every ref the cards declare, as the Civil War card's script, and skips none", () => {
    expect(Object.keys(SYNTHEZOID_COMPETITIVE_STANDARD_PVP).sort()).toEqual([...REFS].sort());
    expect(SYNTHEZOID_COMPETITIVE_STANDARD_PVP_SKIPPED).toEqual({});
    for (const ref of REFS) {
      const [code, rest] = [ref.slice(0, ref.indexOf(".")), ref.slice(ref.indexOf(".") + 1)];
      const definition = SYNTHEZOID_COMPETITIVE_STANDARD_PVP[ref]!;
      expect(definition, ref).toBe(COMPETITIVE_STANDARD_PVP[`${REPRINTS[code]}.${rest}`]);
      expect(validateDefinition(definition), ref).toEqual([]);
    }
  });

  it("has printed text equal to the Civil War card it reuses (57038 words its boost as the card gains)", () => {
    type Printed = { text: { current: string }; abilities: readonly unknown[] };
    const same = (text: string): string => text.replace("The card gains", "This card gains");
    for (const [code, original] of Object.entries(REPRINTS)) {
      const reprint = SYNTHEZOID_CARDS.find((card) => card.id === code) as unknown as Printed;
      const cw = CW_CARDS.find((card) => card.id === original) as unknown as Printed;
      expect(same(reprint.text.current), code).toBe(same(cw.text.current));
      expect(reprint.abilities.length, code).toBe(cw.abilities.length);
    }
  });

  it("leaves the eight leader cards skipped for competitive mode", () => {
    expect(Object.keys(SYNTHEZOID_COMPETITIVE_LEADER_CARDS_SKIPPED)).toHaveLength(8);
    for (const reason of Object.values(SYNTHEZOID_COMPETITIVE_LEADER_CARDS_SKIPPED))
      expect(reason).toBe("competitive mode not shipped");
  });
});
