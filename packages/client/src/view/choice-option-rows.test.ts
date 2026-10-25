import { describe, expect, test } from "vitest";
import { choiceRowsOf } from "./choice-option-rows.js";

const option = (optionId: string) => ({ optionId, label: optionId, ref: { kind: "none" as const } });
const confuse = { index: 1, label: "Confuse your identity", why: "Jessica Jones is stalwart and cannot be confused" };

describe("choiceRowsOf (#412)", () => {
  test("with nothing barred, the rows are the engine's options in order", () => {
    expect(choiceRowsOf({ options: [option("0"), option("1")] }, [])).toEqual([
      { kind: "option", optionIndex: 0 },
      { kind: "option", optionIndex: 1 },
    ]);
  });

  test("a barred option sits at its place on the card, disabled with why", () => {
    expect(choiceRowsOf({ options: [option("0"), option("2")] }, [confuse])).toEqual([
      { kind: "option", optionIndex: 0 },
      { kind: "unavailable", label: confuse.label, why: confuse.why },
      { kind: "option", optionIndex: 1 },
    ]);
  });

  test("repeatable options keep their order around a barred one", () => {
    const rows = choiceRowsOf({ options: [option("0#1"), option("0#2"), option("2#1")] }, [confuse]);
    expect(rows.map((row) => (row.kind === "option" ? row.optionIndex : row.label))).toEqual([0, 1, confuse.label, 2]);
  });

  test("options that are not indexes keep their order, with the barred ones after", () => {
    expect(choiceRowsOf({ options: [option("card:a")] }, [confuse])).toEqual([
      { kind: "option", optionIndex: 0 },
      { kind: "unavailable", label: confuse.label, why: confuse.why },
    ]);
  });
});
