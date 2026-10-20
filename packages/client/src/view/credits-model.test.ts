import { describe, expect, it } from "vitest";
import { CREDITS, CREDIT_GROUPS, CREDITS_INTRO } from "../content/credits.js";
import { creditsRowHeightOf, creditsRowsOf, wrappedLinesOf } from "./credits-model.js";

describe("creditsRowsOf", () => {
  const rows = creditsRowsOf();

  it("opens with the fan-made notice naming Fantasy Flight Games and Marvel", () => {
    expect(rows[0]).toEqual({ kind: "notice", text: CREDITS_INTRO[0] });
    expect(CREDITS_INTRO[0]).toMatch(/fan-made, non-commercial/);
    expect(CREDITS_INTRO[0]).toMatch(/Fantasy Flight Games and Marvel/);
  });

  it("lists every entry once, under its group's heading, in group order", () => {
    const entries = rows.flatMap((row) => (row.kind === "entry" ? [row.entry.id] : []));
    expect([...entries].sort()).toEqual(CREDITS.map((entry) => entry.id).sort());
    const sections = rows.flatMap((row) => (row.kind === "section" ? [row.id] : []));
    expect(sections).toEqual(CREDIT_GROUPS.map((group) => group.id));
    let current = "";
    for (const row of rows) {
      if (row.kind === "section") current = row.id;
      if (row.kind === "entry") expect(row.entry.group).toBe(current);
    }
  });

  it("gives every entry a title, a place, a credit and an IP notice", () => {
    for (const entry of CREDITS) {
      for (const field of [entry.title, entry.shownIn, entry.credit, entry.notice]) expect(field.trim()).not.toBe("");
    }
    expect(new Set(CREDITS.map((entry) => entry.id)).size).toBe(CREDITS.length);
  });

  it("carries the Shadowland and Avengers #11 bibliographies", () => {
    const text = (id: string) => CREDITS.find((entry) => entry.id === id)?.credit ?? "";
    expect(text("shadowland-comic")).toMatch(/Andy Diggle/);
    expect(text("shadowland-comic")).toMatch(/Billy Tan/);
    expect(text("avengers-11")).toMatch(/Jason Aaron/);
    expect(text("avengers-11")).toMatch(/Cory Smith/);
  });
});

describe("row heights", () => {
  it("grow as text wraps onto more lines and as the column narrows", () => {
    const entry = creditsRowsOf().find((row) => row.kind === "entry")!;
    expect(creditsRowHeightOf(entry, 280)).toBeGreaterThan(creditsRowHeightOf(entry, 900));
    expect(wrappedLinesOf("one two three", 1000, 12)).toBe(1);
    expect(wrappedLinesOf("a\nb", 1000, 12)).toBe(2);
  });
});
