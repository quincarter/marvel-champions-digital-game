import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BOOKS, REPO_FILE_URL, hasBookText, loadBook } from "./books.js";

const REPO_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));

describe("the rulebooks", () => {
  it("has the text of every book, and every PDF it links to", () => {
    for (const book of BOOKS) {
      expect(hasBookText(book), book.source).toBe(true);
      for (const pdf of book.pdfs) expect(existsSync(`${REPO_ROOT}${pdf.path}`), pdf.path).toBe(true);
    }
  });

  it("links a PDF to the repo's own copy on GitHub", () => {
    expect(REPO_FILE_URL("docs/campaign-modes/mc10_the_rise_of_red_skull_rules_web.pdf")).toBe(
      "https://github.com/quincarter/marvel-champions-digital-game/blob/main/docs/campaign-modes/mc10_the_rise_of_red_skull_rules_web.pdf",
    );
  });

  it("reads every book into titled sections of plain text", async () => {
    for (const book of BOOKS) {
      const sections = await loadBook(book);
      expect(sections.length, book.id).toBeGreaterThan(3);
      for (const section of sections) {
        expect(section.title, book.id).not.toBe("");
        expect(section.blocks.length, `${book.id}: ${section.title}`).toBeGreaterThan(0);
        for (const block of section.blocks)
          expect(block.text, `${book.id}: ${section.title}`).not.toMatch(/\*\*|<a id=/);
      }
    }
  });

  it("gives the Rules Reference one section per glossary entry", async () => {
    const rrg = await loadBook(BOOKS.find((book) => book.id === "book:rrg")!);
    const titles = rrg.map((section) => section.title);
    expect(titles).toContain("ABILITY");
    expect(titles).toContain("GUARD");
    expect(titles).toContain("THE GOLDEN RULES");
    const ability = rrg.find((section) => section.title === "ABILITY")!;
    expect(ability.blocks[0]).toMatchObject({ kind: "paragraph" });
    expect(ability.blocks.some((block) => block.kind === "bullet" && block.depth > 0)).toBe(true);
  });

  it("gives a campaign rulebook one section per page, and drops its table of contents", async () => {
    const trors = await loadBook(BOOKS.find((book) => book.id === "book:mc10")!);
    const titles = trors.map((section) => section.title);
    expect(titles).toContain("Page 2: NEW KEYWORDS");
    expect(titles).toContain("Page 4");
    expect(titles).not.toContain("Table of Contents");
  });
});
