import { afterEach, describe, expect, it } from "vitest";
import "./mc-news-bar.js";
import type { NewsBarModel } from "./mc-news-bar.types.js";

afterEach(() => document.body.replaceChildren());

const model = (over: Partial<NewsBarModel> = {}): NewsBarModel => ({
  tag: "NEW",
  message: "Spider-Ham joins the Mod Store",
  link: "Read more ↗",
  ...over,
});

async function mount(m: NewsBarModel | null) {
  const el = document.createElement("mc-news-bar");
  el.model = m;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

function tap(element: Element): void {
  const at = { bubbles: true, composed: true, clientX: 5, clientY: 5, pointerId: 1, button: 0 };
  element.dispatchEvent(new PointerEvent("pointerdown", at));
  element.dispatchEvent(new PointerEvent("pointerup", at));
}

describe("mc-news-bar", () => {
  it("says its tag, message and link in words", async () => {
    const el = await mount(model());
    const root = el.shadowRoot!;
    expect(root.querySelector(".tag")!.textContent).toBe("NEW");
    expect(root.querySelector(".message")!.textContent).toBe("Spider-Ham joins the Mod Store");
    expect(root.querySelector(".link")!.textContent).toBe("Read more ↗");
    expect(root.querySelector("mc-glyph")).toBeNull();
  });

  it("shows the focus glyph beside the link when it has one", async () => {
    const el = await mount(model({ glyph: { specs: [], height: 16, ground: "ink", openness: 1 } }));
    expect(el.shadowRoot!.querySelector("mc-glyph")).not.toBeNull();
  });

  it("raises mc-press when the strip is tapped, and draws nothing without a model", async () => {
    const el = await mount(model());
    let pressed = 0;
    el.addEventListener("mc-press", () => pressed++);
    tap(el);
    expect(pressed).toBe(1);
    el.remove();
    tap(el);
    expect(pressed).toBe(1);
    expect((await mount(null)).shadowRoot!.querySelector(".bar")).toBeNull();
  });
});
