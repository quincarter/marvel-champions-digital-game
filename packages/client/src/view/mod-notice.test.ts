import { describe, expect, test } from "vitest";
import { MOD_NOTICE_SEEN_KEY, modNoticeSeen, rememberModNoticeSeen } from "../platform/mod-notice-seen.js";
import {
  MOD_NOTICE_BUTTONS,
  MOD_NOTICE_LINES,
  modNoticeControlLabelOf,
  modNoticeLayoutOf,
  modNoticeOutcomeOf,
  showNoticeBeforeInstall,
  showNoticeOnOpen,
} from "./mod-notice.js";

function memory() {
  const store = new Map<string, string>();
  return {
    store,
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  };
}

describe("mod notice", () => {
  test("shows on first open, then never again once remembered", () => {
    const storage = memory();
    expect(showNoticeOnOpen(modNoticeSeen(storage))).toBe(true);
    rememberModNoticeSeen(storage);
    expect(storage.store.get(MOD_NOTICE_SEEN_KEY)).toBe("1");
    expect(showNoticeOnOpen(modNoticeSeen(storage))).toBe(false);
    expect(showNoticeBeforeInstall(modNoticeSeen(storage))).toBe(false);
  });

  test("shows before the first install when it was never seen", () => {
    expect(showNoticeBeforeInstall(false)).toBe(true);
  });

  test("a missing or throwing store reads as unseen and never throws", () => {
    expect(modNoticeSeen(null)).toBe(false);
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("full");
      },
    };
    expect(modNoticeSeen(broken)).toBe(false);
    expect(() => rememberModNoticeSeen(broken)).not.toThrow();
  });

  test("the reopen control is a bang on a phone and words elsewhere", () => {
    expect(modNoticeControlLabelOf(true)).toBe("!");
    expect(modNoticeControlLabelOf(false)).toBe("About mods");
  });

  test("the report answer opens the report tool; both answers are remembered", () => {
    expect(modNoticeOutcomeOf("report")).toEqual({ remember: true, openReport: true });
    expect(modNoticeOutcomeOf("close")).toEqual({ remember: true, openReport: false });
    expect(MOD_NOTICE_BUTTONS.map((b) => b.label)).toEqual(["Report a problem", "Got it"]);
  });

  test("carries every point of the warning", () => {
    const [deadpool, spidey] = MOD_NOTICE_LINES;
    expect(deadpool.text).toMatch(/risk/);
    expect(deadpool.text).toMatch(/community/);
    expect(deadpool.text).toMatch(/repo owner vets every single one/);
    expect(spidey.text).toMatch(/bugs/);
    expect(spidey.text).toMatch(/patient/);
    expect(spidey.text).toMatch(/Report a problem/);
  });

  test.each([
    [375, 667, true],
    [412, 924, true],
    [768, 1024, false],
    [1024, 768, false],
    [1440, 900, false],
  ])("lays out inside %ix%i without overlap", (width, height, phone) => {
    const layout = modNoticeLayoutOf(width, height, phone);
    const rects = [...layout.speakers.flatMap((s) => [s.portrait, s.bubble]), ...layout.buttons];
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width).toBeLessThanOrEqual(width);
      expect(r.y + r.height).toBeLessThanOrEqual(height);
    }
    const [a, b] = layout.speakers;
    expect(a!.bubble.y + a!.bubble.height).toBeLessThanOrEqual(b!.bubble.y);
    expect(layout.buttons[0]!.y).toBeGreaterThanOrEqual(b!.bubble.y + b!.bubble.height);
  });
});
