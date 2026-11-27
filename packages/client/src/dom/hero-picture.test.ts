import { describe, expect, it } from "vitest";
import type { AnyCard } from "@mc/content";
import { HERO_ART } from "../art/hero-art.js";
import { PackLeases } from "../art/pack-art.js";
import { heroPictureOf } from "./hero-picture.js";

const card = (id: string): AnyCard => ({ id, type: "hero_identity", name: id }) as unknown as AnyCard;

describe("heroPictureOf", () => {
  const leases = new PackLeases();

  it("crops a hero's picture toward the face, the upper fifth down, when its folder names no focus", () => {
    const plain = [...HERO_ART.heroes].find(([, pictures]) => pictures[0]?.focus === undefined);
    expect(plain, "a hero picture with no focus.json").toBeTruthy();
    const picture = heroPictureOf(card(plain![0]), leases);
    expect(picture.src).toBe(plain![1][0]!.url);
    expect(picture.cover).toEqual({ x: 0.5, y: 0.22, centered: false });
  });

  it("centers the crop on the point a focus.json gives", () => {
    const focused = [...HERO_ART.heroes].find(([, pictures]) => pictures[0]?.focus?.y !== undefined);
    expect(focused, "a hero picture with a focus.json").toBeTruthy();
    const focus = focused![1][0]!.focus!;
    const picture = heroPictureOf(card(focused![0]), leases);
    expect(picture.cover).toEqual({ x: focus.x ?? 0.5, y: focus.y, centered: true });
  });

  it("has no picture to show for an unknown identity", () => {
    expect(heroPictureOf(undefined, leases).src).toBeNull();
  });
});
