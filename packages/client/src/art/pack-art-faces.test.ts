/** A custom card's face picks the pack's front or back picture (`x.<pack>.01a` hero face, `01b` alter-ego face). */
import { afterEach, describe, expect, it } from "vitest";
import type { AnyCard } from "@mc/content";
import { packStagePictureCodes } from "@mc/content";
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

const stages = (n: number) => Array.from({ length: n }, () => ({}));
const villain = card({ id: "x.demo.04", type: "villain", sides: [{ stages: stages(3) }] });
const scheme = card({ id: "x.demo.05a", type: "main_scheme", stages: stages(3) });

describe("packPictureCodes per stage", () => {
  it("letters a villain's stages from its own code: 04, 04b, 04c, each falling back to the card's code", () => {
    const at = (stageIndex: number) => packPictureCodes(villain, { kind: "villainStage", sideIndex: 0, stageIndex });
    expect(at(0)).toEqual(["x.demo.04"]);
    expect(at(1)).toEqual(["x.demo.04b", "x.demo.04"]);
    expect(at(2)).toEqual(["x.demo.04c", "x.demo.04"]);
  });
  it("counts stages across a villain's sides", () => {
    const two = card({ id: "x.demo.06", type: "villain", sides: [{ stages: stages(2) }, { stages: stages(1) }] });
    const face = { kind: "villainStage", sideIndex: 1, stageIndex: 0 } as const;
    expect(packPictureCodes(two, face)).toEqual(["x.demo.06c", "x.demo.06"]);
  });
  it("gives a main scheme's stages A then B in sequence: 05a to 05f", () => {
    const at = (stageIndex: number, side: "A" | "B") =>
      packPictureCodes(scheme, { kind: "mainSchemeStage", stageIndex, side })[0];
    expect([at(0, "A"), at(0, "B"), at(1, "A"), at(1, "B"), at(2, "A"), at(2, "B")]).toEqual(
      ["a", "b", "c", "d", "e", "f"].map((letter) => `x.demo.05${letter}`),
    );
    expect(packPictureCodes(scheme, { kind: "mainSchemeStage", stageIndex: 1, side: "B" })).toEqual([
      "x.demo.05d",
      "x.demo.05a",
    ]);
  });
  it("agrees with @mc/content's packStagePictureCodes", () => {
    for (const [c, face] of [
      [villain, { kind: "villainStage", sideIndex: 0, stageIndex: 2 }],
      [scheme, { kind: "mainSchemeStage", stageIndex: 2, side: "B" }],
      [scheme, { kind: "mainSchemeStage", stageIndex: 0, side: "A" }],
    ] as const) {
      expect(packPictureCodes(c, face)).toEqual(packStagePictureCodes(c as never, face));
    }
  });
  it("draws the stage's picture, then the card's first one, then nothing", () => {
    resolverWith(["x.demo.04", "x.demo.04c"]);
    expect(artFor(villain, { kind: "villainStage", sideIndex: 0, stageIndex: 2 })?.key).toContain("04c");
    expect(artFor(villain, { kind: "villainStage", sideIndex: 0, stageIndex: 1 })?.key).toMatch(/04$/);
    resolverWith([]);
    expect(artFor(villain, { kind: "villainStage", sideIndex: 0, stageIndex: 1 })).toBeNull();
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
