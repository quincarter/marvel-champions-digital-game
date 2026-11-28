// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-side-story-header.js";

afterEach(() => document.body.replaceChildren());

describe("mc-side-story-header", () => {
  it("shows the label, title and credit, and CLOSE is a focus stop that says close", async () => {
    const el = document.createElement("mc-side-story-header");
    el.label = "SIDE STORY";
    el.title = "HOMECOMING";
    el.credit = "Marvel";
    el.closeLabel = "CLOSE";
    document.body.append(el);
    await el.updateComplete;
    const root = el.shadowRoot!;
    expect(root.querySelector(".label")!.textContent).toBe("SIDE STORY");
    expect(root.querySelector(".title")!.textContent).toBe("HOMECOMING");
    expect(root.querySelector(".credit")!.textContent).toBe("Marvel");
    const heard = vi.fn();
    el.addEventListener("mc-side-story", (event) => heard(event.detail));
    const close = root.querySelector<HTMLElement>('[data-stop="close"]')!;
    close.dispatchEvent(new CustomEvent("mc-press", { bubbles: true, composed: true }));
    expect(heard).toHaveBeenCalledWith({ type: "close" });
  });
});
