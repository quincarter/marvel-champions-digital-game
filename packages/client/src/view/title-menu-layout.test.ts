import { describe, expect, test } from "vitest";
import { rectsOverlap } from "./layout.js";
import {
  titleMenuLayout,
  titleMenuLayoutRects,
  updateBannerActionCount,
  updateBannerParts,
} from "./title-menu-layout.js";
import { NOTICE_BAR_HEIGHT, NOTICE_BAR_HEIGHTS } from "./shadowland-notice.js";

const SIZES: readonly { readonly width: number; readonly height: number }[] = [
  { width: 440, height: 900 },
  { width: 800, height: 600 },
  { width: 1280, height: 1000 },
];

describe("titleMenuLayout", () => {
  for (const size of SIZES) {
    for (const continuable of [false, true]) {
      test(`no two rows overlap at ${size.width}x${size.height}, continuable=${continuable}`, () => {
        const layout = titleMenuLayout({ ...size, continuable });
        const rects = titleMenuLayoutRects(layout);
        for (let i = 0; i < rects.length; i++) {
          for (let j = i + 1; j < rects.length; j++) {
            expect(rectsOverlap(rects[i]!, rects[j]!)).toBe(false);
          }
        }
      });

      test(`every row stays within the screen bounds at ${size.width}x${size.height}, continuable=${continuable}`, () => {
        const layout = titleMenuLayout({ ...size, continuable });
        for (const rect of titleMenuLayoutRects(layout)) {
          expect(rect.x).toBeGreaterThanOrEqual(0);
          expect(rect.x + rect.width).toBeLessThanOrEqual(size.width + 0.01);
        }
      });
    }
  }

  describe("the in-progress games list", () => {
    const sizes = [
      ...SIZES,
      { width: 1024, height: 768 },
      { width: 360, height: 740 },
      { width: 375, height: 667 },
      { width: 768, height: 1024 },
    ];
    for (const size of sizes) {
      for (const update of [false, true]) {
        for (const games of [1, 2, 6]) {
          test(`fits without overlap at ${size.width}x${size.height}, update=${update}, games=${games}`, () => {
            const layout = titleMenuLayout({ ...size, continuable: true, update, games, civilWar: true, quit: true });
            const rects = titleMenuLayoutRects(layout);
            expect(layout.gamesPanel === null || layout.gamesRow === null).toBe(true);
            expect(layout.gamesPanel !== null || layout.gamesRow !== null).toBe(true);
            for (let i = 0; i < rects.length; i++) {
              for (let j = i + 1; j < rects.length; j++) expect(rectsOverlap(rects[i]!, rects[j]!)).toBe(false);
            }
            for (const rect of rects) {
              expect(rect.x).toBeGreaterThanOrEqual(0);
              expect(rect.y).toBeGreaterThanOrEqual(0);
              expect(rect.x + rect.width).toBeLessThanOrEqual(size.width + 0.01);
            }
          });
        }
      }
    }

    test("a games row or panel never pushes a menu that fits off the bottom of the screen", () => {
      for (const size of sizes) {
        for (const update of [false, true]) {
          for (const civilWar of [false, true]) {
            const input = { ...size, continuable: true, update, civilWar };
            const bottomOf = (games: number) =>
              Math.max(...titleMenuLayoutRects(titleMenuLayout({ ...input, games })).map((r) => r.y + r.height));
            if (bottomOf(0) > size.height) continue;
            // Known limit: a 667-high phone with the update banner, Civil War! and Continue is full at the compact
            // floor already, so a games row has nowhere to go (the Title is not scrollable).
            if (size.height < 700 && update && civilWar) continue;
            for (const games of [1, 2, 6]) {
              expect(
                bottomOf(games),
                `${size.width}x${size.height} update=${update} civilWar=${civilWar} games=${games}`,
              ).toBeLessThanOrEqual(size.height + 0.01);
            }
          }
        }
      }
    });

    test("a short phone with the update banner, Continue and the games row still fits (375x667, 360x740)", () => {
      for (const size of [
        { width: 375, height: 667 },
        { width: 360, height: 740 },
      ]) {
        const layout = titleMenuLayout({ ...size, continuable: true, update: true, games: 2 });
        for (const rect of titleMenuLayoutRects(layout))
          expect(rect.y + rect.height).toBeLessThanOrEqual(size.height + 0.01);
        expect(layout.gamesRow).not.toBeNull();
        // The one-row banner keeps a single button there.
        expect(updateBannerActionCount(layout.updateBanner!, 2)).toBeLessThanOrEqual(2);
      }
      const short = titleMenuLayout({ width: 375, height: 667, continuable: true, update: true, games: 2 });
      expect(updateBannerActionCount(short.updateBanner!, 2)).toBe(1);
      const parts = updateBannerParts(short.updateBanner!, 1);
      expect(parts.buttons).toHaveLength(1);
    });

    test("a split screen's panel stays on the screen", () => {
      for (const size of sizes) {
        const { gamesPanel } = titleMenuLayout({ ...size, continuable: true, games: 3 });
        if (gamesPanel) {
          expect(gamesPanel.y).toBeGreaterThanOrEqual(0);
          expect(gamesPanel.y + gamesPanel.height).toBeLessThanOrEqual(size.height);
        }
      }
    });

    test("a split screen with room puts the panel in the art panel, its list inside it; a phone gets a menu row", () => {
      const desktop = titleMenuLayout({ width: 1280, height: 800, continuable: true, games: 3 });
      expect(desktop.gamesRow).toBeNull();
      expect(desktop.gamesPanel).not.toBeNull();
      expect(desktop.gamesPanel!.x + desktop.gamesPanel!.width).toBeLessThanOrEqual(desktop.artPanel!.width);
      const list = desktop.gamesPanelList!;
      expect(list.y).toBeGreaterThan(desktop.gamesPanel!.y);
      expect(list.y + list.height).toBeLessThanOrEqual(desktop.gamesPanel!.y + desktop.gamesPanel!.height);
      expect(list.height).toBeGreaterThanOrEqual(3 * 68);
      const phone = titleMenuLayout({ width: 375, height: 812, continuable: true, games: 3 });
      expect(phone.gamesPanel).toBeNull();
      expect(phone.gamesRow).not.toBeNull();
      expect(phone.gamesRow!.y).toBeGreaterThanOrEqual(phone.continueRow!.y + phone.continueRow!.height);
    });

    test("no games to list draw neither", () => {
      for (const games of [undefined, 0]) {
        const layout = titleMenuLayout({
          width: 1280,
          height: 800,
          continuable: true,
          ...(games === undefined ? {} : { games }),
        });
        expect(layout.gamesPanel).toBeNull();
        expect(layout.gamesRow).toBeNull();
      }
    });
  });

  test("desktop and tablet split into an ink art panel and a paper menu panel, divided by a thin red rule", () => {
    const layout = titleMenuLayout({ width: 1280, height: 1000, continuable: false });
    expect(layout.split).toBe(true);
    expect(layout.artPanel).not.toBeNull();
    expect(layout.divider).not.toBeNull();
    expect(layout.artPanel!.x).toBe(0);
    expect(layout.divider!.x).toBe(layout.artPanel!.width);
    expect(layout.menuPanel.x).toBeGreaterThan(layout.divider!.x);
  });

  test("phone has no split — the menu panel is the whole screen", () => {
    const layout = titleMenuLayout({ width: 390, height: 844, continuable: false });
    expect(layout.split).toBe(false);
    expect(layout.artPanel).toBeNull();
    expect(layout.divider).toBeNull();
    expect(layout.menuPanel).toEqual({ x: 0, y: 0, width: 390, height: 844 });
  });

  test("Civil War! is one more row directly under Campaign, absent (null) until the box is open", () => {
    const closed = titleMenuLayout({ width: 1280, height: 1000, continuable: false });
    const open = titleMenuLayout({ width: 1280, height: 1000, continuable: false, civilWar: true });
    expect(closed.civilWar).toBeNull();
    expect(open.civilWar).not.toBeNull();
    expect(open.civilWar!.y).toBeGreaterThan(open.campaign.y + open.campaign.height - 1);
    expect(open.extras.y).toBeGreaterThan(open.civilWar!.y);
    expect(titleMenuLayoutRects(closed)).toHaveLength(titleMenuLayoutRects(open).length - 1);
  });

  test("Quit to desktop is one more row under Settings in the desktop app, absent (null) elsewhere", () => {
    const web = titleMenuLayout({ width: 1440, height: 900, continuable: false });
    const desktop = titleMenuLayout({ width: 1440, height: 900, continuable: false, quit: true });
    expect(web.quit).toBeNull();
    expect(desktop.quit!.y).toBeGreaterThan(desktop.settings.y + desktop.settings.height - 1);
    expect(desktop.footer.y).toBeGreaterThanOrEqual(desktop.quit!.y + desktop.quit!.height);
  });

  for (const size of [
    { width: 390, height: 844 },
    { width: 360, height: 800 },
    { width: 360, height: 740 },
    { width: 1024, height: 768 },
    { width: 1440, height: 900 },
  ]) {
    test(`every row (Continue, Civil War!, the update banner) shows without overlap, on screen, at ${size.width}x${size.height}`, () => {
      const layout = titleMenuLayout({ ...size, continuable: true, civilWar: true, update: true });
      const rects = titleMenuLayoutRects(layout);
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) expect(rectsOverlap(rects[i]!, rects[j]!)).toBe(false);
      }
      for (const rect of rects) {
        expect(rect.x).toBeGreaterThanOrEqual(0);
        expect(rect.y).toBeGreaterThanOrEqual(0);
        expect(rect.x + rect.width).toBeLessThanOrEqual(size.width);
        expect(rect.y + rect.height).toBeLessThanOrEqual(size.height);
      }
      expect(layout.footer.y + layout.footer.height).toBeLessThanOrEqual(size.height);
    });
  }

  test("continuable adds exactly one row above New game", () => {
    const without = titleMenuLayout({ width: 1280, height: 1000, continuable: false });
    const withContinue = titleMenuLayout({ width: 1280, height: 1000, continuable: true });
    expect(without.continueRow).toBeNull();
    expect(withContinue.continueRow).not.toBeNull();
    expect(withContinue.newGame.y).toBeGreaterThan(without.newGame.y);
  });

  test("no update, no banner, and the menu is where it always was", () => {
    const plain = titleMenuLayout({ width: 1280, height: 1000, continuable: true });
    expect(plain.updateBanner).toBeNull();
    expect(titleMenuLayout({ width: 1280, height: 1000, continuable: true, update: false })).toEqual(plain);
  });

  test("on a split screen the update banner sits in the art panel and moves nothing", () => {
    const plain = titleMenuLayout({ width: 1280, height: 1000, continuable: true });
    const offered = titleMenuLayout({ width: 1280, height: 1000, continuable: true, update: true });
    const banner = offered.updateBanner!;
    expect(banner.x).toBeGreaterThanOrEqual(0);
    expect(banner.x + banner.width).toBeLessThanOrEqual(offered.artPanel!.width);
    expect({ ...offered, updateBanner: null }).toEqual(plain);
  });

  test("on a phone the update banner heads the column, above everything else, with no overlap", () => {
    for (const continuable of [false, true]) {
      const plain = titleMenuLayout({ width: 390, height: 844, continuable });
      const offered = titleMenuLayout({ width: 390, height: 844, continuable, update: true });
      const banner = offered.updateBanner!;
      expect(banner.x).toBe(offered.left);
      expect(banner.width).toBe(offered.column);
      expect(banner.y + banner.height).toBeLessThanOrEqual(offered.eyebrow.y);
      expect(offered.newGame.y).toBeGreaterThan(plain.newGame.y);
      expect(offered.footer.y + 20).toBeLessThanOrEqual(844);
      const rects = titleMenuLayoutRects(offered);
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) expect(rectsOverlap(rects[i]!, rects[j]!)).toBe(false);
      }
    }
  });

  test("the banner's buttons are touch-sized, inside it, and leave the text its room", () => {
    // 1280 fits one row; a phone and a portrait tablet's art panel stack the buttons under the text.
    for (const [width, height] of [
      [390, 844],
      [360, 780],
      [768, 1024],
      [1024, 768],
      [1280, 1000],
    ] as const) {
      const banner = titleMenuLayout({ width, height, continuable: false, update: true }).updateBanner!;
      for (const actions of [1, 2]) {
        const parts = updateBannerParts(banner, actions);
        expect(parts.buttons).toHaveLength(actions);
        for (const button of parts.buttons) {
          expect(button.height).toBeGreaterThanOrEqual(44);
          expect(button.x).toBeGreaterThanOrEqual(banner.x);
          expect(button.x + button.width).toBeLessThanOrEqual(banner.x + banner.width);
          expect(button.y + button.height).toBeLessThanOrEqual(banner.y + banner.height);
        }
        if (actions === 2) expect(rectsOverlap(parts.buttons[0]!, parts.buttons[1]!)).toBe(false);
        // The close button is touch-sized, inside the banner, and clear of the text and every action button.
        const close = parts.dismiss;
        expect(close.width).toBeGreaterThanOrEqual(44);
        expect(close.height).toBeGreaterThanOrEqual(44);
        expect(close.x).toBeGreaterThanOrEqual(banner.x);
        expect(close.x + close.width).toBeLessThanOrEqual(banner.x + banner.width);
        expect(close.y).toBeGreaterThanOrEqual(banner.y);
        expect(close.y + close.height).toBeLessThanOrEqual(banner.y + banner.height);
        for (const button of parts.buttons) expect(rectsOverlap(close, button), `${width}`).toBe(false);
        expect(parts.text.x + parts.textWidth).toBeLessThanOrEqual(close.x);
        // The two lines of text (32px tall, 116 wide at most) clear every button.
        const text = { x: parts.text.x, y: parts.text.y, width: 116, height: 32 };
        expect(parts.textWidth).toBeGreaterThanOrEqual(text.width);
        expect(text.x + text.width).toBeLessThanOrEqual(banner.x + banner.width);
        for (const button of parts.buttons) expect(rectsOverlap(text, button)).toBe(false);
      }
    }
  });
});

describe("the rank badge", () => {
  for (const size of [
    { width: 360, height: 740 },
    { width: 375, height: 667 },
    { width: 390, height: 844 },
    { width: 1024, height: 768 },
    { width: 1440, height: 900 },
  ]) {
    test(`sits on screen and clear of the report and music buttons at ${size.width}x${size.height}`, () => {
      const layout = titleMenuLayout({ ...size, continuable: true, civilWar: true, update: true, quit: true });
      const badge = layout.rankBadge;
      expect(badge.x).toBeGreaterThanOrEqual(0);
      expect(badge.y).toBeGreaterThanOrEqual(0);
      expect(badge.x + badge.width).toBeLessThanOrEqual(size.width);
      expect(badge.y + badge.height).toBeLessThanOrEqual(size.height);
      // The report and music buttons sit level with the eyebrow, at the column's right edge.
      const report = 40;
      const reportRect = {
        x: layout.left + layout.column - report,
        y: Math.max(8, layout.eyebrow.y + 8 - report / 2),
        width: report,
        height: report,
      };
      const musicRect = { ...reportRect, x: reportRect.x - 8 - report };
      expect(rectsOverlap(badge, reportRect)).toBe(false);
      expect(rectsOverlap(badge, musicRect)).toBe(false);
    });
  }
});

describe("the phone rank badge", () => {
  test("sits above the footer on an iPhone SE (375x667) with the usual rows", () => {
    const layout = titleMenuLayout({ width: 375, height: 667, continuable: false });
    expect(layout.rankBadge.y).toBeGreaterThan(layout.settings.y + layout.settings.height - 1);
    expect(layout.rankBadge.y + layout.rankBadge.height).toBeLessThanOrEqual(layout.footer.y);
    expect(layout.footer.y + layout.footer.height).toBeLessThanOrEqual(667);
  });
});

describe("the temporary notice bar", () => {
  const sizes = [
    { width: 360, height: 640 },
    { width: 360, height: 740 },
    { width: 390, height: 844 },
    { width: 1024, height: 600 },
    { width: 844, height: 390 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1280, height: 800 },
    { width: 1920, height: 1080 },
  ];
  for (const size of sizes) {
    test(`spans the top and pushes everything under it at ${size.width}x${size.height}`, () => {
      const plain = titleMenuLayout({ ...size, continuable: true, games: 2 });
      const layout = titleMenuLayout({ ...size, continuable: true, games: 2, noticeBar: true });
      const bar = layout.noticeBar ?? { x: 0, y: 0, width: size.width, height: 0 };
      expect(bar).toMatchObject({ x: 0, y: 0, width: size.width });
      // No bar at all only where no height of it fits (a 360x640 phone at its compact floor).
      expect([0, ...NOTICE_BAR_HEIGHTS]).toContain(bar.height);
      expect(plain.noticeBar).toBeNull();
      const rects = titleMenuLayoutRects(layout);
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) expect(rectsOverlap(rects[i]!, rects[j]!)).toBe(false);
      }
      // The panels start under it too, and the report and music buttons (level with the eyebrow) clear it.
      if (layout.artPanel) expect(layout.artPanel.y).toBe(bar.height);
      expect(layout.menuPanel.y).toBe(bar.height);
      expect(layout.eyebrow.y + 8 - 22).toBeGreaterThanOrEqual(bar.height);
      // A menu that fitted without the bar still fits with it.
      const bottom = (l: typeof layout) => Math.max(...titleMenuLayoutRects(l).map((r) => r.y + r.height));
      if (bottom(plain) <= size.height) expect(bottom(layout)).toBeLessThanOrEqual(size.height + 0.01);
    });
  }

  test("a tall screen gets the full bar", () => {
    expect(titleMenuLayout({ width: 1280, height: 800, continuable: true, noticeBar: true }).noticeBar!.height).toBe(
      NOTICE_BAR_HEIGHT,
    );
  });

  test("a short screen whose menu fits without the bar still fits with it (1024x600, 360x640 with games)", () => {
    // 1024x600 slims the bar; the 360x640 phone with every row has no room for one and drops it.
    expect(
      titleMenuLayout({ width: 1024, height: 600, continuable: true, civilWar: true, noticeBar: true }).noticeBar,
    ).not.toBeNull();
    expect(
      titleMenuLayout({ width: 360, height: 640, continuable: true, civilWar: true, games: 2, noticeBar: true })
        .noticeBar,
    ).toBeNull();
    for (const input of [
      { width: 1024, height: 600, continuable: true, civilWar: true },
      { width: 1024, height: 600, continuable: true, civilWar: true, games: 2 },
      { width: 360, height: 640, continuable: true, civilWar: true, games: 2 },
    ]) {
      const bottom = (l: ReturnType<typeof titleMenuLayout>) =>
        Math.max(...titleMenuLayoutRects(l).map((r) => r.y + r.height));
      if (bottom(titleMenuLayout(input)) > input.height) continue;
      expect(bottom(titleMenuLayout({ ...input, noticeBar: true })), JSON.stringify(input)).toBeLessThanOrEqual(
        input.height + 0.01,
      );
    }
  });
});
