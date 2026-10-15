import { describe, expect, test } from "vitest";
import { boostCell } from "./villain-breakdown.js";

describe("boostCell", () => {
  test("one boost card is just the icon total", () => {
    expect(boostCell(1, 2)).toEqual({ label: "BOOST", value: "2" });
    expect(boostCell(0, 0)).toEqual({ label: "BOOST", value: "0" });
  });

  test("two boost cards keep the count out of the label, so the line reads without a stray multiplication", () => {
    const { label, value } = boostCell(2, 0);
    expect(`SCH 2 + ${label} ${value} = THREAT 2`).toBe("SCH 2 + BOOST 0 (2 cards) = THREAT 2");
  });
});
