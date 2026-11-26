import { afterEach, describe, expect, it } from "vitest";
import "./mc-game-log.js";
import type { GameLogLine } from "./McGameLog.js";

const pointer = (type: string, x = 10, y = 10): PointerEvent =>
  new PointerEvent(type, { bubbles: true, composed: true, clientX: x, clientY: y, pointerId: 1, button: 0 });

const line = (n: number, extra: Partial<GameLogLine> = {}): GameLogLine => ({
  id: `l${n}`,
  ref: `R1.${n}`,
  text: `Line ${n}`,
  voice: "player",
  tags: [],
  ...extra,
});

const lines = (count: number): GameLogLine[] => Array.from({ length: count }, (_, index) => line(index + 1));

type Log = HTMLElementTagNameMap["mc-game-log"];

/** happy-dom does no layout: the list is 100px tall over 1000px of lines of 100px, each `offsetTop` as stacked. */
function stub(log: Log, state: { top: number; height: number; view: number }): void {
  const scroller = log.scroller!;
  Object.defineProperty(scroller, "scrollHeight", { configurable: true, get: () => state.height });
  Object.defineProperty(scroller, "clientHeight", { configurable: true, get: () => state.view });
  let top = state.top;
  Object.defineProperty(scroller, "scrollTop", {
    configurable: true,
    get: () => top,
    set: (v: number) => {
      top = v;
    },
  });
  [...scroller.querySelectorAll<HTMLElement>(".line")].forEach((el, index) =>
    Object.defineProperty(el, "offsetTop", { configurable: true, get: () => index * 100 }),
  );
}

async function mounted(rows: readonly GameLogLine[] = lines(10)): Promise<Log> {
  const log = document.createElement("mc-game-log");
  log.heading = "GAME LOG";
  log.closeLabel = "Close";
  log.emptyText = "Nothing yet.";
  log.newerLabel = "▼ {count} newer · latest";
  log.latestLabel = "▼ latest";
  log.statusNames = { stunned: "Stunned", confused: "Confused", tough: "Tough" };
  log.lines = rows;
  document.body.append(log);
  await log.updateComplete;
  return log;
}

const chip = (log: Log): HTMLElement | null => log.shadowRoot!.querySelector(".newer");

describe("mc-game-log", () => {
  it("draws the title, every line with its ref and voice, and the status chips named and struck once spent", async () => {
    const log = await mounted([
      line(1, { voice: "villain" }),
      line(2, {
        tags: [
          { status: "stunned", spent: false },
          { status: "confused", spent: true },
        ],
      }),
    ]);
    const root = log.shadowRoot!;
    expect(root.querySelector("h2")?.textContent).toBe("GAME LOG");
    const rows = [...root.querySelectorAll<HTMLElement>(".line")];
    expect(rows.map((row) => row.querySelector(".ref")?.textContent)).toEqual(["R1.1", "R1.2"]);
    expect(rows[0]!.dataset.voice).toBe("villain");
    const tags = [...rows[1]!.querySelectorAll<HTMLElement>(".tag")];
    expect(tags.map((tag) => tag.textContent?.trim())).toEqual(["Stunned", "Confused"]);
    expect(tags.map((tag) => tag.hasAttribute("data-spent"))).toEqual([false, true]);
    log.remove();
  });

  it("says so when the log is empty", async () => {
    const log = await mounted([]);
    expect(log.shadowRoot!.querySelector(".empty")?.textContent).toBe("Nothing yet.");
    expect(log.shadowRoot!.querySelector(".line")).toBeNull();
    log.remove();
  });

  it("follows the newest line while the reader is at the bottom, with no chip", async () => {
    const log = await mounted();
    stub(log, { top: 900, height: 1000, view: 100 });
    log.lines = lines(11);
    await log.updateComplete;
    expect(log.following).toBe(true);
    expect(log.scroller!.scrollTop).toBe(1000);
    expect(chip(log)).toBeNull();
    log.remove();
  });

  it("shows how many lines are below once scrolled up, and stays put when a line arrives", async () => {
    const log = await mounted();
    stub(log, { top: 0, height: 1000, view: 250 });
    log.scroller!.dispatchEvent(new Event("scroll"));
    await log.updateComplete;
    expect(log.following).toBe(false);
    // Lines start at 0, 100, ..., 900; the view ends at 250, so the lines from 300 on are below it.
    expect(chip(log)?.textContent?.trim()).toBe("▼ 7 newer · latest");
    log.lines = lines(11);
    await log.updateComplete;
    expect(log.scroller!.scrollTop, "a new line does not drag a reader back").toBe(0);
    expect(log.following).toBe(false);
    log.remove();
  });

  it("a tap on the chip goes back to the newest line and follows again", async () => {
    const log = await mounted();
    stub(log, { top: 0, height: 1000, view: 250 });
    log.scroller!.dispatchEvent(new Event("scroll"));
    await log.updateComplete;
    const button = chip(log)!;
    button.dispatchEvent(pointer("pointerdown"));
    button.dispatchEvent(pointer("pointerup"));
    await log.updateComplete;
    expect(log.scroller!.scrollTop).toBe(1000);
    expect(log.following).toBe(true);
    expect(chip(log)).toBeNull();
    log.remove();
  });

  it("does not press the chip or the close button when the finger lifts over them at the end of a swipe", async () => {
    const log = await mounted();
    stub(log, { top: 0, height: 1000, view: 250 });
    log.scroller!.dispatchEvent(new Event("scroll"));
    await log.updateComplete;
    const activations: string[] = [];
    log.addEventListener("mc-activate", (event) => activations.push((event as CustomEvent).detail.key));
    const button = chip(log)!;
    // A swipe that began elsewhere: only the lift lands here.
    button.dispatchEvent(pointer("pointerup"));
    // A swipe that began here, then the list scrolled under the finger.
    button.dispatchEvent(pointer("pointerdown"));
    window.dispatchEvent(new Event("scroll"));
    button.dispatchEvent(pointer("pointerup"));
    const close = log.closeButton!;
    close.dispatchEvent(pointer("pointerup"));
    close.dispatchEvent(pointer("pointerdown"));
    window.dispatchEvent(new Event("scroll"));
    close.dispatchEvent(pointer("pointerup"));
    await log.updateComplete;
    expect(log.scroller!.scrollTop, "the chip did not scroll the list").toBe(0);
    expect(activations).toEqual([]);
    log.remove();
  });

  it("makes the chip a native button that Enter, Space or a synthesized click activates with no pointer", async () => {
    for (const press of [
      (b: HTMLElement) =>
        b.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })),
      (b: HTMLElement) => b.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true })),
      (b: HTMLElement) => b.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 })),
    ]) {
      const log = await mounted();
      stub(log, { top: 0, height: 1000, view: 250 });
      log.scroller!.dispatchEvent(new Event("scroll"));
      await log.updateComplete;
      const button = chip(log)!;
      expect(button.tagName).toBe("BUTTON");
      expect(button.getAttribute("type")).toBe("button");
      press(button);
      await log.updateComplete;
      expect(log.scroller!.scrollTop).toBe(1000);
      expect(log.following).toBe(true);
      expect(chip(log)).toBeNull();
      log.remove();
    }
  });

  it("does not take the click that follows a pointer tap as a second activation", async () => {
    const log = await mounted();
    stub(log, { top: 0, height: 1000, view: 250 });
    log.scroller!.dispatchEvent(new Event("scroll"));
    await log.updateComplete;
    const button = chip(log)!;
    button.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    await log.updateComplete;
    expect(log.scroller!.scrollTop, "a pointer click is the tap's job").toBe(0);
    log.remove();
  });

  describe("resizes", () => {
    type Callback = () => void;
    const made: { callback: Callback; targets: Element[] }[] = [];
    const original = globalThis.ResizeObserver;
    afterEach(() => {
      globalThis.ResizeObserver = original;
      made.length = 0;
    });
    const install = (): void => {
      globalThis.ResizeObserver = class {
        readonly entry: { callback: Callback; targets: Element[] };
        constructor(callback: Callback) {
          this.entry = { callback, targets: [] };
          made.push(this.entry);
        }
        observe(target: Element): void {
          if (!this.entry.targets.includes(target)) this.entry.targets.push(target);
        }
        unobserve(): void {}
        disconnect(): void {}
      } as unknown as typeof ResizeObserver;
    };

    it("watches the scroller as well as the list, so a height-only change is seen", async () => {
      install();
      const log = await mounted();
      const targets = made.flatMap((entry) => entry.targets);
      expect(targets).toContain(log.scroller);
      expect(targets).toContain(log.shadowRoot!.querySelector(".list"));
      log.remove();
    });

    it("stays at the newest line when the viewport shrinks while following", async () => {
      install();
      const log = await mounted();
      const state = { top: 900, height: 1000, view: 100 };
      stub(log, state);
      log.scroller!.dispatchEvent(new Event("scroll"));
      expect(log.following).toBe(true);
      // The viewport gets 60px shorter: scrollTop no longer reaches the bottom.
      state.view = 40;
      made.forEach((entry) => entry.callback());
      await log.updateComplete;
      expect(log.scroller!.scrollTop).toBe(1000);
      expect(log.following).toBe(true);
      log.remove();
    });

    it("remeasures reading back when the chip first appears and the list gets shorter", async () => {
      install();
      const log = await mounted();
      const state = { top: 0, height: 1000, view: 250 };
      stub(log, state);
      log.scroller!.dispatchEvent(new Event("scroll"));
      await log.updateComplete;
      expect(chip(log)?.textContent?.trim()).toBe("▼ 7 newer · latest");
      // The chip's 38px came out of the scroller: one more line is below the view now.
      state.view = 150;
      made.forEach((entry) => entry.callback());
      await log.updateComplete;
      expect(log.following, "reading back stays reading back").toBe(false);
      expect(log.scroller!.scrollTop).toBe(0);
      expect(chip(log)?.textContent?.trim()).toBe("▼ 8 newer · latest");
      log.remove();
    });
  });

  it("raises mc-activate with the key close on a tap of the close button", async () => {
    const log = await mounted();
    const keys: string[] = [];
    log.addEventListener("mc-activate", (event) => keys.push((event as CustomEvent).detail.key));
    const close = log.closeButton!;
    close.dispatchEvent(pointer("pointerdown"));
    close.dispatchEvent(pointer("pointerup"));
    expect(keys).toEqual(["close"]);
    log.remove();
  });

  describe("keeping the reader's place", () => {
    const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetTop");
    afterEach(() => {
      if (original) Object.defineProperty(HTMLElement.prototype, "offsetTop", original);
    });

    it("puts the first line in view back where it was when old lines are trimmed and new ones arrive", async () => {
      Object.defineProperty(HTMLElement.prototype, "offsetTop", {
        configurable: true,
        get(this: HTMLElement) {
          // Stacked 100px apart in the order the DOM holds them right now.
          return this.classList.contains("line") ? [...this.parentElement!.children].indexOf(this) * 100 : 0;
        },
      });
      const first = lines(10);
      const log = await mounted(first);
      const scroller = log.scroller!;
      Object.defineProperty(scroller, "scrollHeight", { configurable: true, get: () => 1000 });
      Object.defineProperty(scroller, "clientHeight", { configurable: true, get: () => 250 });
      let top = 340;
      Object.defineProperty(scroller, "scrollTop", {
        configurable: true,
        get: () => top,
        set: (v: number) => {
          top = v;
        },
      });
      scroller.dispatchEvent(new Event("scroll"));
      await log.updateComplete;
      expect(log.following).toBe(false);
      // The first line in view is l5 (at 400, below the top edge by 60). Two lines go from the top, two come at the foot.
      const next = lines(12).slice(2);
      log.lines = next;
      await log.updateComplete;
      // l5 is now the third line, at 200: the list scrolls up by the 200 that went, so l5 is still 60 below the top.
      expect(scroller.scrollTop).toBe(140);
      expect(log.following).toBe(false);
      log.remove();
    });

    it("lands on the first surviving line when the retention limit trims the anchor", async () => {
      Object.defineProperty(HTMLElement.prototype, "offsetTop", {
        configurable: true,
        get(this: HTMLElement) {
          return this.classList.contains("line") ? [...this.parentElement!.children].indexOf(this) * 100 : 0;
        },
      });
      const log = await mounted(lines(10));
      const scroller = log.scroller!;
      Object.defineProperty(scroller, "scrollHeight", { configurable: true, get: () => 1000 });
      Object.defineProperty(scroller, "clientHeight", { configurable: true, get: () => 250 });
      let top = 0;
      Object.defineProperty(scroller, "scrollTop", {
        configurable: true,
        get: () => top,
        set: (v: number) => {
          top = v;
        },
      });
      scroller.dispatchEvent(new Event("scroll"));
      await log.updateComplete;
      expect(log.following).toBe(false);
      // The anchor is l1; l1 to l4 are trimmed as four lines arrive, so l5 (now first) is the nearest survivor.
      log.lines = lines(14).slice(4);
      await log.updateComplete;
      expect(scroller.scrollTop).toBe(0);
      expect(scroller.querySelector<HTMLElement>(".line")?.dataset.id).toBe("l5");
      // Everything trimmed: the first line of the new list.
      log.lines = lines(40).slice(30);
      await log.updateComplete;
      expect(scroller.scrollTop).toBe(0);
      log.remove();
    });
  });
});
