// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-viewer-header.js";

afterEach(() => document.body.replaceChildren());

describe("mc-viewer-header", () => {
  it("shows the title and its close button says close", async () => {
    const el = document.createElement("mc-viewer-header");
    el.heading = "SPIDER-MAN";
    el.closeLabel = "Close";
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".title")!.textContent).toBe("SPIDER-MAN");
    const heard = vi.fn();
    el.addEventListener("mc-viewer", (event) => heard(event.detail));
    const close = el.shadowRoot!.querySelector<HTMLElement>('[data-stop="close"]')!;
    expect(close.getAttribute("aria-label")).toBe("Close");
    close.dispatchEvent(new CustomEvent("mc-press", { bubbles: true, composed: true }));
    expect(heard).toHaveBeenCalledWith({ type: "close" });
  });
});
