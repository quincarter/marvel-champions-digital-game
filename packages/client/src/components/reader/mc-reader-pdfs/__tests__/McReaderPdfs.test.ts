// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-reader-pdfs.js";

afterEach(() => document.body.replaceChildren());

describe("mc-reader-pdfs", () => {
  it("draws a stop per PDF and says which one was pressed", async () => {
    const el = document.createElement("mc-reader-pdfs");
    el.labels = ["Rules Reference", "Rulebook"];
    document.body.append(el);
    await el.updateComplete;
    const buttons = [...el.shadowRoot!.querySelectorAll<HTMLElement>("mc-button")];
    expect(buttons.map((button) => button.dataset.stop)).toEqual(["pdf:0", "pdf:1"]);
    const heard = vi.fn();
    el.addEventListener("mc-reader", (event) => heard(event.detail));
    buttons[1]!.dispatchEvent(new CustomEvent("mc-press", { bubbles: true, composed: true }));
    expect(heard).toHaveBeenCalledWith({ type: "pdf", index: 1 });
  });
});
