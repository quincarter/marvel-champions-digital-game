// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-rules-step.js";

afterEach(() => document.body.replaceChildren());

describe("mc-rules-step", () => {
  it("is a focus stop that marks the current step in words and shows its picture", async () => {
    const el = document.createElement("mc-rules-step");
    el.step = {
      index: 2,
      label: "3. Deal encounter cards",
      detail: "Each player is dealt one.",
      current: true,
      picture: { src: "back.png" },
    };
    document.body.append(el);
    await el.updateComplete;
    expect(el.dataset.stop).toBe("row:step:2");
    const root = el.shadowRoot!;
    expect(root.querySelector(".card")!.classList.contains("current")).toBe(true);
    expect(root.querySelector(".now")).not.toBeNull();
    expect(root.querySelector("img")!.getAttribute("src")).toBe("back.png");
  });

  it("leaves the picture out for a procedural step", async () => {
    const el = document.createElement("mc-rules-step");
    el.step = { index: 5, label: "6. End of round", detail: "d", current: false, picture: null };
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".art")).toBeNull();
    expect(el.shadowRoot!.querySelector(".now")).toBeNull();
  });
});
