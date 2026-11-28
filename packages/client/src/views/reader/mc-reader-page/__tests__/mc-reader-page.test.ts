// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-reader-page.js";
import type { ReaderPageModel } from "../mc-reader-page.types.js";

afterEach(() => document.body.replaceChildren());

const model = (over: Partial<ReaderPageModel> = {}): ReaderPageModel => ({
  wide: true,
  phone: false,
  pane: "toc",
  bar: { backLabel: "◂ EXTRAS", title: "Rules", right: "1 / 2", backGlyph: null, titleDrop: 0, titleMaxRight: 0 },
  status: "ready",
  message: "",
  contents: {
    query: "",
    padKeyboard: false,
    hits: [
      { key: "toc:0", title: "Cover" },
      { key: "toc:1", title: "Setup" },
    ],
    current: "toc:0",
    pdfs: [],
  },
  text: { article: { title: "Cover", blocks: [] }, pictureMax: 300, pdfs: ["Rulebook"] },
  nav: { atStart: true, atEnd: false },
  ...over,
});

async function page(m: ReaderPageModel) {
  const el = document.createElement("mc-reader-page");
  el.model = m;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-reader-page", () => {
  it("composes the contents beside the text and the foot on a wide screen", async () => {
    const el = await page(model());
    const root = el.shadowRoot!;
    expect(root.querySelector("mc-reader-contents")).not.toBeNull();
    expect(root.querySelector("mc-reader-text")).not.toBeNull();
    expect(root.querySelector("mc-reader-nav")).not.toBeNull();
    expect(root.querySelector("mc-top-bar")!.getAttribute("compact")).toBeNull();
  });

  it("shows one pane at a time on a phone, the contents first", async () => {
    const el = await page(model({ wide: false, phone: true }));
    expect(el.shadowRoot!.querySelector("mc-reader-contents")).not.toBeNull();
    expect(el.shadowRoot!.querySelector("mc-reader-text")).toBeNull();
    el.model = model({ wide: false, phone: true, pane: "text" });
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("mc-reader-contents")).toBeNull();
    expect(el.shadowRoot!.querySelector("mc-reader-text")).not.toBeNull();
  });

  it("says why there is nothing to read instead of the sections", async () => {
    const el = await page(model({ status: "loading", message: "Loading…" }));
    expect(el.shadowRoot!.querySelector("mc-reader-contents")).toBeNull();
    expect(el.shadowRoot!.querySelector("mc-empty-state")!.getAttribute("message")).toBe("Loading…");
  });

  it("turns the top bar's Back into one typed mc-reader event", async () => {
    const el = await page(model());
    const heard = vi.fn();
    el.addEventListener("mc-reader", (event) => heard(event.detail));
    el.shadowRoot!.querySelector("mc-top-bar")!.dispatchEvent(
      new CustomEvent("mc-press", { bubbles: true, composed: true }),
    );
    expect(heard).toHaveBeenCalledWith({ type: "back" });
  });
});
