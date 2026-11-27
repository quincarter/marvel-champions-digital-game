import { afterEach, describe, expect, it, vi } from "vitest";
import "./mc-search-field.js";

async function field(): Promise<{
  el: HTMLElementTagNameMap["mc-search-field"];
  input: HTMLInputElement;
  seen: string[];
}> {
  const el = document.createElement("mc-search-field");
  el.placeholder = "Search";
  document.body.append(el);
  await el.updateComplete;
  const seen: string[] = [];
  el.addEventListener("mc-search", (event) =>
    seen.push(`search:${(event as CustomEvent<{ text: string }>).detail.text}`),
  );
  el.addEventListener("mc-submit", (event) =>
    seen.push(`submit:${(event as CustomEvent<{ text: string }>).detail.text}`),
  );
  return { el, input: el.shadowRoot!.querySelector("input")!, seen };
}

const type = (input: HTMLInputElement, text: string): void => {
  input.value = text;
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("mc-search-field", () => {
  it("raises mc-search once, after the typing paused", async () => {
    vi.useFakeTimers();
    const { input, seen } = await field();
    type(input, "w");
    type(input, "wa");
    vi.advanceTimersByTime(100);
    expect(seen).toEqual([]);
    vi.advanceTimersByTime(60);
    expect(seen).toEqual(["search:wa"]);
  });

  it("waits out an IME composition and fires when it ends", async () => {
    vi.useFakeTimers();
    const { input, seen } = await field();
    input.dispatchEvent(new Event("compositionstart"));
    type(input, "に");
    vi.advanceTimersByTime(500);
    expect(seen).toEqual([]);
    input.dispatchEvent(new Event("compositionend"));
    vi.advanceTimersByTime(200);
    expect(seen).toEqual(["search:に"]);
  });

  it("clears on Escape, and blurs when there is nothing to clear; Enter submits", async () => {
    vi.useFakeTimers();
    const { el, input, seen } = await field();
    input.focus();
    type(input, "hulk");
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(el.value).toBe("");
    expect(seen).toEqual(["search:"]);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(el.focused).toBe(false);
    type(input, "thor");
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(seen.at(-1)).toBe("submit:thor");
  });
});
