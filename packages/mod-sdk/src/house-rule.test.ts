/**
 * `house-rule` packs (docs/custom-content-packs.md §11.11): what `mc-pack validate` accepts and refuses, and what the
 * build's preview leads with. The two community house rules (Lost Traits, GMW Fixes) are built and validated as they
 * ship by `community-packs.test.ts`.
 */
import { describe, expect, it } from "vitest";
import type { AnyCard } from "@mc/content";
import { assemblePack, type PackSource } from "./build.js";
import { buildPreview } from "./preview.js";
import { publishIssues, validatePack, type PackInput } from "./validate.js";

const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);

function source(over: Partial<PackSource["author"]> = {}, extra: Partial<Omit<PackSource, "author">> = {}): PackSource {
  return {
    author: {
      id: "test-rule",
      version: "1.0.0",
      kind: "house-rule",
      name: "Test Rule",
      authors: ["Tester"],
      description: "A house rule for the tests.",
      license: "test",
      requires: { app: ">=0.1.0" },
      languages: { base: "en", available: ["en"] },
      houseRule: { traitAdditions: [{ code: "01001a", traits: ["Web-Warrior"] }] },
      ...over,
    },
    cards: [],
    abilities: {},
    decks: [],
    scenarios: [],
    assets: new Map([
      ["CREDITS.md", bytes("credits")],
      ["PERMISSION.md", bytes("permission")],
      ["cards/en/01001a.webp", bytes("face 1")],
      ["cards/en/14001b.webp", bytes("face 2")],
    ]),
    ...extra,
  };
}

const issuesOf = (pack: PackInput): string[] => validatePack(pack).map((i) => `${i.path}: ${i.message}`);

describe("house-rule packs", () => {
  it("validates a rule that adds traits to official faces, with rebuilt pictures under their codes", () => {
    expect(issuesOf(assemblePack(source()))).toEqual([]);
    expect(
      issuesOf(
        assemblePack(
          source({
            houseRule: {
              traitAdditions: [
                { code: "01001a", traits: ["Web-Warrior"] },
                { code: "14001b", traits: ["Mutant"] },
              ],
            },
          }),
        ),
      ),
    ).toEqual([]);
  });

  it("validates a rule that only enables a mode, with scheme-stage faces (GMW Fixes: 16107b)", () => {
    const pack = assemblePack(
      source(
        { houseRule: { enablesMode: "balanced" } },
        { assets: new Map([...source().assets, ["cards/en/16107b.webp", bytes("stage 2B")]]) },
      ),
    );
    expect(issuesOf(pack)).toEqual([]);
  });

  it("refuses a code that is no official face, a code listed twice, and an empty trait list", () => {
    const issues = issuesOf(
      assemblePack(
        source({
          houseRule: {
            traitAdditions: [
              { code: "x.test-rule.01a", traits: ["Mutant"] },
              { code: "01001a", traits: ["Web-Warrior"] },
              { code: "01001a", traits: [] },
            ],
          },
        }),
      ),
    ).join("\n");
    expect(issues).toMatch(/code "x\.test-rule\.01a" is not a face of an official card/);
    expect(issues).toMatch(/code "01001a" is listed twice/);
    expect(issues).toMatch(/traits must list at least one trait name/);
  });

  it("only adds: a field other than code and traits is refused", () => {
    const pack = assemblePack(
      source({ houseRule: { traitAdditions: [{ code: "01001a", traits: ["Mutant"], remove: ["Avenger"] } as never] } }),
    );
    expect(issuesOf(pack).join("\n")).toMatch(/remove: is not a trait addition field/);
  });

  it("refuses card records, abilities and a picture of a face it does not rebuild", () => {
    const card = { id: "x.test-rule.01", type: "event", name: "Nope" } as unknown as AnyCard;
    const pack = assemblePack(
      source(
        {},
        {
          cards: [card],
          assets: new Map([...source().assets, ["cards/en/99999a.webp", bytes("not a card")]]),
        },
      ),
    );
    const issues = issuesOf(pack).join("\n");
    expect(issues).toMatch(/a house-rule pack adds no cards/);
    expect(issues).toMatch(/"99999a" is not a card of this pack/);
  });

  it("needs its houseRule, which must do something, and no other kind may carry one", () => {
    const { houseRule: _rule, ...noRule } = source().author;
    expect(issuesOf(assemblePack({ ...source(), author: noRule })).join("\n")).toMatch(/needs its houseRule/);
    expect(issuesOf(assemblePack(source({ houseRule: {} }))).join("\n")).toMatch(/does nothing/);
    expect(issuesOf(assemblePack(source({ houseRule: { enablesMode: "chaos" as never } }))).join("\n")).toMatch(
      /enablesMode: must be one of balanced/,
    );
    const hero = assemblePack(source({ kind: "hero" }));
    expect(issuesOf(hero).join("\n")).toMatch(/only a "house-rule" pack may carry a house rule/);
  });

  it("publishes like any pack once its permission is granted", () => {
    const pack = assemblePack(source());
    expect(publishIssues(pack.manifest).length).toBeGreaterThan(0);
    const granted = assemblePack(
      source({
        permission: {
          status: "granted",
          by: "Tester",
          date: "2026-11-13",
          evidence: "here",
          scope: "inclusion",
          languages: ["en"],
        },
      }),
    );
    expect(publishIssues(granted.manifest)).toEqual([]);
  });

  it("leads its preview with the first face it rebuilds, which is also the thumbnail", () => {
    const { preview, thumbFrom } = buildPreview(assemblePack(source()));
    expect(preview.featured).toEqual({ cardId: "01001a", images: ["cards/en/01001a.webp"] });
    expect(preview.cards).toEqual([]);
    expect(preview.images).toEqual(["cards/en/01001a.webp", "cards/en/14001b.webp"]);
    expect(thumbFrom).toBe("cards/en/01001a.webp");
  });

  it("carries the rule into the built pack.json", () => {
    const pack = assemblePack(source());
    expect(pack.manifest.kind).toBe("house-rule");
    expect(pack.manifest.houseRule).toEqual({ traitAdditions: [{ code: "01001a", traits: ["Web-Warrior"] }] });
  });
});
