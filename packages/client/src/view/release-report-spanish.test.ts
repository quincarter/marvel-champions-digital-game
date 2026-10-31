import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { reportTexts, SPANISH_REPORT_NOTICE, spanishReport } from "./release-report-spanish.js";

const root = new URL("../../../../", import.meta.url);
const MAPS = new URL("docs/releases/es/reports/", root);

const versions = readdirSync(MAPS).map((name) => name.replace(/\.json$/, ""));
const mapOf = (version: string) =>
  JSON.parse(readFileSync(new URL(`${version}.json`, MAPS), "utf8")) as Record<string, string>;
const pageOf = (version: string) =>
  readFileSync(new URL(`packages/client/public/releases/${version}/index.html`, root), "utf8");

describe("Spanish reports", () => {
  test.each(versions)("%s has Spanish for every line of English, and nothing else", (version) => {
    const texts = mapOf(version);
    const needed = new Set(reportTexts(pageOf(version)));
    expect([...needed].filter((text) => texts[text] === undefined)).toEqual([]);
    expect(Object.keys(texts).filter((text) => !needed.has(text))).toEqual([]);
  });

  test.each(versions)("%s writes a Spanish page with the notice", (version) => {
    const page = spanishReport(pageOf(version), mapOf(version));
    expect(page).toContain('<html lang="es">');
    expect(page).toContain("Informe de la versión");
    expect(page).not.toContain("Release report");
    expect(page).toContain(SPANISH_REPORT_NOTICE);
  });
});

test("the Spanish moves its inline tags as it likes, and text with no entry stays in English", () => {
  const page = '<html lang="en"><style></style><div class="wrap"><p>A <b>red</b> card</p><p>Left alone</p></div>';
  const made = spanishReport(page, { "A <b>red</b> card": "Una carta <b>roja</b>" });
  expect(made).toContain("<p>Una carta <b>roja</b></p>");
  expect(made).toContain("<p>Left alone</p>");
});

test("a line that wraps in the page is one entry", () => {
  expect(reportTexts("<p>One\n    line</p>")).toEqual(["One line"]);
});
