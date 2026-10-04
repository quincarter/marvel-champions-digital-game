import { describe, expect, test } from "vitest";
import type { AnyCard } from "@mc/content";
import { optionLabelsOf } from "./campaign-option-labels.js";

const cards: Record<string, unknown> = {
  a: { name: "Into the Fray", aspect: "justice" },
  b: { name: "Into the Fray", aspect: "aggression" },
  c: { name: "Uppercut", aspect: "aggression" },
  d: { name: "Armored Vest", aspect: "protection", setCode: "core" },
  e: { name: "Armored Vest", aspect: "protection", setCode: "gmw" },
};
const cardOf = (id: string) => cards[id] as AnyCard | undefined;

describe("optionLabelsOf", () => {
  test("adds the aspect only when a name repeats", () => {
    const labels = optionLabelsOf(["a", "b", "c"], cardOf);
    expect(labels.get("a")).toBe("Into the Fray · Justice");
    expect(labels.get("b")).toBe("Into the Fray · Aggression");
    expect(labels.get("c")).toBe("Uppercut");
  });
  test("same-aspect reprints are told apart by product", () => {
    const labels = optionLabelsOf(["d", "e"], cardOf, (code) =>
      code === "core" ? "Core Set" : "Galaxy's Most Wanted",
    );
    expect(labels.get("d")).toBe("Armored Vest · Core Set");
    expect(labels.get("e")).toBe("Armored Vest · Galaxy's Most Wanted");
  });
  test("unknown ids fall back to the id", () => expect(optionLabelsOf(["zz"], cardOf).get("zz")).toBe("zz"));
});
