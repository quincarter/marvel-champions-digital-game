import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "./mc-search-field.js";

async function field(props: Partial<{ value: string; placeholder: string; clearLabel: string }> = {}) {
  const el = document.createElement("mc-search-field");
  Object.assign(el, props);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

const input = (el: HTMLElement): HTMLInputElement => el.shadowRoot!.querySelector("input")!;

function type(el: HTMLElement, value: string): void {
  input(el).value = value;
  input(el).dispatchEvent(new Event("input", { bubbles: true }));
}

describe("mc-search-field", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("raises mc-search once typing rests for 120ms, with the last text", async () => {
    const el = await field({ placeholder: "Search" });
    const seen: string[] = [];
    el.addEventListener("mc-search", (e) => seen.push((e as CustomEvent).detail.value));
    type(el, "h");
    vi.advanceTimersByTime(60);
    type(el, "hu");
    vi.advanceTimersByTime(119);
    expect(seen).toEqual([]);
    vi.advanceTimersByTime(2);
    expect(seen).toEqual(["hu"]);
    el.remove();
  });

  it("waits out an IME composition and raises the finished text once", async () => {
    const el = await field();
    const seen: string[] = [];
    el.addEventListener("mc-search", (e) => seen.push((e as CustomEvent).detail.value));
    input(el).dispatchEvent(new Event("compositionstart"));
    type(el, "に");
    vi.advanceTimersByTime(500);
    expect(seen).toEqual([]);
    input(el).dispatchEvent(new Event("compositionend"));
    vi.advanceTimersByTime(121);
    expect(seen).toEqual(["に"]);
    el.remove();
  });

  it("raises mc-search-submit on Enter, and Escape clears a field with text before leaving an empty one", async () => {
    const el = await field();
    const searches: string[] = [];
    const submits: string[] = [];
    el.addEventListener("mc-search", (e) => searches.push((e as CustomEvent).detail.value));
    el.addEventListener("mc-search-submit", (e) => submits.push((e as CustomEvent).detail.value));
    type(el, "iron");
    input(el).dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(submits).toEqual(["iron"]);
    input(el).dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(searches).toEqual([""]);
    expect(input(el).value).toBe("");
    el.remove();
  });

  it("shows a value set from outside without raising a search", async () => {
    const el = await field({ value: "abc" });
    const seen: string[] = [];
    el.addEventListener("mc-search", (e) => seen.push((e as CustomEvent).detail.value));
    expect(input(el).value).toBe("abc");
    el.value = "";
    await el.updateComplete;
    expect(input(el).value).toBe("");
    vi.advanceTimersByTime(500);
    expect(seen).toEqual([]);
    el.remove();
  });
});
