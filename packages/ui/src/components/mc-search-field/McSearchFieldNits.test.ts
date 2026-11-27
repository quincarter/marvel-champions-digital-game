import { afterEach, describe, expect, it, vi } from "vitest";
import "./mc-search-field.js";

async function mounted() {
  const el = document.createElement("mc-search-field");
  el.debounce = 100;
  document.body.append(el);
  await el.updateComplete;
  const seen: string[] = [];
  el.addEventListener("mc-search", (event) => seen.push((event as CustomEvent<{ value: string }>).detail.value));
  return { el, seen, input: el.shadowRoot!.querySelector("input")! };
}

const type = (input: HTMLInputElement, text: string): void => {
  input.value = text;
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("mc-search-field edge cases", () => {
  it("raises the composed text once when compositionend and input both arrive", async () => {
    vi.useFakeTimers();
    const { input, seen } = await mounted();
    input.dispatchEvent(new Event("compositionstart"));
    input.value = "に";
    input.dispatchEvent(new Event("compositionend"));
    type(input, "に");
    vi.advanceTimersByTime(300);
    expect(seen).toEqual(["に"]);
  });

  it("says what was typed when the caret leaves before the pause is over", async () => {
    vi.useFakeTimers();
    const { input, seen } = await mounted();
    type(input, "thor");
    input.dispatchEvent(new Event("blur"));
    expect(seen).toEqual(["thor"]);
    vi.advanceTimersByTime(300);
    expect(seen).toEqual(["thor"]);
  });

  it("drops a pending search when the client empties a field nobody holds", async () => {
    vi.useFakeTimers();
    const { el, seen, input } = await mounted();
    type(input, "wa");
    el.value = "";
    el.requestUpdate();
    await el.updateComplete;
    vi.advanceTimersByTime(300);
    expect(seen).toEqual([]);
    expect(el.text).toBe("");
  });
});
