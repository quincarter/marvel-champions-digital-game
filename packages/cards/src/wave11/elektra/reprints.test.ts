/**
 * Elektra's reprints: a verbatim reprint of an earlier card shares that card's script under its own ability id
 * (docs/phase7-elektra-iron-fist.md). Dance with the Devil 63027 reprints Fear No Evil's 60031 (same text, cost, wild
 * resource and amplify icon, `duplicate_of_code` in the curation).
 */
import { ELEKTRA_CARDS, FNE_CARDS } from "@mc/content";
import { FNE_ASPECT_BASIC_BASIC } from "../fne/aspect-basic/basic.js";
import { ELEKTRA_BASIC } from "./basic.js";

describe("elektra reprints", () => {
  it("Dance with the Devil 63027 is the same definition object as fne 60031's", () => {
    expect(ELEKTRA_BASIC["63027.dance-with-the-devil-action"]).toBeDefined();
    expect(ELEKTRA_BASIC["63027.dance-with-the-devil-action"]).toBe(
      FNE_ASPECT_BASIC_BASIC["60031.dance-with-the-devil-action"],
    );
  });

  it("the two cards print the same text and the same amplify icon", () => {
    const reprint = ELEKTRA_CARDS.find((c) => (c.id as string) === "63027") as unknown as {
      text: { printed: string };
      amplifyIcons: number;
    };
    const original = FNE_CARDS.find((c) => (c.id as string) === "60031") as unknown as typeof reprint;
    expect(reprint.text.printed).toBe(original.text.printed);
    expect(reprint.amplifyIcons).toBe(original.amplifyIcons);
  });
});
