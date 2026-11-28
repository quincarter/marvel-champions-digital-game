// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-aspect-segment.js";

describe("mc-aspect-segment", () => {
  it("shows the name, reflects chosen, and offers the tip button only when there is a tip", async () => {
    const el = document.createElement("mc-aspect-segment");
    el.aspect = "pool";
    el.label = "'Pool";
    el.chosen = true;
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".tile")!.textContent).toBe("'Pool");
    expect(el.hasAttribute("chosen")).toBe(true);
    expect(el.shadowRoot!.querySelector(".info")).toBeNull();
    el.tipLabel = "'Pool";
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-key="aspect-info:pool"]')).not.toBeNull();
    el.remove();
  });

  it("says which aspect's tip to toggle", async () => {
    const el = document.createElement("mc-aspect-segment");
    el.aspect = "justice";
    el.tipLabel = "Justice";
    document.body.append(el);
    await el.updateComplete;
    const heard = vi.fn();
    el.addEventListener("mc-deck-check", (event) => heard(event.detail));
    el.shadowRoot!.querySelector(".info")!.dispatchEvent(
      new CustomEvent("mc-press", { bubbles: true, composed: true }),
    );
    expect(heard).toHaveBeenCalledWith({ type: "tip", aspect: "justice" });
    el.remove();
  });
});
