import { describe, expect, test } from "vitest";
import { packIdOfCardCode, resolvePackCardImage } from "@mc/content";
import {
  packBasesOf,
  packIdOfCode,
  packImagePathOf,
  publicPackArtUrl,
  type PresencePack,
} from "./discord-presence-pack-art.js";

const BASE = "https://packs.champions-digital-game.com/mephisto-nep/1.2.0/";
const SHA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const CATALOG = JSON.stringify({
  schema: 2,
  packs: [
    {
      id: "mephisto-nep",
      withdrawn: false,
      versions: { "1.2.0": { base: BASE, zipSha256: SHA.toUpperCase() }, "1.1.0": { base: "http://insecure/" } },
    },
    {
      id: "gone-xx",
      withdrawn: true,
      versions: { "1.0.0": { base: "https://packs.example/gone-xx/1.0.0/", zipSha256: SHA } },
    },
    { id: "gwenpool-ptt", versions: { "0.2.4": { base: "https://packs.example/gwenpool-ptt/0.2.4", zipSha256: SHA } } },
    { id: "nosum-xx", versions: { "1.0.0": { base: "https://packs.example/nosum-xx/1.0.0/" } } },
    "junk",
  ],
});

const MEPHISTO: PresencePack = {
  id: "mephisto-nep",
  version: "1.2.0",
  languages: { base: "en", available: ["en", "es"] },
  files: new Set([
    "cards/en/x.mephisto-nep.01.webp",
    "cards/es/x.mephisto-nep.01.webp",
    "cards/en/x.mephisto-nep.01b.webp",
  ]),
  zipSha256: SHA,
};
const packs = new Map([[MEPHISTO.id, MEPHISTO]]);

describe("packBasesOf", () => {
  test("keeps https bases of listed versions, skips withdrawn packs and bad entries", () => {
    const bases = packBasesOf(CATALOG);
    expect(bases.get("mephisto-nep@1.2.0")).toEqual({ base: BASE, zipSha256: SHA });
    expect(bases.has("nosum-xx@1.0.0")).toBe(false);
    expect(bases.has("mephisto-nep@1.1.0")).toBe(false);
    expect(bases.has("gone-xx@1.0.0")).toBe(false);
    expect(bases.get("gwenpool-ptt@0.2.4")?.base).toBe("https://packs.example/gwenpool-ptt/0.2.4/");
  });

  test("no catalog, or a broken one, gives no bases", () => {
    expect(packBasesOf(null).size).toBe(0);
    expect(packBasesOf("{not json").size).toBe(0);
    expect(packBasesOf('{"packs":7}').size).toBe(0);
  });
});

describe("publicPackArtUrl", () => {
  const bases = packBasesOf(CATALOG);

  test("the first code the pack has, under the store's base URL", () => {
    expect(publicPackArtUrl(["x.mephisto-nep.01c", "x.mephisto-nep.01b"], packs, bases)).toBe(
      `${BASE}cards/en/x.mephisto-nep.01b.webp`,
    );
    expect(publicPackArtUrl(["x.mephisto-nep.01"], packs, bases, false, "es")).toBe(
      `${BASE}cards/es/x.mephisto-nep.01.webp`,
    );
    // No Spanish picture: the pack's base language.
    expect(publicPackArtUrl(["x.mephisto-nep.01b"], packs, bases, false, "es")).toBe(
      `${BASE}cards/en/x.mephisto-nep.01b.webp`,
    );
  });

  test("an install whose bytes are not the store's keeps the logo, even at a listed id and version", () => {
    const modified = new Map([
      [MEPHISTO.id, { ...MEPHISTO, zipSha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }],
    ]);
    expect(publicPackArtUrl(["x.mephisto-nep.01"], modified, bases)).toBeNull();
    expect(publicPackArtUrl(["x.mephisto-nep.01"], modified, bases, true)).toBeNull();
  });

  test("an install with no recorded checksum counts as the store's only when trusted (a release build)", () => {
    const unrecorded = new Map([[MEPHISTO.id, { ...MEPHISTO, zipSha256: undefined }]]);
    expect(publicPackArtUrl(["x.mephisto-nep.01"], unrecorded, bases)).toBeNull();
    expect(publicPackArtUrl(["x.mephisto-nep.01"], unrecorded, bases, true)).toBe(
      `${BASE}cards/en/x.mephisto-nep.01.webp`,
    );
  });

  test("an unlisted version, a missing pack or no codes give null", () => {
    expect(publicPackArtUrl(["x.mephisto-nep.01"], packs, new Map())).toBeNull();
    const other = new Map([[MEPHISTO.id, { ...MEPHISTO, version: "9.9.9" }]]);
    expect(publicPackArtUrl(["x.mephisto-nep.01"], other, bases)).toBeNull();
    expect(publicPackArtUrl(["x.gwenpool-ptt.01a"], packs, bases)).toBeNull();
    expect(publicPackArtUrl(null, packs, bases)).toBeNull();
    expect(publicPackArtUrl(["01001a"], packs, bases)).toBeNull();
  });
});

describe("the local copies of the @mc/content helpers", () => {
  test("agree with the originals", () => {
    for (const code of ["x.mephisto-nep.01", "x.a.b", "x..b", "x.nodot", "01001a", ""]) {
      expect(packIdOfCode(code)).toBe(packIdOfCardCode(code));
    }
    const has = (path: string): boolean => MEPHISTO.files.has(path);
    for (const languages of [MEPHISTO.languages, undefined, { base: "es", available: ["es"] }]) {
      for (const code of ["x.mephisto-nep.01", "x.mephisto-nep.01b", "x.mephisto-nep.09"]) {
        for (const lang of ["en", "es", "fr"]) {
          expect(packImagePathOf(languages, code, lang, has)).toBe(resolvePackCardImage(languages, code, lang, has));
        }
      }
    }
  });
});
