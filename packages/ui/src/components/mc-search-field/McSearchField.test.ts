import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "./mc-search-field.js";
import type { McSearchDetail } from "./mc-search-field.types.js";

async function field(props: Partial<{ value: string; placeholder: string; debounce: number }> = {}) {
  const el = document.createElement("mc-search-field");
  Object.assign(el, props);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

const inputOf = (el: HTMLElement): HTMLInputElement => el.shadowRoot!.querySelector("input")!;

function type(el: HTMLElement, text: string): void {
  const input = inputOf(el);
  input.value = text;
  input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
}

function tap(element: Element): void {
  const at = { bubbles: true, composed: true, clientX: 5, clientY: 5, pointerId: 1, button: 0 };
  element.dispatchEvent(new PointerEvent("pointerdown", at));
  element.dispatchEvent(new PointerEvent("pointerup", at));
}

describe("mc-search-field", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it("raises one mc-search after the typing pause, with the latest text", async () => {
    const el = await field({ placeholder: "Search this book…" });
    const seen: McSearchDetail[] = [];
    el.addEventListener("mc-search", (event) => seen.push((event as CustomEvent<McSearchDetail>).detail));
    expect(inputOf(el).placeholder).toBe("Search this book…");
    type(el, "ret");
    vi.advanceTimersByTime(100);
    type(el, "retal");
    vi.advanceTimersByTime(199);
    expect(seen).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(seen).toEqual([{ value: "retal", immediate: false }]);
  });

  it("waits out an IME composition and fires when it ends", async () => {
    const el = await field();
    const seen: McSearchDetail[] = [];
    el.addEventListener("mc-search", (event) => seen.push((event as CustomEvent<McSearchDetail>).detail));
    inputOf(el).dispatchEvent(new Event("compositionstart"));
    type(el, "ね");
    vi.advanceTimersByTime(1000);
    expect(seen).toEqual([]);
    inputOf(el).dispatchEvent(new Event("compositionend"));
    expect(seen).toEqual([{ value: "ね", immediate: false }]);
  });

  it("fires at once on Enter and leaves the field; Escape only leaves, and neither reaches the window", async () => {
    const el = await field();
    const seen: McSearchDetail[] = [];
    el.addEventListener("mc-search", (event) => seen.push((event as CustomEvent<McSearchDetail>).detail));
    const reached: string[] = [];
    window.addEventListener("keydown", (event) => reached.push(event.key), { once: false });
    type(el, "x");
    inputOf(el).dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, composed: true }));
    expect(seen).toEqual([{ value: "x", immediate: true }]);
    inputOf(el).dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, composed: true }));
    expect(seen).toHaveLength(1);
    expect(reached).toEqual([]);
  });

  it("clears with a tap on the clear button, firing at once", async () => {
    const el = await field({ value: "abc" });
    await el.updateComplete;
    const seen: McSearchDetail[] = [];
    el.addEventListener("mc-search", (event) => seen.push((event as CustomEvent<McSearchDetail>).detail));
    const clear = el.shadowRoot!.querySelector(".clear")!;
    tap(clear);
    await el.updateComplete;
    expect(seen).toEqual([{ value: "", immediate: true }]);
    expect(inputOf(el).value).toBe("");
    expect(el.shadowRoot!.querySelector(".clear")).toBeNull();
  });

  it("adopts a new value property but does not let a stale one overwrite what is being typed", async () => {
    const el = await field({ value: "one" });
    expect(inputOf(el).value).toBe("one");
    type(el, "one two");
    // The screen redraws with the query it still holds: same property, nothing changes.
    el.value = "one";
    await el.updateComplete;
    expect(inputOf(el).value).toBe("one two");
    // A real change from outside (a new tab clears it) is taken.
    el.value = "";
    await el.updateComplete;
    expect(inputOf(el).value).toBe("");
  });

  it("reports focus changes and the focus placeholder while empty and focused", async () => {
    const el = await field({ placeholder: "Search" });
    el.focusPlaceholder = "Steam + X opens the keyboard";
    await el.updateComplete;
    const states: boolean[] = [];
    el.addEventListener("mc-search-focus", (event) => states.push((event as CustomEvent).detail.focused));
    inputOf(el).dispatchEvent(new Event("focus"));
    await el.updateComplete;
    expect(el.isFocused).toBe(true);
    expect(inputOf(el).placeholder).toBe("Steam + X opens the keyboard");
    inputOf(el).dispatchEvent(new Event("blur"));
    await el.updateComplete;
    expect(states).toEqual([true, false]);
    expect(inputOf(el).placeholder).toBe("Search");
  });

  it("with escape-clears, Escape empties a filled field at once and keeps the caret, then an empty one just leaves", async () => {
    const el = await field({ value: "rhino" });
    el.escapeClears = true;
    await el.updateComplete;
    const seen: McSearchDetail[] = [];
    el.addEventListener("mc-search", (event) => seen.push((event as CustomEvent<McSearchDetail>).detail));
    const escape = () =>
      inputOf(el).dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, composed: true }));
    escape();
    await el.updateComplete;
    expect(seen).toEqual([{ value: "", immediate: true }]);
    expect(inputOf(el).value).toBe("");
    escape();
    expect(seen).toHaveLength(1);
  });

  it("asks the mobile keyboard for a Search key, and focus() puts the caret in the input", async () => {
    const el = await field();
    expect(inputOf(el).getAttribute("inputmode")).toBe("search");
    expect(inputOf(el).getAttribute("enterkeyhint")).toBe("search");
    const spy = vi.spyOn(inputOf(el), "focus");
    el.focus();
    expect(spy).toHaveBeenCalled();
  });
});
