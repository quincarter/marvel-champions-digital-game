// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-rules-header.js";

afterEach(() => document.body.replaceChildren());

describe("mc-rules-header", () => {
  it("shows the title and the scope row, and Back says back", async () => {
    const el = document.createElement("mc-rules-header");
    el.heading = "Rules reference";
    el.caption = "Showing all rules";
    document.body.append(el);
    await el.updateComplete;
    const root = el.shadowRoot!;
    expect(root.querySelector(".title")!.textContent).toBe("Rules reference");
    expect(root.querySelector("mc-rules-scope")).not.toBeNull();
    const heard = vi.fn();
    el.addEventListener("mc-rules", (event) => heard(event.detail));
    root
      .querySelector('[data-stop="back"]')!
      .dispatchEvent(new CustomEvent("mc-press", { bubbles: true, composed: true }));
    expect(heard).toHaveBeenCalledWith({ type: "back" });
  });
});
