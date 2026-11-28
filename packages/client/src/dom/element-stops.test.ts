// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { CardEvents } from "./card-events.js";
import { activateStop, bindStopFocus, collectStops, focusStopsOf } from "./element-stops.js";

afterEach(() => document.body.replaceChildren());

function page(): HTMLElement {
  const host = document.createElement("section");
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<button data-stop="back">Back</button>
    <div class="slot"><button data-stop="difficulty:expert">Expert</button><button data-stop="">no</button></div>`;
  const child = document.createElement("div");
  child.attachShadow({ mode: "open" }).innerHTML = `<input data-stop="seed" />`;
  root.append(child);
  document.body.append(host);
  return host;
}

describe("collectStops", () => {
  it("finds every [data-stop] in document order, through shadow roots, and skips an empty key", () => {
    expect(collectStops(page()).map((s) => s.key)).toEqual(["back", "difficulty:expert", "seed"]);
  });

  it("includes the root itself when it is a stop", () => {
    const el = document.createElement("button");
    el.dataset.stop = "deal-it-out";
    document.body.append(el);
    expect(collectStops(el).map((s) => s.key)).toEqual(["deal-it-out"]);
  });

  it("gives each stop a live rect", () => {
    const [first] = collectStops(page());
    expect(first!.rect()).toBeInstanceOf(DOMRect);
  });
});

describe("activateStop", () => {
  it("clicks a button and focuses a field", () => {
    const stops = collectStops(page());
    const click = vi.fn();
    stops[0]!.element.addEventListener("click", click);
    activateStop(stops[0]!.element);
    expect(click).toHaveBeenCalledOnce();
    const seed = stops.find((s) => s.key === "seed")!.element as HTMLInputElement;
    const focus = vi.spyOn(seed, "focus");
    activateStop(seed);
    expect(focus).toHaveBeenCalled();
  });
});

describe("focusStopsOf", () => {
  it("builds the route's stops: live game rects, activation, and an Inspect where the element has one", () => {
    const host = page();
    const inspect = vi.fn();
    (collectStops(host)[1]!.element as unknown as { inspect: () => void }).inspect = inspect;
    const toGame = (target: Element) => ({ x: target.getBoundingClientRect().x, y: 0, width: 1, height: 1 });
    const stops = focusStopsOf(host, toGame);
    expect([...stops.keys()]).toEqual(["back", "difficulty:expert", "seed"]);
    stops.get("difficulty:expert")!.inspect!();
    expect(inspect).toHaveBeenCalledOnce();
    expect(stops.get("back")!.inspect).toBeUndefined();
    expect(typeof stops.get("back")!.activate).toBe("function");
  });
});

describe("bindStopFocus", () => {
  it("tells the route which stop took focus, from inside a shadow root, and stops when undone", () => {
    const host = page();
    const keys: string[] = [];
    const undo = bindStopFocus(host, (key) => keys.push(key));
    (collectStops(host)[1]!.element as HTMLElement).dispatchEvent(
      new FocusEvent("focusin", { bubbles: true, composed: true }),
    );
    undo();
    (collectStops(host)[0]!.element as HTMLElement).dispatchEvent(
      new FocusEvent("focusin", { bubbles: true, composed: true }),
    );
    expect(keys).toEqual(["difficulty:expert"]);
  });
});

describe("CardEvents", () => {
  it("holds the hovered picture for the popover and clears it when the mouse leaves", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const events = new CardEvents({ element: host, rectOf: () => ({ x: 1, y: 2, width: 30, height: 40 }) });
    host.dispatchEvent(
      new CustomEvent("mc-card-hover", { detail: { cardId: "01094", rect: new DOMRect() }, bubbles: true }),
    );
    const [slot, found] = [...events.hovered()][0]!;
    expect(slot).toContain("01094");
    expect(found).toMatchObject({ cardId: "01094", x: 1, y: 2, through: true });
    host.dispatchEvent(new CustomEvent("mc-card-hover-end", { detail: { cardId: "01094" }, bubbles: true }));
    expect(events.hovered().size).toBe(0);
  });

  it("passes a hold's Inspect on", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const events = new CardEvents({ element: host, rectOf: () => ({ x: 0, y: 0, width: 1, height: 1 }) });
    const seen: string[] = [];
    events.onInspect = (id) => seen.push(id);
    host.dispatchEvent(new CustomEvent("mc-card-inspect", { detail: { cardId: "01110" }, bubbles: true }));
    expect(seen).toEqual(["01110"]);
  });
});
