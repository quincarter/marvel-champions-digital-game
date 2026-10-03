import { describe, expect, it } from "vitest";
import { MOJO_CARDS } from "./mojo/cards.js";
import { MUT_GEN_CARDS } from "./mut_gen/cards.js";

/** `BaseCard.cardBack` is curated (`Correction.cardBack`) and passed through ingestion; absent means the type's default. */
describe("curated card backs", () => {
  it("Longshot (mojo 39071) prints an encounter card back (MojoMania insert p. 2)", () => {
    const longshot = MOJO_CARDS.find((c) => c.name === "Longshot");
    expect(longshot?.type).toBe("ally");
    expect(longshot?.cardBack).toBe("encounter");
  });

  it("only Longshot among mojo allies carries a curated back, and the Captive allies (32089-32092) leave it unset", () => {
    expect(MOJO_CARDS.filter((c) => c.cardBack !== undefined).map((c) => c.name)).toEqual(["Longshot"]);
    const captives = MUT_GEN_CARDS.filter((c) => c.type === "ally" && c.traits.includes("CAPTIVE" as never));
    expect(captives.length).toBe(4);
    for (const c of captives) expect(c.cardBack).toBeUndefined();
  });
});
