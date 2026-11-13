import { fakeWebp, tinyPack } from "./fixtures/load.js";
import { sha256Hex } from "./sha256.js";
import type { PackManifest } from "@mc/content";
import { isUnscriptedAbilityIssue, publishIssues, splitIssues, validatePack, type PackInput } from "./validate.js";

const text = (s: string): Uint8Array => new TextEncoder().encode(s);

interface Copy {
  manifest: any;
  files: Map<string, Uint8Array>;
  cards: any[];
  abilities: any;
  decks: any[];
}

/** A mutable copy of the fixture, to break one rule at a time. */
async function broken(change: (pack: Copy) => void): Promise<PackInput> {
  const pack = await tinyPack();
  const copy: Copy = {
    manifest: structuredClone(pack.manifest),
    files: new Map(pack.files),
    cards: structuredClone(pack.cards) as any[],
    abilities: { ...pack.abilities },
    decks: structuredClone(pack.decks ?? []) as any[],
  };
  change(copy);
  return copy as unknown as PackInput;
}

const messages = (input: PackInput, options = {}): string =>
  validatePack(input, options)
    .map((i) => `${i.path}: ${i.message}`)
    .join("\n");

describe("sha256Hex", () => {
  it("matches the known vectors", () => {
    expect(sha256Hex(text(""))).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256Hex(text("abc"))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(sha256Hex(text("a".repeat(1000)))).toBe("41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3");
  });
});

describe("validatePack", () => {
  it("passes the fixture", async () => {
    expect(validatePack(await tinyPack())).toEqual([]);
  });

  it("rejects bad schema fields", async () => {
    const issues = messages(
      await broken((p) => {
        p.manifest.version = "one";
        p.manifest.authors = [];
      }),
    );
    expect(issues).toMatch(/version: must be semver/);
    expect(issues).toMatch(/authors: must list at least one author/);
  });

  it("rejects a bad pack id", async () => {
    expect(messages(await broken((p) => (p.manifest.id = "Bad_Id")))).toMatch(/pack.json id/);
  });

  it("rejects a card code outside the pack's prefix", async () => {
    expect(messages(await broken((p) => (p.cards[1].id = "x.other.02")))).toMatch(
      /card code must start with "x.tiny-pack."/,
    );
  });

  it("rejects duplicate card codes", async () => {
    expect(messages(await broken((p) => (p.cards[1].id = p.cards[0].id)))).toMatch(/used by two cards/);
  });

  it("rejects an ability a card names that nobody defines", async () => {
    const issues = messages(await broken((p) => (p.cards[1].abilities = [{ id: "x.tiny-pack.02.missing" }])));
    expect(issues).toMatch(/defined by neither the pack nor the base game/);
  });

  it("accepts an ability a card names from the base game", async () => {
    const pack = await broken((p) => {
      p.cards[1].abilities = [{ id: "01093.tenacity-action" }];
      delete p.abilities["x.tiny-pack.02.test-rally-action"];
    });
    expect(messages(pack)).not.toMatch(/defined by neither/);
  });

  it("rejects an ability that fails validateDefinition", async () => {
    const issues = messages(
      await broken((p) => {
        // An attack effect with no (attack) label: the DSL's own check.
        p.abilities["x.tiny-pack.02.test-rally-action"] = {
          trigger: { kind: "action" },
          effects: [{ kind: "attack" }],
        };
      }),
    );
    expect(issues).toMatch(/abilities\/x.tiny-pack.02.test-rally-action: an attack effect belongs to/);
  });

  it("rejects a feature the client lacks", async () => {
    const issues = messages(await tinyPack(), { supportedFeatures: ["trigger:action"] });
    expect(issues).toMatch(/uses DSL feature "effect:thwart"/);
  });

  it("rejects requires.dslFeatures that disagrees with the abilities", async () => {
    const issues = messages(await broken((p) => (p.manifest.requires.dslFeatures = ["trigger:action"])));
    expect(issues).toMatch(/requires.dslFeatures: must list exactly/);
  });

  it("rejects an unsafe path, a missing file and a wrong size or hash", async () => {
    const unsafe = await broken((p) => p.manifest.files.push({ path: "../evil", bytes: 1, sha256: "0".repeat(64) }));
    expect(messages(unsafe)).toMatch(/unsafe file path/);
    const missing = await broken((p) => p.files.delete("data/decks.json"));
    expect(messages(missing)).toMatch(/data\/decks.json: listed in pack.json but missing/);
    const size = await broken((p) =>
      p.files.set("CREDITS.md", text("a much longer credits text than the fixture has")),
    );
    expect(messages(size)).toMatch(/CREDITS.md: size is/);
    const hash = await broken((p) => p.files.set("CREDITS.md", new Uint8Array(p.files.get("CREDITS.md")!).fill(65)));
    expect(messages(hash)).toMatch(/CREDITS.md: sha256 does not match/);
  });

  describe("a store cover", () => {
    /** The fixture with `bytes` added as a listed file at `path` and named as its cover. */
    const withCover = (bytes: Uint8Array, path = "cover.webp", cover: unknown = path) =>
      broken((p) => {
        p.files.set(path, bytes);
        p.manifest.files.push({ path, bytes: bytes.length, sha256: sha256Hex(bytes) });
        p.manifest.totalBytes += bytes.length;
        p.manifest.cover = cover;
      });

    it("passes a portrait WebP file of the pack", async () => {
      expect(validatePack(await withCover(fakeWebp(600, 984)))).toEqual([]);
      expect(validatePack(await withCover(fakeWebp(600, 984), "art/box.webp"))).toEqual([]);
    });

    it("rejects a cover the pack does not ship", async () => {
      expect(messages(await broken((p) => (p.manifest.cover = "cover.webp")))).toMatch(
        /pack.json cover: "cover.webp" is not a file of the pack/,
      );
    });

    it("rejects a file that is not a WebP picture, or a path that is not a .webp", async () => {
      expect(messages(await withCover(text("a PNG, really, not a WebP")))).toMatch(
        /cover: "cover.webp" is not a WebP picture/,
      );
      expect(messages(await withCover(fakeWebp(600, 984), "cover.png"))).toMatch(/cover: must be the path of a .webp/);
      expect(messages(await withCover(fakeWebp(600, 984), "cover.webp", "../cover.webp"))).toMatch(
        /cover: must be the path of a .webp/,
      );
    });

    it("rejects a landscape, tiny or oversized cover", async () => {
      expect(messages(await withCover(fakeWebp(984, 600)))).toMatch(/is 984x600: a cover is portrait/);
      expect(messages(await withCover(fakeWebp(100, 160)))).toMatch(/is 100x160: its height must be 300 to 4096/);
      expect(messages(await withCover(fakeWebp(600, 984, 1_000_001)))).toMatch(/is 1000001 bytes, more than/);
    });
  });

  it("rejects an unlisted file and a wrong totalBytes", async () => {
    expect(messages(await broken((p) => p.files.set("extra.txt", text("x"))))).toMatch(
      /extra.txt: in the pack but not listed/,
    );
    expect(messages(await broken((p) => (p.manifest.totalBytes += 1)))).toMatch(/totalBytes/);
  });

  it("requires CREDITS.md and PERMISSION.md", async () => {
    for (const name of ["CREDITS.md", "PERMISSION.md"]) {
      const pack = await broken((p) => {
        p.files.delete(name);
        p.manifest.files = p.manifest.files.filter((f: { path: string }) => f.path !== name);
        p.manifest.totalBytes = p.manifest.files.reduce((s: number, f: { bytes: number }) => s + f.bytes, 0);
      });
      expect(messages(pack)).toContain(`${name}: required file is missing`);
    }
  });

  it("rejects a deck card that exists nowhere", async () => {
    const issues = messages(await broken((p) => p.decks[0].cards.push({ cardId: "x.tiny-pack.99", quantity: 1 })));
    expect(issues).toMatch(/card "x.tiny-pack.99" is in neither/);
  });

  it("rejects an ability id outside the pack's prefix", async () => {
    const issues = messages(
      await broken((p) => {
        p.abilities["x.other.02.rally"] = p.abilities["x.tiny-pack.02.test-rally-action"];
      }),
    );
    expect(issues).toMatch(/ability id must be "x.tiny-pack./);
  });

  it("reports an ability a card names that is an Object.prototype key", async () => {
    const issues = messages(await broken((p) => (p.cards[1].abilities = [{ id: "constructor" }])));
    expect(issues).toMatch(/ability "constructor" is defined by neither/);
  });

  it("reports an ability id whose card number has no card, and card schema problems", async () => {
    const noCard = await broken((p) => {
      p.abilities["x.tiny-pack.77.rally"] = p.abilities["x.tiny-pack.02.test-rally-action"];
    });
    expect(messages(noCard)).toMatch(/x.tiny-pack.77.rally: ability id names a card number/);
    const badCard = await broken((p) => (p.cards[1].cost = "free"));
    expect(messages(badCard)).toMatch(/x.tiny-pack.02: /);
  });

  it("checks deck ids and the content schema's deck rules", async () => {
    expect(messages(await broken((p) => (p.decks[0].id = "other-deck")))).toMatch(
      /deck id must start with "tiny-pack-"/,
    );
    expect(messages(await broken((p) => p.decks.push({ ...p.decks[0] })))).toMatch(/deck id is used by two decks/);
    expect(messages(await broken((p) => (p.decks[0].cards = [])))).toMatch(/tiny-pack-precon: starter deck must list/);
  });

  it("checks scenarios with the content schema", async () => {
    const pack = await broken(() => {});
    const issues = messages({ ...pack, scenarios: [{ id: "x" }] } as PackInput);
    expect(issues).toMatch(/x: scenario missing name/);
  });

  it("accepts cards of required packs through requiredPackCards", async () => {
    const pack = await broken((p) => p.decks[0].cards.push({ cardId: "x.other-pack.01", quantity: 1 }));
    expect(messages(pack)).toMatch(/x.other-pack.01/);
    expect(messages(pack, { requiredPackCards: new Set(["x.other-pack.01"]) })).not.toMatch(/x.other-pack.01/);
  });

  it("never throws on malformed input, it reports it", async () => {
    const good = await tinyPack();
    const garbage: unknown[] = [
      null,
      undefined,
      42,
      {},
      { manifest: null },
      { ...good, abilities: null },
      {
        ...good,
        abilities: { "x.tiny-pack.02.a": null, "x.tiny-pack.02.b": 5, "x.tiny-pack.02.c": { trigger: null } },
      },
      { ...good, cards: null },
      { ...good, cards: [null, 3, "x", { id: 5 }, { id: "x.tiny-pack.01", type: "event" }] },
      { ...good, decks: "no" },
      {
        ...good,
        decks: [
          null,
          { id: "tiny-pack-a", cards: "no" },
          { id: "tiny-pack-b", identityCardId: 1, cards: [null, 4, {}] },
        ],
      },
      { ...good, scenarios: [null, 7, {}] },
      { ...good, files: null },
      { ...good, files: new Map([["CREDITS.md", "not bytes"]]) },
      {
        ...good,
        manifest: {
          ...good.manifest,
          files: [null, 1, { path: 3 }, { path: "a", sha256: "0".repeat(64), bytes: "x" }],
        },
      },
      { ...good, manifest: { ...good.manifest, pictures: { hero: null, other: { a: 1 } } } },
      { ...good, manifest: { ...good.manifest, pictures: 5, contents: null, requires: null, authors: null } },
    ];
    for (const input of garbage) {
      expect(() => validatePack(input as PackInput)).not.toThrow();
      expect(validatePack(input as PackInput).length).toBeGreaterThan(0);
    }
  });
});

/** Adds a file to a broken copy, listed in its manifest, so only the rule under test fails. */
function addFile(pack: Copy, path: string, content = "x"): void {
  const bytes = text(content);
  pack.files.set(path, bytes);
  pack.manifest.files.push({ path, bytes: bytes.length, sha256: sha256Hex(bytes) });
  pack.manifest.files.sort((a: any, b: any) => (a.path < b.path ? -1 : 1));
  pack.manifest.totalBytes += bytes.length;
}

describe("validatePack: unscripted abilities", () => {
  it("marks a missing ability script as its own category, apart from real defects", async () => {
    const pack = await broken((p) => (p.cards[1].abilities = [{ id: "x.tiny-pack.02.missing" }]));
    const issues = validatePack(pack);
    const { unscripted, defects } = splitIssues(issues);
    expect(unscripted).toHaveLength(1);
    expect(unscripted[0]).toMatchObject({ category: "unscripted-ability", path: "cards/x.tiny-pack.02" });
    expect(isUnscriptedAbilityIssue(unscripted[0]!)).toBe(true);
    expect(defects).toEqual([]);
  });

  it("keeps real defects uncategorized", async () => {
    const issues = validatePack(await broken((p) => (p.manifest.version = "one")));
    expect(splitIssues(issues).unscripted).toEqual([]);
    expect(splitIssues(issues).defects).toHaveLength(1);
  });
});

describe("validatePack: languages, per-language pictures and alternate art", () => {
  const withLanguages = (p: Copy): void => {
    p.manifest.languages = { base: "en", available: ["en", "es"] };
    addFile(p, "cards/en/x.tiny-pack.01a.webp");
    addFile(p, "cards/en/x.tiny-pack.01b.webp");
    addFile(p, "cards/es/x.tiny-pack.02.webp");
  };

  it("accepts pictures of a card and of its other face in each language", async () => {
    expect(validatePack(await broken(withLanguages))).toEqual([]);
  });

  it("needs languages for pictures, a base among the available, and known languages", async () => {
    expect(messages(await broken((p) => addFile(p, "cards/en/x.tiny-pack.02.webp")))).toMatch(/need "languages"/);
    const baseMissing = await broken((p) => {
      withLanguages(p);
      p.manifest.languages.base = "fr";
    });
    expect(messages(baseMissing)).toMatch(/languages.base: must be one of the available/);
    const unknownLanguage = await broken((p) => {
      withLanguages(p);
      addFile(p, "cards/fr/x.tiny-pack.02.webp");
    });
    expect(messages(unknownLanguage)).toMatch(/language "fr" is not in languages.available/);
  });

  it("needs every stage picture of a main scheme once the pack ships any picture of it", async () => {
    const asScheme = (p: Copy): void => {
      withLanguages(p);
      p.cards[1] = { ...p.cards[1], type: "main_scheme", stages: [{}, {}] };
    };
    // Card 02's own number has a picture (es only counts in its own language), so the base language needs all four.
    const partial = await broken((p) => {
      asScheme(p);
      addFile(p, "cards/en/x.tiny-pack.02a.webp");
      addFile(p, "cards/en/x.tiny-pack.02b.webp");
    });
    expect(messages(partial)).toMatch(/stage picture "cards\/en\/x.tiny-pack.02c.webp" is not a listed file/);
    expect(messages(partial)).not.toMatch(/stage picture "cards\/en\/x.tiny-pack.02a.webp"/);
    const none = await broken(asScheme);
    expect(messages(none)).not.toMatch(/stage picture/);
  });

  it("rejects a picture of a card the pack does not have", async () => {
    const pack = await broken((p) => {
      withLanguages(p);
      addFile(p, "cards/en/x.tiny-pack.77.webp");
    });
    expect(messages(pack)).toMatch(/"x.tiny-pack.77" is not a card of this pack/);
  });

  it("checks alternate art: language, card, and a listed file", async () => {
    const good = await broken((p) => {
      withLanguages(p);
      addFile(p, "alt-art/en/01088.webp");
      addFile(p, "alt-art/en/x.tiny-pack.01b.webp");
      p.manifest.altArt = {
        en: { "01088": "alt-art/en/01088.webp", "x.tiny-pack.01b": "alt-art/en/x.tiny-pack.01b.webp" },
      };
    });
    expect(validatePack(good)).toEqual([]);
    const bad = await broken((p) => {
      withLanguages(p);
      p.manifest.altArt = { fr: { "99999": "alt-art/fr/nope.webp" }, en: "no" };
    });
    const issues = messages(bad);
    expect(issues).toMatch(/altArt.fr: language is not in languages.available/);
    expect(issues).toMatch(/altArt.fr.99999: is a card neither/);
    expect(issues).toMatch(/altArt.fr.99999: "alt-art\/fr\/nope.webp" is not a listed file/);
    expect(issues).toMatch(/altArt.en: must map card codes to file paths/);
  });

  it("checks permission, template credit and translators when present", async () => {
    expect(
      validatePack(
        await broken((p) => {
          p.manifest.permission = { by: "Creator", date: "2026-11-05", scope: "inclusion", evidence: "a DM" };
          p.manifest.templateCredit = "Hitch";
          p.manifest.translators = { es: "Someone" };
        }),
      ),
    ).toEqual([]);
    const issues = messages(
      await broken((p) => {
        p.manifest.permission = { by: "", date: "yesterday" };
        p.manifest.templateCredit = "";
        p.manifest.translators = { "NOT A TAG": "x", es: "" };
      }),
    );
    expect(issues).toMatch(/permission.by: must say who/);
    expect(issues).toMatch(/permission.date: must be YYYY-MM-DD/);
    expect(issues).toMatch(/templateCredit: must be text/);
    expect(issues).toMatch(/translators.NOT A TAG/);
    expect(issues).toMatch(/translators.es/);
  });

  it("checks the permission's status, languages and, when granted, its full record", async () => {
    const issues = messages(
      await broken((p) => {
        p.manifest.permission = { by: "Creator", status: "maybe", languages: ["NOT A TAG"], note: "" };
      }),
    );
    expect(issues).toMatch(/permission.status: must be one of granted, pending/);
    expect(issues).toMatch(/permission.languages: must be a list of language tags/);
    expect(issues).toMatch(/permission.note: must be text/);
    const granted = messages(
      await broken((p) => {
        p.manifest.permission = { by: "Creator", status: "granted" };
      }),
    );
    for (const field of ["date", "evidence", "scope", "languages"])
      expect(granted).toMatch(new RegExp(`permission.${field}: is required when the status is granted`));
    // Pending (or no status) keeps the record as far as it goes.
    expect(
      validatePack(
        await broken((p) => {
          p.manifest.permission = { by: "Creator", status: "pending", note: "no date on record" };
        }),
      ),
    ).toEqual([]);
  });

  it("never throws on malformed language and art fields", async () => {
    const good = await tinyPack();
    for (const manifest of [
      { ...good.manifest, languages: 5 },
      { ...good.manifest, languages: { base: 1, available: "en" } },
      { ...good.manifest, altArt: [] },
      { ...good.manifest, altArt: { en: null } },
      { ...good.manifest, permission: "yes", translators: [], templateCredit: 3 },
    ]) {
      expect(() => validatePack({ ...good, manifest } as unknown as PackInput)).not.toThrow();
      expect(validatePack({ ...good, manifest } as unknown as PackInput).length).toBeGreaterThan(0);
    }
  });
});

describe("publishIssues", () => {
  const grant = {
    by: "Creator",
    status: "granted",
    date: "2026-11-05",
    evidence: "https://example.invalid/dm",
    scope: "inclusion and translation",
    languages: ["en", "es"],
  };
  const manifest = (extra: object): PackManifest => ({ ...({} as PackManifest), id: "x", ...extra });
  const issuesOf = (m: PackManifest): string =>
    publishIssues(m)
      .map((i) => `${i.path}: ${i.message}`)
      .join("\n");

  it("passes a granted permission that covers every shipped language", () => {
    expect(publishIssues(manifest({ permission: grant, languages: { base: "en", available: ["en", "es"] } }))).toEqual(
      [],
    );
    expect(publishIssues(manifest({ permission: grant }))).toEqual([]);
  });

  it("refuses a pack with no permission, or one not granted, naming what is missing", () => {
    expect(issuesOf(manifest({}))).toMatch(/permission: is required to publish/);
    expect(issuesOf(manifest({ permission: { by: "Creator" } }))).toMatch(/permission.status: is missing, not granted/);
    expect(issuesOf(manifest({ permission: { by: "Creator", status: "pending", note: "no date" } }))).toMatch(
      /is pending, not granted, so the pack is not published: no date/,
    );
  });

  it("refuses a translation the grant does not cover", () => {
    const m = manifest({
      permission: { ...grant, languages: ["en"] },
      languages: { base: "en", available: ["en", "es"] },
    });
    expect(issuesOf(m)).toMatch(/permission.languages: does not cover es/);
  });
});
