import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { parseChangelog, parseTranslation, type ParsedChangelog } from "./release-history-notes.js";

/** Every `docs/releases/es/<version>.md` against its `.changes/<version>.md`, so a translation can't drift. */

const root = new URL("../../../../", import.meta.url);
const SPANISH = new URL("docs/releases/es/", root);
const CHANGES = new URL(".changes/", root);

const translated = readdirSync(SPANISH)
  .filter((name) => /^v[\d.]+\.md$/.test(name))
  .map((name) => name.replace(/\.md$/, ""));

/** The issue numbers, handles and links in a line, which a translation keeps. */
const refs = (line: string): readonly string[] =>
  [...line.matchAll(/(?<![\w/&])#\d+\b|(?<![\w/.])@[A-Za-z0-9-]+|https:\/\/[^\s)]+/g)].map((m) => m[0]).sort();

const shape = ({ version, date, sections }: ParsedChangelog) => ({
  version,
  date,
  sections: sections.map(({ kind, items }) => ({ kind, items: items.length })),
});

describe("Spanish release notes", () => {
  // A release's changelog is written when it is cut, so its translation can land first.
  const released = translated.filter((version) => existsSync(new URL(`${version}.md`, CHANGES)));

  test.each(released)("%s matches its English", (version) => {
    const english = parseChangelog(readFileSync(new URL(`${version}.md`, CHANGES), "utf8"));
    const { highlight, changelog } = parseTranslation(readFileSync(new URL(`${version}.md`, SPANISH), "utf8"));
    expect(highlight?.title).toBeTruthy();
    expect(highlight?.summary).toBeTruthy();
    expect(shape(changelog)).toEqual(shape(english));
    english.sections.forEach((section, s) => {
      section.items.forEach((item, i) => expect(refs(changelog.sections[s]!.items[i]!)).toEqual(refs(item)));
    });
  });

  test("every released version has a translation", () => {
    const versions = readdirSync(CHANGES)
      .filter((name) => /^v[\d.]+\.md$/.test(name))
      .map((name) => name.replace(/\.md$/, ""));
    expect(versions.filter((version) => !translated.includes(version))).toEqual([]);
  });
});
