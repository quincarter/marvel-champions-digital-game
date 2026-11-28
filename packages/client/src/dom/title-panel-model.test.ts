import { describe, expect, it } from "vitest";
import { playPlatformMarkOf } from "../view/play-platform-mark.js";
import { onlinePanelIn } from "../view/title-online-panel.js";
import { titleRankBadgeOf } from "../view/title-rank-badge.js";
import { continueIconOf, platformIconOps, promoModelOf, rankBarOf } from "./title-panel-model.js";

describe("platformIconOps", () => {
  it("draws every shape of a mark in the button's own colour", () => {
    const mark = playPlatformMarkOf({ platform: "windows" })!;
    const ops = platformIconOps(mark);
    expect(ops).toHaveLength(mark.shapes.length);
    expect(ops.every((op) => op.k === "rect" && op.fill === "currentColor")).toBe(true);
  });

  it("turns the globe's ellipse into an arc path", () => {
    const ops = platformIconOps(playPlatformMarkOf({ platform: "web" })!);
    expect(ops.some((op) => op.k === "path")).toBe(true);
  });
});

describe("continueIconOf", () => {
  it("places the icon at the row's left edge in the row's own coordinates, with the label room it leaves", () => {
    const row = { x: 500, y: 300, width: 400, height: 52 };
    const { icon, labelInset } = continueIconOf(playPlatformMarkOf({ platform: "linux" })!, row);
    expect(icon.rect.x).toBe(14);
    expect(icon.rect.y).toBeGreaterThanOrEqual(0);
    expect(icon.rect.y + icon.rect.height).toBeLessThanOrEqual(row.height);
    expect(labelInset).toBeGreaterThan(icon.rect.x + icon.rect.width);
    expect(icon.label).toContain("Linux");
  });
});

describe("rankBarOf", () => {
  const badge = titleRankBadgeOf(0);

  it("stacks the rank over its name on a full plate and puts them on one line on a phone's strip", () => {
    const full = rankBarOf({ x: 0, y: 0, width: 300, height: 58 }, badge, null, { rankUp: "RANK UP" });
    expect(full).toMatchObject({ compact: false, up: false, label: badge.rankLabel, title: badge.title });
    const strip = rankBarOf({ x: 0, y: 0, width: 300, height: 42 }, badge, null, { rankUp: "RANK UP" });
    expect(strip).toMatchObject({ compact: true, label: `${badge.rankLabel} · ${badge.title}` });
  });

  it("names the new rank and drops the bar while a rank-up is announced", () => {
    const up = rankBarOf({ x: 0, y: 0, width: 300, height: 58 }, badge, "Rank up: Costumed Vigilante", {
      rankUp: "RANK UP",
    });
    expect(up).toMatchObject({ up: true, label: "RANK UP", title: "Costumed Vigilante", points: null, next: null });
  });

  it("says the short next-rank caption where the plate is too narrow for the name", () => {
    const narrow = rankBarOf({ x: 0, y: 0, width: 170, height: 58 }, badge, null, { rankUp: "RANK UP" });
    expect(narrow.next).toBe(badge.shortNextLabel);
  });
});

describe("promoModelOf", () => {
  const words = { title: "Play online", pitch: "Pitch", liveText: "3 live", host: "Host", join: "Join" };

  it("breaks a two-line title and puts the buttons in the panel's own coordinates", () => {
    const panel = onlinePanelIn({ x: 600, y: 300, width: 300, height: 400 }, "side");
    const model = promoModelOf(panel, words, true);
    expect(model.title.lines).toBe(panel.titleLines);
    expect(model.title.text).toBe(panel.titleLines === 2 ? "PLAY\nONLINE!" : "PLAY ONLINE!");
    expect(model.buttons.map((button) => button.key)).toEqual(["play-online-host", "play-online-join"]);
    expect(model.buttons[0]!.rect.x).toBe(panel.host.x - panel.rect.x);
    expect(model.buttons.every((button) => button.disabled === false)).toBe(true);
  });

  it("makes the buttons unavailable offline", () => {
    const panel = onlinePanelIn({ x: 600, y: 300, width: 300, height: 400 }, "side");
    expect(promoModelOf(panel, words, false).buttons.every((button) => button.disabled === true)).toBe(true);
  });
});
