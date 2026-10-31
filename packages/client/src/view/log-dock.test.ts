import { describe, expect, it } from "vitest";
import {
  boardLayout,
  CHROME_HEIGHT,
  CHROME_TICKER_ROW,
  formFactorFor,
  REFERENCE_VIEWPORTS,
  type Rect,
} from "./layout.js";
import { logDockRect, logDockWidthFor, logTickerOf, logTypeFor, logWithShownBeats, shownBeatsOf } from "./log-dock.js";
import { emptyLog, type LogLine, type LogState } from "./log-lines.js";
import { villainBandLayout, villainRailLayout, villainTabLayout } from "./villain-rail-layout.js";

const line = (id: string, text: string): LogLine => ({ id, ref: "R1.1", round: 1, text, tags: [], voice: "player" });
const logOf = (...lines: LogLine[]): LogState => ({ ...emptyLog(), lines });
const open = { locked: false, reason: null };

describe("the docked log", () => {
  it("is about a third of the screen, within readable bounds", () => {
    expect(logDockWidthFor(1440)).toBe(518);
    expect(logDockWidthFor(1024)).toBe(369);
    expect(logDockWidthFor(800)).toBe(360);
    expect(logDockWidthFor(3440)).toBe(640);
  });

  it("sits right of the table, under the title bar, down to the foot of the screen", () => {
    const { width, height } = REFERENCE_VIEWPORTS.desktop;
    const dock = logDockWidthFor(width);
    const layout = boardLayout({ x: 0, y: 0, width, height }, { playerCount: 1, villainDock: dock });
    const rect = logDockRect(layout, dock)!;
    expect(rect.x).toBe(width - dock);
    expect(rect.x + rect.width).toBe(width);
    expect(rect.y).toBe(CHROME_HEIGHT.desktop);
    expect(rect.y + rect.height).toBe(height);
    expect(layout.zones.hand!.x + layout.zones.hand!.width).toBeLessThanOrEqual(rect.x);
    expect(layout.zones.encounter!.x + layout.zones.encounter!.width).toBeLessThanOrEqual(rect.x);
  });

  it("leaves a guide rail on the right edge clear", () => {
    const { width, height } = REFERENCE_VIEWPORTS.desktop;
    const dock = logDockWidthFor(width);
    const layout = boardLayout(
      { x: 0, y: 0, width, height },
      { playerCount: 1, villainDock: dock, guideRail: { side: "right", width: 300 } },
    );
    expect(logDockRect(layout, dock)!.x + dock).toBe(width - 300);
  });
});

describe("the log on each layout", () => {
  it("has no panel on the long table, and gives its room to the encounter column", () => {
    const { width, height } = REFERENCE_VIEWPORTS.desktop;
    const { zones } = boardLayout({ x: 0, y: 0, width, height }, { playerCount: 1 });
    expect(zones.log).toBeNull();
    expect(zones.encounter!.height).toBe(zones.enemies!.height);
  });

  it("takes the tab area on a phone, pinned at any card size", () => {
    const { width, height } = REFERENCE_VIEWPORTS.phone;
    const layout = boardLayout({ x: 0, y: 0, width, height }, { playerCount: 1, activeTab: "log", cardScale: 1.5 });
    expect(layout.zones.log!.width).toBeGreaterThan(width - 40);
    expect(layout.maxScroll).toBe(0);
  });

  it("gives the phone's title bar its second row, and no other layout one", () => {
    const { width, height } = REFERENCE_VIEWPORTS.phone;
    const { zones } = boardLayout({ x: 0, y: 0, width, height }, { playerCount: 1 });
    expect(zones.chrome!.height).toBe(36 + CHROME_TICKER_ROW);
    expect(zones.tabs!.y).toBe(zones.chrome!.height);
  });

  it("reads larger on a bigger screen, never under 16px", () => {
    for (const { width, height } of Object.values(REFERENCE_VIEWPORTS)) {
      expect(logTypeFor(formFactorFor(width, height)).body).toBeGreaterThanOrEqual(16);
    }
    expect(logTypeFor("desktop").body).toBeGreaterThan(logTypeFor("phone").body);
  });
});

describe("the villain phase's Log button", () => {
  const panel = { x: 900, y: 44, width: 500, height: 850 };
  const input = { revealing: false, interruptOptions: 0 };
  const clear = (a: Rect, b: Rect): boolean =>
    a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;

  it("stands clear of SKIP, HIDE and the title on the rail and the band", () => {
    const band = { x: 12, y: 44, width: 1000, height: 300 };
    for (const layout of [villainRailLayout({ ...input, panel }), villainBandLayout({ ...input, panel: band })]) {
      expect(layout.logButton.width).toBeGreaterThan(0);
      for (const other of [layout.skip, layout.hide, layout.title]) expect(clear(layout.logButton, other)).toBe(true);
    }
  });

  it("leaves a phone's narrow header to the title bar's line", () => {
    const phone = { x: 0, y: 64, width: 390, height: 500 };
    const layout = villainTabLayout({ ...input, panel: phone, footer: { ...phone, y: 760, height: 84 } });
    expect(layout.logButton.width).toBe(0);
  });
});

describe("logTickerOf", () => {
  it("is the newest line", () => {
    expect(logTickerOf(logOf(line("a", "Old"), line("b", "New")), open)).toEqual({ text: "New", enabled: true });
  });

  it("says what the log is before anything has happened", () => {
    expect(logTickerOf(emptyLog(), open).enabled).toBe(true);
    expect(logTickerOf(emptyLog(), open).text).toContain("written here");
  });

  it("names the lesson while a tutorial keeps the log shut, and takes no press", () => {
    expect(logTickerOf(logOf(line("a", "Old")), { locked: true, reason: "Lesson 5" })).toEqual({
      text: "Unlocks after Lesson 5",
      enabled: false,
    });
  });
});

describe("shownBeatsOf", () => {
  const beats = [
    { step: 3, text: "Dealt a card." },
    { step: 4, text: "You revealed Eviction Notice." },
  ];

  it("keeps a facedown card's name out of the log until it has turned over", () => {
    expect(shownBeatsOf(beats, true).map((beat) => beat.text)).toEqual(["Dealt a card."]);
  });

  it("shows every beat otherwise", () => {
    expect(shownBeatsOf(beats, false)).toBe(beats);
  });
});

describe("logWithShownBeats", () => {
  it("leaves a log with nothing shown yet as it is", () => {
    const log = logOf(line("a", "Before the phase"));
    expect(logWithShownBeats(log, 2, [])).toBe(log);
  });

  it("follows the held log with the beats the rail has shown, in order, with ids of their own", () => {
    const lines = logWithShownBeats(logOf(line("a", "Before the phase")), 2, [
      { step: 1, text: "Threat placed." },
      { step: 2, text: "Rhino attacks." },
    ]).lines;
    expect(lines.map((one) => one.text)).toEqual(["Before the phase", "Threat placed.", "Rhino attacks."]);
    expect(new Set(lines.map((one) => one.id)).size).toBe(3);
    expect(lines[2]).toMatchObject({ ref: "R2 · step 2", voice: "villain", round: 2 });
  });
});
