// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../mc-side-story-stage.js";

afterEach(() => document.body.replaceChildren());

describe("mc-side-story-stage", () => {
  it("leaves an empty reading area for the canvas and says where the reader is", async () => {
    const el = document.createElement("mc-side-story-stage");
    el.where = "PAGE 2 · PANEL 3";
    document.body.append(el);
    await el.updateComplete;
    expect(el.readingArea).not.toBeNull();
    expect(el.readingArea!.childElementCount).toBe(0);
    expect(el.shadowRoot!.querySelector(".where")!.textContent).toBe("PAGE 2 · PANEL 3");
  });
});
