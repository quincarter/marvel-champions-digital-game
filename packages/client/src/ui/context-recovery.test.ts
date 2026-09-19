import { describe, expect, test, vi } from "vitest";
import { redrawTexts, type TextRedrawNode } from "./context-recovery.js";

describe("redrawTexts", () => {
  test("redraws every text object, including ones nested in containers, and nothing else", () => {
    const top = { updateText: vi.fn() };
    const nested = { updateText: vi.fn() };
    const deep = { updateText: vi.fn() };
    const image: TextRedrawNode = {};
    const tree: TextRedrawNode[] = [top, image, { list: [nested, { list: [deep, {}] }] }];

    expect(redrawTexts(tree)).toBe(3);
    for (const text of [top, nested, deep]) expect(text.updateText).toHaveBeenCalledTimes(1);
  });

  test("an empty display list redraws nothing", () => {
    expect(redrawTexts([])).toBe(0);
  });
});
