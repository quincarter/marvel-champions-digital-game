import { describe, expect, it } from "vitest";
import { type AttachmentHost, validateAttachmentHost } from "./index.js";

describe("HostQualifiers.controlledBy", () => {
  // Manipulated Mind (sm 27171): "Attach to the ally you control with the lowest cost."
  const host: AttachmentHost = {
    kind: "superlative",
    among: "ally",
    order: "lowest",
    measure: "printedCost",
    controlledBy: "you",
  };

  it("accepts 'you' on a superlative host and as a qualified host's only qualifier", () => {
    expect(validateAttachmentHost(host, "attachment")).toEqual([]);
    expect(validateAttachmentHost({ kind: "qualified", category: "ally", controlledBy: "you" }, "attachment")).toEqual(
      [],
    );
  });

  it("refuses any other value", () => {
    expect(validateAttachmentHost({ ...host, controlledBy: "them" }, "attachment")).not.toEqual([]);
  });
});

describe("HostQualifiers.classification", () => {
  // Sidekick (aoa 45015): "Attach to an identity-specific ally you control."
  const sidekick: AttachmentHost = {
    kind: "qualified",
    category: "ally",
    classification: "identitySpecific",
    controlledBy: "you",
  };

  it("accepts each classification, alone or with controlledBy", () => {
    expect(validateAttachmentHost(sidekick, "attachment")).toEqual([]);
    for (const classification of ["identitySpecific", "aspect", "basic"] as const) {
      expect(validateAttachmentHost({ kind: "qualified", category: "ally", classification }, "attachment")).toEqual([]);
    }
  });

  it("refuses an unknown classification", () => {
    expect(
      validateAttachmentHost({ ...sidekick, classification: "campaign" } as unknown as AttachmentHost, "attachment"),
    ).not.toEqual([]);
  });
});
