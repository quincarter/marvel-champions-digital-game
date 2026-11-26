import { afterEach, describe, expect, it } from "vitest";
import { CREDITS, CREDIT_GROUPS, CREDITS_INTRO, FFG_MARVEL } from "../content/credits.js";
import { en } from "../i18n/en.js";
import { es } from "../i18n/es.js";
import { useEnglish, useSpanish } from "../i18n/test-language.js";
import { CREDITS_ES } from "../content/credits-es.js";
import { creditsRowsOf } from "./credits-model.js";

afterEach(useEnglish);

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
    const first = rows.find((row) => row.kind === "entry")!;
    expect(first.kind === "entry" && first.lines.map((line) => line.tone)).toEqual(
      expect.arrayContaining(["small", "body"]),
    );
  });

  it("carries the Shadowland and Avengers #11 bibliographies", () => {
    const text = (id: string) => CREDITS.find((entry) => entry.id === id)?.credit ?? "";
    expect(text("shadowland-comic")).toMatch(/Andy Diggle/);
    expect(text("shadowland-comic")).toMatch(/Billy Tan/);
    expect(text("avengers-11")).toMatch(/Jason Aaron/);
    expect(text("avengers-11")).toMatch(/Cory Smith/);
  });

  it("words the notices, the group titles and the labels in Spanish", () => {
    useSpanish();
    const spanish = creditsRowsOf();
    expect(spanish[0]).toEqual({ kind: "notice", text: es["credits.intro.fanProject"] });
    expect(spanish.find((row) => row.kind === "section" && row.id === "music")).toMatchObject({
      title: es["credits.group.music"],
    });
    const ffg = spanish.find((row) => row.kind === "entry" && row.entry.notice === FFG_MARVEL);
    expect(ffg?.kind === "entry" && ffg.lines.some((line) => line.text === es["credits.notice.ffgMarvel"])).toBe(true);
    expect(en["credits.intro.fanProject"]).toBe(CREDITS_INTRO[0]);
  });

  it("has every entry's place, credit and notice in Spanish, and draws them whole", () => {
    for (const entry of CREDITS) {
      const spanish = CREDITS_ES[entry.id];
      expect(spanish, entry.id).toBeDefined();
      for (const field of [spanish!.shownIn, spanish!.credit, spanish!.notice]) expect(field.trim()).not.toBe("");
    }
    useSpanish();
    const game = creditsRowsOf().find((row) => row.kind === "entry" && row.entry.id === "game");
    // A notice no other entry shares (the AGPL line) reads in Spanish, with the licence's name kept.
    const lines = game?.kind === "entry" ? game.lines.map((line) => line.text) : [];
    expect(lines).toContain(CREDITS_ES["game"]!.notice);
    expect(CREDITS_ES["game"]!.notice).toMatch(/AGPL/);
    expect(lines.some((line) => line.includes(CREDITS_ES["game"]!.shownIn))).toBe(true);
  });
});
