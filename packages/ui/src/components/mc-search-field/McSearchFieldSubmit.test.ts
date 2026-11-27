import { afterEach, describe, expect, it, vi } from "vitest";
import "./mc-search-field.js";

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

async function mount(props: Record<string, unknown> = {}) {
  const el = document.createElement("mc-search-field");
  Object.assign(el, props);
  document.body.append(el);
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector("input")!;
  const seen: string[] = [];
  el.addEventListener("mc-search", (e) => {
    const d = (e as CustomEvent<{ value: string; immediate: boolean }>).detail;
    seen.push(`search:${d.value}:${d.immediate}`);
  });
  el.addEventListener("mc-submit", (e) => seen.push(`submit:${(e as CustomEvent<{ value: string }>).detail.value}`));
  return { el, input, seen };
}

const type = (input: HTMLInputElement, text: string): void => {
  input.value = text;
  input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
};
const key = (input: HTMLInputElement, k: string): void => {
  input.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, composed: true }));
};

describe("mc-search-field submit, length and focus options", () => {
  it("raises mc-search at once and then mc-submit on Enter, and leaves the field unless keep-focus", async () => {
    const { el, input, seen } = await mount();
    input.focus();
    type(input, "link");
    key(input, "Enter");
    expect(seen).toEqual(["search:link:true", "submit:link"]);
    expect(el.focused).toBe(false);
    const kept = await mount({ keepFocus: true });
    kept.input.focus();
    type(kept.input, "x");
    key(kept.input, "Enter");
    await kept.el.updateComplete;
    expect(kept.seen).toEqual(["search:x:true", "submit:x"]);
    expect(kept.el.focused).toBe(true);
    expect(kept.input.getAttribute("enterkeyhint")).toBe("go");
  });

  it("raises every change at once with a debounce of 0", async () => {
    vi.useFakeTimers();
    const { input, seen } = await mount({ debounce: 0 });
    type(input, "a");
    type(input, "ab");
    expect(seen).toEqual(["search:a:false", "search:ab:false"]);
  });

  it("limits the length, hides the clear button unless clearable, and holds the typed text in text", async () => {
    const { el, input } = await mount({ maxLength: 40, value: "abc" });
    expect(input.getAttribute("maxlength")).toBe("40");
    expect(el.shadowRoot!.querySelector(".clear")).not.toBeNull();
    el.clearable = false;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".clear")).toBeNull();
    type(input, "abcd");
    expect(el.text).toBe("abcd");
    expect(el.value).toBe("abc");
  });

  it("blur() takes the caret out", async () => {
    const { el, input } = await mount();
    input.focus();
    expect(el.focused).toBe(true);
    el.blur();
    expect(el.focused).toBe(false);
  });
});
