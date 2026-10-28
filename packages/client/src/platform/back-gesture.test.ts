import { describe, expect, it } from "vitest";
import { SCENES } from "../scenes/keys.js";
import {
  backActionFor,
  backSourceFor,
  createBackGate,
  hasBackGesturePlugin,
  isPlatformBack,
  pressEscape,
  trapHistoryBack,
  type BackAction,
} from "./back-gesture.js";

describe("backActionFor", () => {
  it("leaves from Title with only the top bar's chrome over it", () => {
    expect(
      backActionFor(
        [SCENES.title, SCENES.music, SCENES.musicButton, SCENES.reportButton, SCENES.achievementToast],
        false,
      ),
    ).toBe("leave");
    expect(backActionFor([SCENES.boot], false)).toBe("leave");
    expect(backActionFor([], false)).toBe("leave");
  });

  it("is Escape for any other screen, a sheet over Title, or the opened achievement list", () => {
    expect(backActionFor([SCENES.trophyRoom, SCENES.musicButton], false)).toBe("escape");
    expect(backActionFor([SCENES.title, SCENES.settings], false)).toBe("escape");
    expect(backActionFor([SCENES.board, SCENES.music], false)).toBe("escape");
    expect(backActionFor([SCENES.title, SCENES.musicPlayer], false)).toBe("escape");
    expect(backActionFor([SCENES.title, SCENES.achievementToast], true)).toBe("escape");
  });
});

describe("createBackGate", () => {
  it("takes one press and drops its echo inside the window", () => {
    const gate = createBackGate(250);
    expect(gate(1000)).toBe(true);
    expect(gate(1100)).toBe(false);
    expect(gate(1300)).toBe(true);
  });
});

describe("backSourceFor", () => {
  it("uses the plugin on Android, history in a browser or the desktop app, and nothing on iOS", () => {
    expect(backSourceFor("capacitor", "Mozilla/5.0 (Linux; Android 15; Pixel 9)")).toBe("android");
    expect(backSourceFor("capacitor", "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)")).toBeNull();
    expect(backSourceFor("web", "Mozilla/5.0 (Linux; Android 15; Pixel 9)")).toBe("history");
    expect(backSourceFor("tauri", "Windows NT 10.0")).toBe("history");
  });
});

describe("hasBackGesturePlugin", () => {
  it("reads the native bridge's plugin list", () => {
    expect(hasBackGesturePlugin({ Capacitor: { PluginHeaders: [{ name: "BackGesture" }] } })).toBe(true);
    expect(hasBackGesturePlugin({ Capacitor: { PluginHeaders: [{ name: "PowerSaving" }] } })).toBe(false);
    expect(hasBackGesturePlugin({})).toBe(false);
  });
});

describe("pressEscape", () => {
  it("sends a marked Escape down and up with Phaser's key code, after letting a text field go", () => {
    // Node has Event but no KeyboardEvent: enough of one for the fields pressEscape sets.
    const had = "KeyboardEvent" in globalThis;
    if (!had) {
      (globalThis as Record<string, unknown>).KeyboardEvent = class extends Event {
        readonly code: string;
        constructor(type: string, init: EventInit & { code?: string }) {
          super(type, init);
          this.code = init.code ?? "";
        }
      };
    }
    try {
      const target = new EventTarget();
      const seen: { type: string; code: string; keyCode: number; back: boolean }[] = [];
      for (const type of ["keydown", "keyup"]) {
        target.addEventListener(type, (event) => {
          const key = event as Event & { code: string; keyCode: number };
          seen.push({ type: key.type, code: key.code, keyCode: key.keyCode, back: isPlatformBack(event) });
        });
      }
      let blurred = false;
      pressEscape(target, { activeElement: { tagName: "INPUT", blur: () => (blurred = true) } } as unknown as Document);
      expect(blurred).toBe(true);
      expect(seen).toEqual([
        { type: "keydown", code: "Escape", keyCode: 27, back: true },
        { type: "keyup", code: "Escape", keyCode: 27, back: true },
      ]);
      expect(isPlatformBack(new Event("keydown"))).toBe(false);
    } finally {
      if (!had) delete (globalThis as Record<string, unknown>).KeyboardEvent;
    }
  });
});

/** A browser history with listeners, enough for `trapHistoryBack`. */
function fakeWindow(): {
  win: Parameters<typeof trapHistoryBack>[1];
  entries: unknown[];
  index: () => number;
  pressBack: () => void;
  tap: () => void;
} {
  const entries: unknown[] = [null];
  let at = 0;
  const listeners = new Map<string, Set<() => void>>();
  const emit = (type: string): void => {
    for (const listener of [...(listeners.get(type) ?? [])]) listener();
  };
  const goBack = (): void => {
    if (at === 0) return;
    at -= 1;
    emit("popstate");
  };
  const win = {
    history: {
      get state() {
        return entries[at];
      },
      pushState(data: unknown) {
        entries.splice(at + 1, entries.length, data);
        at += 1;
      },
      back: goBack,
    },
    addEventListener(type: string, listener: () => void) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(listener);
    },
    removeEventListener(type: string, listener: () => void) {
      listeners.get(type)?.delete(listener);
    },
  } as unknown as Parameters<typeof trapHistoryBack>[1];
  return { win, entries, index: () => at, pressBack: goBack, tap: () => emit("pointerdown") };
}

describe("trapHistoryBack", () => {
  it("keeps the page on Back and puts its own entry back each time", () => {
    const page = fakeWindow();
    const backs: BackAction[] = [];
    trapHistoryBack(() => {
      backs.push("escape");
      return "escape";
    }, page.win);
    expect(page.index()).toBe(1);
    page.pressBack();
    page.pressBack();
    expect(backs).toEqual(["escape", "escape"]);
    expect(page.index()).toBe(1);
  });

  it("steps out of the game on a leave, and re-arms on the next tap when there was nowhere to go", () => {
    const page = fakeWindow();
    trapHistoryBack(() => "leave", page.win);
    page.pressBack();
    expect(page.index()).toBe(0);
    page.tap();
    expect(page.index()).toBe(1);
  });

  it("stops listening when stopped", () => {
    const page = fakeWindow();
    let backs = 0;
    const stop = trapHistoryBack(() => {
      backs += 1;
      return "escape";
    }, page.win);
    stop();
    page.pressBack();
    expect(backs).toBe(0);
  });
});
