import { describe, expect, test } from "vitest";
import { rectsOverlap } from "./layout.js";
import {
  liveCountOf,
  onlineArtHeight,
  onlinePanelIn,
  onlinePanelRects,
  onlineSideFits,
  shiftOnlinePanel,
  sideArtWidth,
} from "./title-online-panel.js";

describe("the Title's Play online panel", () => {
  test("a caption box over the art stacks its buttons only where the box is narrow", () => {
    const wide = onlinePanelIn({ x: 24, y: 400, width: 413, height: onlineArtHeight(413) }, "art");
    expect(wide.host.y).toBe(wide.join.y);
    expect(wide.host.x + wide.host.width).toBeLessThan(wide.join.x);
    const narrow = onlinePanelIn({ x: 40, y: 600, width: 266, height: onlineArtHeight(266) }, "art");
    expect(narrow.host.y + narrow.host.height).toBeLessThan(narrow.join.y);
    expect(onlineArtHeight(266)).toBeGreaterThan(onlineArtHeight(413));
  });

  test("the panel's parts stay inside it and clear of each other, at each placement and height", () => {
    const cases = [
      onlinePanelIn({ x: 24, y: 400, width: 413, height: onlineArtHeight(413) }, "art"),
      onlinePanelIn({ x: 40, y: 600, width: 266, height: onlineArtHeight(266) }, "art"),
      onlinePanelIn({ x: 900, y: 340, width: 300, height: 446 }, "side"),
      onlinePanelIn({ x: 900, y: 340, width: 300, height: 330 }, "side"),
    ];
    for (const panel of cases) {
      const parts = onlinePanelRects(panel);
      for (const part of parts) {
        expect(part.x).toBeGreaterThanOrEqual(panel.rect.x);
        expect(part.x + part.width).toBeLessThanOrEqual(panel.rect.x + panel.rect.width + 0.01);
        expect(part.y).toBeGreaterThanOrEqual(panel.rect.y);
        expect(part.y + part.height).toBeLessThanOrEqual(panel.rect.y + panel.rect.height + 0.01);
      }
      for (let i = 0; i < parts.length; i++) {
        for (let j = i + 1; j < parts.length; j++) expect(rectsOverlap(parts[i]!, parts[j]!)).toBe(false);
      }
    }
  });

  test("the side placement fills a tall panel with a seats picture and a short one without", () => {
    expect(onlinePanelIn({ x: 0, y: 0, width: 300, height: 446 }, "side").seats).not.toBeNull();
    expect(onlinePanelIn({ x: 0, y: 0, width: 300, height: 300 }, "side").seats).toBeNull();
  });

  test("the side placement needs a wide, tall screen and leaves the art panel a third", () => {
    expect(onlineSideFits(1440, 980, 40, 520)).toBe(true);
    expect(onlineSideFits(1920, 1080, 40, 520)).toBe(true);
    expect(onlineSideFits(1024, 768, 24, 520)).toBe(false);
    expect(onlineSideFits(1280, 720, 24, 520)).toBe(false);
    expect(onlineSideFits(1920, 600, 40, 520)).toBe(false);
    expect(sideArtWidth(1920, 40, 520)).toBe(864);
    expect(sideArtWidth(1440, 40, 520)).toBeLessThan(648);
  });

  test("the live count is drawn only for a positive answer", () => {
    expect(liveCountOf(null)).toBeNull();
    expect(liveCountOf(0)).toBeNull();
    expect(liveCountOf(3)).toBe(3);
  });

  test("shifting moves every part by the same amount", () => {
    const panel = onlinePanelIn({ x: 900, y: 340, width: 300, height: 446 }, "side");
    const moved = shiftOnlinePanel(panel, 30);
    expect(moved.host.y - panel.host.y).toBe(30);
    expect(moved.seats!.y - panel.seats!.y).toBe(30);
    expect(moved.live!.y - panel.live!.y).toBe(30);
    expect(moved.band.x).toBe(panel.band.x);
  });
});
