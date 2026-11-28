// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-viewer-slide.js";

afterEach(() => document.body.replaceChildren());

describe("mc-viewer-slide", () => {
  it("shows the picture whole with its caption, and arrows only for a file with more", async () => {
    const el = document.createElement("mc-viewer-slide");
    el.picture = { src: "a.png" };
    el.caption = "Cover";
    document.body.append(el);
    await el.updateComplete;
    const root = el.shadowRoot!;
    expect(root.querySelector("mc-picture-tile")).not.toBeNull();
    expect(root.querySelector(".caption")!.textContent).toBe("Cover");
    expect(root.querySelector('[data-stop="next"]')).toBeNull();
    el.arrows = true;
    await el.updateComplete;
    expect(root.querySelector('[data-stop="prev"]')).not.toBeNull();
  });

  it("says there is no picture in words, and steps with the arrows", async () => {
    const el = document.createElement("mc-viewer-slide");
    el.empty = "No artwork for this one yet.";
    el.arrows = true;
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".none")!.textContent).toBe("No artwork for this one yet.");
    const heard = vi.fn();
    el.addEventListener("mc-viewer", (event) => heard(event.detail));
    el.shadowRoot!.querySelector('[data-stop="prev"]')!.dispatchEvent(
      new CustomEvent("mc-press", { bubbles: true, composed: true }),
    );
    expect(heard).toHaveBeenCalledWith({ type: "step", direction: -1 });
  });
});
