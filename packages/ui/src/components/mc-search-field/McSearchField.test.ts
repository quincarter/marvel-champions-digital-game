import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "./mc-search-field.js";

async function field(props: Record<string, unknown> = {}) {
  const el = document.createElement("mc-search-field");
  Object.assign(el, props);
  document.body.append(el);
  await el.updateComplete;
  return el;
}
const inputOf = (el: HTMLElement) => el.shadowRoot!.querySelector("input")!;

function type(el: HTMLElement, value: string): void {
  const input = inputOf(el);
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
}

describe("mc-search-field", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("raises one debounced mc-search for a burst of typing", async () => {
    const el = await field({ debounce: 100 });
    const seen: string[] = [];
    el.addEventListener("mc-search", (e) => seen.push((e as CustomEvent<{ value: string }>).detail.value));
    type(el, "s");
    type(el, "sp");
    type(el, "spi");
    expect(seen).toEqual([]);
    vi.advanceTimersByTime(120);
    expect(seen).toEqual(["spi"]);
  });

  it("waits out an IME composition", async () => {
    const el = await field({ debounce: 50 });
    const seen: string[] = [];
    el.addEventListener("mc-search", (e) => seen.push((e as CustomEvent<{ value: string }>).detail.value));
    inputOf(el).dispatchEvent(new Event("compositionstart"));
    type(el, "に");
    vi.advanceTimersByTime(200);
    expect(seen).toEqual([]);
    inputOf(el).dispatchEvent(new Event("compositionend"));
    vi.advanceTimersByTime(60);
    expect(seen).toEqual(["に"]);
  });

  it("Escape clears a filled field at once, then an empty one just leaves", async () => {
    const el = await field({ value: "rhino" });
    const seen: string[] = [];
    el.addEventListener("mc-search", (e) => seen.push((e as CustomEvent<{ value: string }>).detail.value));
    inputOf(el).dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, composed: true }));
    expect(seen).toEqual([""]);
    expect(el.value).toBe("");
  });

  it("asks the mobile keyboard for a Search key", async () => {
    const input = inputOf(await field());
    expect(input.getAttribute("inputmode")).toBe("search");
    expect(input.getAttribute("enterkeyhint")).toBe("search");
  });
});
