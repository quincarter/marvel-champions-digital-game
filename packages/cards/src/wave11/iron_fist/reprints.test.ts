/**
 * Iron Fist's reprints: a verbatim reprint of an earlier card shares that card's script under its own ability id
 * (docs/phase7-elektra-iron-fist.md). Power Man and Iron Fist 64024 reprints luke_cage 62023, Defiance 64015 reprints
 * vision 26018 and The Night Nurse 64017 reprints drs 09019 (cw 56044 is a second reprint of it).
 */
import { DRS_CARDS, IRON_FIST_CARDS, LUKE_CAGE_CARDS, VISION_CARDS } from "@mc/content";
import { WAVE10_ABILITIES } from "../../wave10/index.js";
import { LUKE_CAGE_OTHER_ASPECTS_BASIC } from "../luke_cage/other-aspects-basic.js";
import { IRON_FIST_BASIC } from "./basic.js";
import { IRON_FIST_PROTECTION } from "./protection.js";

describe("iron_fist reprints", () => {
  it("Power Man and Iron Fist 64024 is the same definition object as luke_cage 62023's", () => {
    expect(IRON_FIST_BASIC["64024.power-man-and-iron-fist-action"]).toBeDefined();
    expect(IRON_FIST_BASIC["64024.power-man-and-iron-fist-action"]).toBe(
      LUKE_CAGE_OTHER_ASPECTS_BASIC["62023.power-man-and-iron-fist-action"],
    );
  });

  it("Defiance 64015 and The Night Nurse 64017 are the earlier scripts, under their own ids", () => {
    expect(IRON_FIST_PROTECTION["64015.defiance-interrupt"]).toBeDefined();
    expect(IRON_FIST_PROTECTION["64015.defiance-interrupt"]).toBe(WAVE10_ABILITIES["26018.defiance-interrupt"]);
    expect(IRON_FIST_PROTECTION["64017.the-night-nurse-action"]).toBeDefined();
    expect(IRON_FIST_PROTECTION["64017.the-night-nurse-action"]).toBe(WAVE10_ABILITIES["09019.the-night-nurse-action"]);
  });

  it("each reprint prints the same text as its original: 64024 and 62023, 64015 and 26018, 64017 and 09019", () => {
    const text = (cards: readonly unknown[], id: string) =>
      (cards.find((c) => ((c as { id: string }).id as string) === id) as { text: { printed: string } }).text.printed;
    expect(text(IRON_FIST_CARDS, "64024")).toBe(text(LUKE_CAGE_CARDS, "62023"));
    expect(text(IRON_FIST_CARDS, "64015")).toBe(text(VISION_CARDS, "26018"));
    expect(text(IRON_FIST_CARDS, "64017")).toBe(text(DRS_CARDS, "09019"));
  });
});
