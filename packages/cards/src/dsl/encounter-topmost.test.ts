import { describe, expect, it } from "vitest";
import { encounterCards, query } from "./index.js";

// docs/phase7-wave6-handoff.md §3.76: `encounterCards`' third argument is the deck's `top` N, or options.
describe("encounterCards topmostOnly", () => {
  it("compiles { topmostOnly: true } to the engine's encounter selector", () => {
    expect(encounterCards(["discard"], query("attachment"), { topmostOnly: true })).toEqual({
      kind: "encounter",
      zones: ["discard"],
      filter: query("attachment"),
      topmostOnly: true,
    });
  });

  it("keeps a number or value as the deck's top N, and options can name both", () => {
    expect(encounterCards(["deck"], undefined, 2)).toEqual({
      kind: "encounter",
      zones: ["deck"],
      top: { kind: "const", value: 2 },
    });
    expect(encounterCards(["deck"], undefined, { top: 3, topmostOnly: true })).toEqual({
      kind: "encounter",
      zones: ["deck"],
      top: { kind: "const", value: 3 },
      topmostOnly: true,
    });
    expect(encounterCards(["deck"], undefined, {})).toEqual({ kind: "encounter", zones: ["deck"] });
  });
});
