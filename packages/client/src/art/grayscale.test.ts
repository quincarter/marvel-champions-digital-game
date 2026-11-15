import { describe, expect, test } from "vitest";
import { bakedSizeOf, grayBucket, grayKeyOf, graySlotOf, grayscalePixels, scaledKeyOf } from "./grayscale.js";

describe("grayscalePixels (issue #716)", () => {
  test("each pixel becomes the mean of its channels, as Phaser's grayscale(1) filter draws it", () => {
    const data = new Uint8ClampedArray([255, 0, 0, 255, 30, 60, 90, 128, 10, 20, 31, 0]);
    grayscalePixels(data);
    expect([...data]).toEqual([85, 85, 85, 255, 60, 60, 60, 128, 20, 20, 20, 0]);
  });

  test("alpha is left alone and gray stays gray", () => {
    const data = new Uint8ClampedArray([200, 200, 200, 7]);
    grayscalePixels(data);
    expect([...data]).toEqual([200, 200, 200, 7]);
  });

  test("an empty buffer is fine", () => {
    const data = new Uint8ClampedArray(0);
    grayscalePixels(data);
    expect(data.length).toBe(0);
  });
});

describe("gray copy sizes", () => {
  test("a slot rounds up to the next bucket, and stops at the largest", () => {
    expect(grayBucket(1)).toBe(128);
    expect(grayBucket(128)).toBe(128);
    expect(grayBucket(129)).toBe(256);
    expect(grayBucket(370)).toBe(512);
    expect(grayBucket(3000)).toBe(4096);
    expect(grayBucket(9000)).toBe(4096);
  });

  test("the slot is the drawn rect in device pixels", () => {
    expect(graySlotOf({ width: 185, height: 110 }, 1)).toEqual({ width: 256, height: 128 });
    expect(graySlotOf({ width: 185, height: 110 }, 2)).toEqual({ width: 512, height: 256 });
  });

  test("a tall picture for a wide slot keeps the width the slot needs (the cover crop's scale)", () => {
    expect(bakedSizeOf({ width: 2371, height: 3600 }, { width: 256, height: 128 })).toEqual({
      width: 256,
      height: 389,
    });
  });

  test("a wide picture for a tall slot keeps the height", () => {
    expect(bakedSizeOf({ width: 2000, height: 1000 }, { width: 128, height: 512 })).toEqual({
      width: 1024,
      height: 512,
    });
  });

  test("never larger than the picture itself", () => {
    expect(bakedSizeOf({ width: 300, height: 200 }, { width: 1024, height: 1024 })).toEqual({
      width: 300,
      height: 200,
    });
  });

  test("an empty source still gives a drawable size", () => {
    expect(bakedSizeOf({ width: 0, height: 0 }, { width: 256, height: 256 })).toEqual({ width: 1, height: 1 });
  });

  test("a color copy scaled to a slot has its own key, apart from the gray one (#722)", () => {
    expect(scaledKeyOf("art/villains/klaw", { width: 256, height: 128 })).toBe("art/villains/klaw#@256x128");
    expect(scaledKeyOf("k", { width: 256, height: 128 })).not.toBe(grayKeyOf("k", { width: 256, height: 128 }));
  });

  test("the key names the picture and the slot", () => {
    expect(grayKeyOf("art/villains/klaw", { width: 256, height: 128 })).toBe("art/villains/klaw#gray@256x128");
  });
});
