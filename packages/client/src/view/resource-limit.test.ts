import { describe, expect, it } from "vitest";
import { notForReason, resourceLimitOf } from "./resource-limit.js";

describe("resource limits in words (issue #292)", () => {
  it("reads the kind of card from the printed text", () => {
    expect(resourceLimitOf("Hero Resource: Exhaust Finesse → generate a [wild] resource for an aspect card.")).toBe(
      "an aspect card",
    );
    expect(resourceLimitOf("Resource: Generate a [wild] resource for an [Attack] event.")).toBe("an Attack event");
    expect(
      resourceLimitOf("Resource: generate a [wild] resource for a War Machine event and place 1 ammo counter here."),
    ).toBe("a War Machine event");
    expect(resourceLimitOf("Hero Action: Ready Spider-Woman.")).toBeNull();
  });

  it("says what an aspect card is", () => {
    expect(notForReason("generate a [wild] resource for an aspect card.")).toBe(
      "Pays only for an aspect card: one that shows an aspect, such as Aggression or Justice",
    );
    expect(notForReason("generate a [wild] resource for an event.")).toBe("Pays only for an event");
    expect(notForReason("")).toBe("Can't pay for this card");
  });
});
