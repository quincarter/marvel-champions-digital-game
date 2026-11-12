/** A custom card's face picks the pack's front or back picture (`x.<pack>.01a` hero face, `01b` alter-ego face). */
import { afterEach, describe, expect, it } from "vitest";
import type { AnyCard } from "@mc/content";
import { artFor, packPictureCodes, setPackArtResolver } from "./art-source.js";

const card = (fields: Record<string, unknown>): AnyCard => fields as unknown as AnyCard;
const identity = card({ id: "x.demo.01a", type: "hero_identity" });
const doubleSided = card({ id: "x.demo.02a", type: "upgrade", flipSide: { name: "B" } });
const single = card({ id: "x.demo.03", type: "event" });

function resolverWith(codes: readonly string[]): void {
  setPackArtResolver((code) => (codes.includes(code) ? { key: `art:pack:demo@1/${code}`, url: `blob:${code}` } : null));
}

afterEach(() => setPackArtResolver(() => null));

describe("packPictureCodes", () => {
  it("maps an identity's hero face to its own code and the alter-ego face to the b sibling, front as fallback", () => {
    expect(packPictureCodes(identity, { kind: "hero" })).toEqual(["x.demo.01a"]);
    expect(packPictureCodes(identity, { kind: "alterEgo" })).toEqual(["x.demo.01b", "x.demo.01a"]);
  });
  it("maps a double-sided card's flip side to its b sibling", () => {
    expect(packPictureCodes(doubleSided, { kind: "front" })).toEqual(["x.demo.02a"]);
    expect(packPictureCodes(doubleSided, { kind: "flipSide" })).toEqual(["x.demo.02b", "x.demo.02a"]);
  });
  it("gives a single-faced card its one picture for every face", () => {
    expect(packPictureCodes(single, { kind: "front" })).toEqual(["x.demo.03"]);
    expect(packPictureCodes(single, { kind: "flipSide" })).toEqual(["x.demo.03"]);
  });
});

describe("artFor on a custom card", () => {
  it("draws two different textures for an identity's two faces", () => {
    resolverWith(["x.demo.01a", "x.demo.01b"]);
    const hero = artFor(identity, { kind: "hero" });
    const alterEgo = artFor(identity, { kind: "alterEgo" });
    expect(hero?.key).toContain("01a");
    expect(alterEgo?.key).toContain("01b");
  });
  it("falls back to the front picture when the back is missing, and to nothing when both are", () => {
    resolverWith(["x.demo.01a"]);
    expect(artFor(identity, { kind: "alterEgo" })?.key).toContain("01a");
    resolverWith([]);
    expect(artFor(identity, { kind: "alterEgo" })).toBeNull();
  });
});
