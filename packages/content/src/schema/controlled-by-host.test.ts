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
