import { readdirSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  TITLE_ART_SIZES,
  coverFit,
  pickTitleArt,
  pickTitleArtFor,
  titleArtSizeOf,
  upscaleOf,
  type TitleArt,
} from "./title-art.js";
import { containScale } from "./pictures.js";

const pool: readonly TitleArt[] = [
  { key: "title-art:a.png", url: "/a.png" },
  { key: "title-art:b.jpg", url: "/b.jpg" },
  { key: "title-art:c.webp", url: "/c.webp" },
];

describe("pickTitleArt", () => {
  test("nothing to show when the folder is empty", () => {
    expect(pickTitleArt([], null, () => 0.5)).toBeNull();
  });

  test("picks by the random draw", () => {
    expect(pickTitleArt(pool, null, () => 0)).toEqual(pool[0]);
    expect(pickTitleArt(pool, null, () => 0.99)).toEqual(pool[2]);
    // A draw of exactly 1 (some RNGs can return it) still lands on a real entry.
    expect(pickTitleArt(pool, null, () => 1)).toEqual(pool[2]);
  });

  test("never repeats the picture shown last time when there is a choice", () => {
    for (const draw of [0, 0.3, 0.6, 0.99]) {
      expect(pickTitleArt(pool, "title-art:b.jpg", () => draw)?.key).not.toBe("title-art:b.jpg");
    }
  });

  test("a single picture is shown again rather than nothing", () => {
    expect(pickTitleArt([pool[0]!], pool[0]!.key, () => 0.5)).toEqual(pool[0]);
  });
});

describe("coverFit", () => {
  test("a wide picture in a tall panel scales to the panel's height and crops the sides", () => {
    const fit = coverFit({ width: 2000, height: 1000 }, { width: 500, height: 1000 });
    expect(fit.scale).toBe(1);
    expect(fit.cropWidth).toBe(500);
    expect(fit.cropHeight).toBe(1000);
    expect(fit.cropX).toBe(750);
    expect(fit.cropY).toBe(0);
  });

  test("a small picture is scaled up to cover, never letterboxed", () => {
    const fit = coverFit({ width: 400, height: 300 }, { width: 800, height: 800 });
    expect(fit.scale).toBeCloseTo(800 / 300);
    expect(fit.cropWidth * fit.scale).toBeCloseTo(800);
    expect(fit.cropHeight * fit.scale).toBeCloseTo(800);
  });
});

describe("containScale", () => {
  test("fits the whole picture inside the panel, letterboxing the short side", () => {
    expect(containScale({ width: 2000, height: 1000 }, { width: 500, height: 1000 })).toBe(0.25);
    expect(containScale({ width: 1000, height: 2000 }, { width: 1000, height: 500 })).toBe(0.25);
    expect(containScale({ width: 0, height: 0 }, { width: 100, height: 100 })).toBe(1);
  });
});

describe("TITLE_ART_SIZES", () => {
  test("has an entry for every file in art/title/, and no other", () => {
    const files = readdirSync(new URL("../../../../art/title/", import.meta.url))
      .filter((name) => /\.(png|jpe?g|webp|avif)$/.test(name))
      .sort();
    expect(Object.keys(TITLE_ART_SIZES).sort()).toEqual(files);
  });

  test("is found by a picture's texture key", () => {
    expect(titleArtSizeOf({ key: "title-art:hercules.jpeg", url: "" })).toEqual({ width: 815, height: 1295 });
    expect(titleArtSizeOf({ key: "title-art:nope.png", url: "" })).toBeNull();
  });
});

describe("pickTitleArtFor", () => {
  const sizes: Record<string, { width: number; height: number }> = {
    "title-art:small.jpg": { width: 400, height: 500 },
    "title-art:mid.jpg": { width: 1500, height: 1000 },
    "title-art:big.jpg": { width: 4000, height: 3000 },
  };
  const art: readonly TitleArt[] = Object.keys(sizes).map((key) => ({ key, url: key }));
  const sizeOf = (picture: TitleArt) => sizes[picture.key] ?? null;
  const panel = { width: 1000, height: 1000 };

  test("the upscale is the cover scale times the density", () => {
    expect(upscaleOf({ width: 2000, height: 1000 }, { width: 500, height: 1000 }, 2)).toBe(2);
  });

  test("offers only pictures enlarged by no more than 1.5 device pixels per picture pixel", () => {
    // mid covers 1000x1000 at 1.0 (judged by its height); small at 2.5.
    for (const draw of [0, 0.4, 0.99]) {
      expect(["title-art:mid.jpg", "title-art:big.jpg"]).toContain(
        pickTitleArtFor(art, sizeOf, panel, 1, null, () => draw)?.key,
      );
    }
    // At 2x density mid needs 2.0: only big is left.
    expect(pickTitleArtFor(art, sizeOf, panel, 2, null, () => 0)?.key).toBe("title-art:big.jpg");
  });

  test("never repeats the last picture while another qualifies, and falls back to the least enlarged", () => {
    expect(pickTitleArtFor(art, sizeOf, panel, 1, "title-art:mid.jpg", () => 0)?.key).toBe("title-art:big.jpg");
    // At 5x nothing qualifies: the highest resolution wins, other than the avoided one.
    expect(pickTitleArtFor(art, sizeOf, panel, 5, null, () => 0)?.key).toBe("title-art:big.jpg");
    expect(pickTitleArtFor(art, sizeOf, panel, 5, "title-art:big.jpg", () => 0)?.key).toBe("title-art:mid.jpg");
  });

  test("no panel (a phone) is no filter, and an unknown size counts as good enough", () => {
    expect(pickTitleArtFor(art, sizeOf, null, 1, null, () => 0)?.key).toBe("title-art:small.jpg");
    const unknown: readonly TitleArt[] = [{ key: "title-art:new.png", url: "" }];
    expect(pickTitleArtFor(unknown, sizeOf, panel, 3, null, () => 0)?.key).toBe("title-art:new.png");
    expect(pickTitleArtFor([], sizeOf, panel, 1)).toBeNull();
  });

  test("the real pool: which pictures a 1920x1080 and a 2x tablet are offered (issue #760)", () => {
    const real: readonly TitleArt[] = Object.keys(TITLE_ART_SIZES).map((file) => ({
      key: `title-art:${file}`,
      url: "",
    }));
    const offered = (panelSize: { width: number; height: number }, density: number) =>
      real.filter((p) => upscaleOf(titleArtSizeOf(p)!, panelSize, density) <= 1.5).map((p) => p.key.slice(10));
    // A small picture is dropped on a desktop's art panel (about 55% of 1920 wide, full height).
    expect(offered({ width: 1056, height: 1080 }, 1)).not.toContain("box-core-set.jpeg");
    // The sharper Hercules and Rise of Apocalypse pictures (815x1295, 1080x1350) cover it now.
    expect(offered({ width: 1056, height: 1080 }, 1)).toContain("hercules.jpeg");
    expect(offered({ width: 1056, height: 1080 }, 1)).toContain("rise-of-apocalypse.jpeg");
    expect(offered({ width: 1056, height: 1080 }, 1)).toContain("wallpaper-2.jpg");
    expect(real.length).toBeGreaterThan(offered({ width: 1056, height: 1080 }, 1).length);
  });
});
