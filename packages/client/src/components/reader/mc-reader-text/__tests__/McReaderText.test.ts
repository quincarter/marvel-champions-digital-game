// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../../mc-reader-pdfs/mc-reader-pdfs.js";
import "../mc-reader-text.js";

afterEach(() => document.body.replaceChildren());

async function text(set: (el: HTMLElementTagNameMap["mc-reader-text"]) => void) {
  const el = document.createElement("mc-reader-text");
  set(el);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-reader-text", () => {
  it("gives a phone a CONTENTS button that goes back to the list", async () => {
    const el = await text((e) => (e.article = { title: "Setup", blocks: [] }));
    const heard = vi.fn();
    el.addEventListener("mc-reader", (event) => heard(event.detail));
    const button = el.shadowRoot!.querySelector<HTMLElement>('[data-stop="contents"]')!;
    button.dispatchEvent(new CustomEvent("mc-press", { bubbles: true, composed: true }));
    expect(heard).toHaveBeenCalledWith({ type: "contents" });
  });

  it("gives a wide screen the PDF buttons instead, and the article takes the section", async () => {
    const el = await text((e) => {
      e.wide = true;
      e.pdfs = ["Rulebook"];
      e.article = { title: "Setup", blocks: [{ kind: "paragraph", text: "Shuffle." }] };
    });
    expect(el.shadowRoot!.querySelector('[data-stop="contents"]')).toBeNull();
    expect(el.shadowRoot!.querySelector("mc-reader-pdfs")).not.toBeNull();
    expect((el.shadowRoot!.querySelector("mc-article") as unknown as { model: { title: string } }).model.title).toBe(
      "Setup",
    );
  });
});
