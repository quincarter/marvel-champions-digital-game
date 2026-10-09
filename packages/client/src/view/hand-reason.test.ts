import { describe, expect, test } from "vitest";
import { noTargetTag } from "./hand-reason.js";

describe("noTargetTag", () => {
  test("a trait-gated card names the trait", () => {
    expect(noTargetTag("play only if your identity has the Hero trait")).toBe("needs Hero");
  });
  test("a controlled-character gate names it", () => {
    expect(noTargetTag("play only if you control a Avenger character")).toBe("needs Avenger in play");
  });
  test("a bare restriction is called restricted", () => {
    expect(noTargetTag("this card's play restriction is not met")).toBe("restricted");
  });
  test("anything else keeps no target", () => {
    expect(noTargetTag("nothing to attack")).toBe("no target");
  });
});
