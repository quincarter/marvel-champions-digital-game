import { describe, expect, it } from "vitest";
import { cleanInline, parseBook, searchBook } from "./book-model.js";

describe("cleanInline", () => {
  it("drops markup, keeps the words", () => {
    expect(cleanInline("**_Rules RefeRence_**")).toBe("Rules RefeRence");
    expect(cleanInline("“ **Forced Interrupt** ” abilities.")).toBe("“Forced Interrupt” abilities.");
    expect(cleanInline("See [Player Phase](#player_phase)")).toBe("See Player Phase");
    expect(cleanInline("ACCELERATION ICON (****)")).toBe("ACCELERATION ICON");
    expect(cleanInline("Hinder X ***")).toBe("Hinder X");
  });

  it("leaves underscores and asterisks inside words alone", () => {
    expect(cleanInline("mc10_the_rise_of_red_skull.md")).toBe("mc10_the_rise_of_red_skull.md");
    expect(cleanInline("12[per_hero] hit points")).toBe("12[per_hero] hit points");
  });
});

describe("parseBook", () => {
  const markdown = [
    "# Title",
    "",
    "Intro line one",
    "continues here.",
    "",
    "## Table of Contents",
    "- [Page 1](#page-1)",
    "",
    '<a id="page-1"></a>',
    "## Page 1: Page 1 Rules",
    "*Source: book.pdf (Page 1 of 2)*",
    "",
    "#### Sub heading",
    "- Point",
    "- **»** Sub-point",
    "  - Nested",
    "",
    "> [!NOTE] Card / Graphic Callout",
    "> Rhino",
    "> VILLAIN",
    "",
    "| **A** | B |",
    "| --- | --- |",
    "| Ability ........4 | x |",
    "| c | d |",
    "",
    "4",
  ].join("\n");

  it("splits at the chosen levels, keeps the rest as blocks, and drops conversion noise", () => {
    const sections = parseBook(markdown, { splitAt: [1, 2], skipTitles: /^Table of Contents$/ });
    expect(sections.map((s) => s.title)).toEqual(["Title", "Page 1"]);
    expect(sections[0]!.blocks).toEqual([{ kind: "paragraph", text: "Intro line one continues here." }]);
    expect(sections[1]!.blocks).toEqual([
      { kind: "heading", text: "Sub heading" },
      { kind: "bullet", text: "Point", depth: 0 },
      { kind: "bullet", text: "Sub-point", depth: 1 },
      { kind: "bullet", text: "Nested", depth: 1 },
      { kind: "quote", text: "Rhino\nVILLAIN" },
      { kind: "paragraph", text: "A · B" },
      { kind: "paragraph", text: "c · d" },
    ]);
  });

  it("names the text before the first split heading", () => {
    expect(parseBook("Hello\n\n## One\nBody", { splitAt: [2], preamble: "Front" })[0]!.title).toBe("Front");
  });
});

describe("searchBook", () => {
  const sections = [
    { title: "Guard", blocks: [{ kind: "paragraph" as const, text: "Must be attacked first." }] },
    { title: "Retaliate", blocks: [{ kind: "paragraph" as const, text: "Deals damage to a guard attacker." }] },
    { title: "Surge", blocks: [{ kind: "paragraph" as const, text: "Reveal another." }] },
  ];

  it("finds titles first, then text, ignoring case", () => {
    expect(searchBook(sections, "GUARD")).toEqual([0, 1]);
    expect(searchBook(sections, "  ")).toEqual([0, 1, 2]);
    expect(searchBook(sections, "nothing")).toEqual([]);
  });
});
