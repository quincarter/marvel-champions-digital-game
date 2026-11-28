// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../../mc-reader-pdfs/mc-reader-pdfs.js";
import "../mc-reader-contents.js";

afterEach(() => document.body.replaceChildren());

async function contents(set: (el: HTMLElementTagNameMap["mc-reader-contents"]) => void) {
  const el = document.createElement("mc-reader-contents");
  set(el);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-reader-contents", () => {
  it("raises the section index of a pressed row and the text of a search, as one mc-reader event", async () => {
    const el = await contents((c) => (c.hits = [{ key: "toc:4", title: "Setup" }]));
    const heard = vi.fn();
    el.addEventListener("mc-reader", (event) => heard(event.detail));
    const hits = el.shadowRoot!.querySelector("mc-search-hits")!;
    await hits.updateComplete;
    hits.dispatchEvent(new CustomEvent("mc-activate", { detail: { key: "toc:4" }, bubbles: true, composed: true }));
    hits.dispatchEvent(new CustomEvent("mc-search", { detail: { value: "golden" }, bubbles: true, composed: true }));
    hits.dispatchEvent(new CustomEvent("mc-search-focus", { detail: { focused: true }, bubbles: true, composed: true }));
    expect(heard.mock.calls.map(([detail]) => detail)).toEqual([
      { type: "toc", index: 4 },
      { type: "search", value: "golden" },
      { type: "search-focus", focused: true },
    ]);
  });

  it("keeps the PDF buttons for the phone, under the field", async () => {
    const wide = await contents(() => undefined);
    expect(wide.shadowRoot!.querySelector("mc-reader-pdfs")).toBeNull();
    const phone = await contents((c) => (c.pdfs = ["Rulebook"]));
    expect(phone.shadowRoot!.querySelector("mc-reader-pdfs")!.getAttribute("slot")).toBe("after");
  });
});
