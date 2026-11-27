import { afterEach, describe, expect, it } from "vitest";
import "./mc-text-field.js";
import type { McInputDetail } from "./mc-text-field.types.js";

afterEach(() => document.body.replaceChildren());

async function field(props: Partial<{ value: string; multiline: boolean; placeholder: string }> = {}) {
  const el = document.createElement("mc-text-field");
  Object.assign(el, props);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

const inner = (el: HTMLElement) => el.shadowRoot!.querySelector("input, textarea") as HTMLInputElement;

describe("mc-text-field", () => {
  it("is a textarea when multiline and an input otherwise, and raises mc-input with the text", async () => {
    const one = await field({ placeholder: "link" });
    expect(inner(one).tagName).toBe("INPUT");
    const many = await field({ multiline: true });
    expect(inner(many).tagName).toBe("TEXTAREA");
    const seen: McInputDetail[] = [];
    many.addEventListener("mc-input", (event) => seen.push((event as CustomEvent<McInputDetail>).detail));
    inner(many).value = "Hero: Spider-Man";
    inner(many).dispatchEvent(new Event("input"));
    expect(seen).toEqual([{ value: "Hero: Spider-Man" }]);
  });

  it("waits out an IME composition", async () => {
    const el = await field();
    const seen: string[] = [];
    el.addEventListener("mc-input", (event) => seen.push((event as CustomEvent<McInputDetail>).detail.value));
    inner(el).dispatchEvent(new Event("compositionstart"));
    inner(el).value = "ね";
    inner(el).dispatchEvent(new Event("input"));
    expect(seen).toEqual([]);
    inner(el).dispatchEvent(new Event("compositionend"));
    expect(seen).toEqual(["ね"]);
  });

  it("keeps Escape (and Enter in one line) from reaching the window, but lets a textarea take Enter", async () => {
    const el = await field();
    const area = await field({ multiline: true });
    const reached: string[] = [];
    window.addEventListener("keydown", (event) => reached.push(event.key));
    inner(el).dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, composed: true }));
    inner(el).dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, composed: true }));
    inner(area).dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, composed: true }));
    expect(reached).toEqual(["Enter"]);
  });

  it("adopts a changed value but not a stale one, and reports focus", async () => {
    const el = await field({ value: "a" });
    inner(el).value = "ab";
    inner(el).dispatchEvent(new Event("input"));
    el.value = "a";
    await el.updateComplete;
    expect(inner(el).value).toBe("ab");
    el.value = "";
    await el.updateComplete;
    expect(inner(el).value).toBe("");
    const states: boolean[] = [];
    el.addEventListener("mc-field-focus", (event) => states.push((event as CustomEvent).detail.focused));
    inner(el).dispatchEvent(new Event("focus"));
    inner(el).dispatchEvent(new Event("blur"));
    expect(states).toEqual([true, false]);
  });
});
