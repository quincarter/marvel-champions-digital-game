// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-reader-nav.js";

afterEach(() => document.body.replaceChildren());

describe("mc-reader-nav", () => {
  it("says prev and next, and dims the button at an end of the book", async () => {
    const el = document.createElement("mc-reader-nav");
    el.atStart = true;
    document.body.append(el);
    await el.updateComplete;
    const heard = vi.fn();
    el.addEventListener("mc-reader", (event) => heard(event.detail));
    const [prev, next] = [...el.shadowRoot!.querySelectorAll<HTMLElement>("mc-button")];
    expect(prev!.dataset.stop).toBe("prev");
    expect(prev!.hasAttribute("disabled")).toBe(true);
    expect(next!.hasAttribute("disabled")).toBe(false);
    next!.dispatchEvent(new CustomEvent("mc-press", { bubbles: true, composed: true }));
    expect(heard).toHaveBeenCalledWith({ type: "next" });
  });
});
