import { afterEach, describe, expect, it } from "vitest";
import "./mc-sheet.js";
import "../mc-action-bar/mc-action-bar.js";
import "../mc-section-header/mc-section-header.js";
import "../mc-empty-state/mc-empty-state.js";
import type { SheetNode } from "../../shared/sheet.types.js";

afterEach(() => document.body.replaceChildren());

const rect = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });

function tap(element: Element): void {
  const at = { bubbles: true, composed: true, clientX: 5, clientY: 5, pointerId: 1, button: 0 };
  element.dispatchEvent(new PointerEvent("pointerdown", at));
  element.dispatchEvent(new PointerEvent("pointerup", at));
}

async function mount(nodes: SheetNode[]) {
  const sheet = document.createElement("mc-sheet");
  sheet.nodes = nodes;
  document.body.append(sheet);
  await sheet.updateComplete;
  return sheet;
}

describe("mc-sheet with the deck picker parts", () => {
  it("hands a search field events on with its key, and passes its options through", async () => {
    const sheet = await mount([
      {
        kind: "search",
        key: "link",
        rect: rect(0, 0, 200, 40),
        value: "",
        placeholder: "Link",
        clearLabel: "Clear",
        maxLength: 200,
        debounce: 0,
        keepFocus: true,
        clearable: false,
        escapeClears: true,
      },
    ]);
    const field = sheet.elementOf("link") as HTMLElement & {
      maxLength: number;
      keepFocus: boolean;
      clearable: boolean;
    };
    expect([field.maxLength, field.keepFocus, field.clearable]).toEqual([200, true, false]);
    const seen: unknown[] = [];
    sheet.addEventListener("mc-search", (e) => seen.push(["search", (e as CustomEvent).detail]));
    sheet.addEventListener("mc-submit", (e) => seen.push(["submit", (e as CustomEvent).detail]));
    const input = field.shadowRoot!.querySelector("input")!;
    input.value = "abc";
    input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, composed: true }));
    expect(seen).toEqual([
      ["search", { value: "abc", immediate: false, key: "link" }],
      ["search", { value: "abc", immediate: true, key: "link" }],
      ["submit", { value: "abc", key: "link" }],
    ]);
  });

  it("still raises mc-activate for a dimmed pressable button, and not for a plain disabled one", async () => {
    const sheet = await mount([
      {
        kind: "button",
        key: "pick",
        rect: rect(0, 0, 80, 40),
        label: "Pick",
        look: "primary",
        disabled: "Not legal",
        pressable: true,
      },
      { kind: "button", key: "off", rect: rect(0, 50, 80, 40), label: "Off", look: "primary", disabled: true },
    ]);
    const keys: string[] = [];
    sheet.addEventListener("mc-activate", (e) => keys.push((e as CustomEvent<{ key: string }>).detail.key));
    tap(sheet.elementOf("pick")!);
    tap(sheet.elementOf("off")!);
    expect(keys).toEqual(["pick"]);
  });

  it("keeps a centered cover crop on the focal point once the picture size is known", async () => {
    const sheet = await mount([
      {
        kind: "image",
        key: "hero",
        rect: rect(0, 0, 100, 100),
        src: "/h.png",
        cover: { x: 0, y: 0.5, centered: true },
      },
    ]);
    const img = sheet.elementOf("hero")!.querySelector("img")!;
    expect(img.style.objectPosition).toBe("0% 50%");
    Object.defineProperty(img, "naturalWidth", { value: 200 });
    Object.defineProperty(img, "naturalHeight", { value: 100 });
    img.dispatchEvent(new Event("load"));
    await sheet.updateComplete;
    expect(sheet.elementOf("hero")!.querySelector("img")!.style.objectPosition).toBe("0% 50%");
  });
});

describe("kit parts the picker uses", () => {
  it("draws a caption section header with an optional rule, a dim empty state and an action bar", async () => {
    const header = document.createElement("mc-section-header");
    header.level = "caption";
    header.rule = false;
    header.label = "Deck stats";
    const empty = document.createElement("mc-empty-state");
    empty.message = "Loading";
    empty.dim = true;
    const bar = document.createElement("mc-action-bar");
    document.body.append(header, empty, bar);
    await Promise.all([header.updateComplete, empty.updateComplete, bar.updateComplete]);
    expect(header.shadowRoot!.querySelector(".head")!.classList.contains("caption")).toBe(true);
    expect(header.shadowRoot!.querySelector(".rule")).toBeNull();
    header.rule = true;
    await header.updateComplete;
    expect(header.shadowRoot!.querySelector(".rule")).not.toBeNull();
    expect(empty.hasAttribute("dim")).toBe(true);
    expect(bar.shadowRoot!.querySelector("slot")).not.toBeNull();
  });
});
