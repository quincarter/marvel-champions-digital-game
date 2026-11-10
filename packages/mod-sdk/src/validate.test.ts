import { tinyPack } from "./fixtures/load.js";
import { sha256Hex } from "./sha256.js";
import { validatePack, type PackInput } from "./validate.js";

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
      /deck id must start with the pack id/,
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
