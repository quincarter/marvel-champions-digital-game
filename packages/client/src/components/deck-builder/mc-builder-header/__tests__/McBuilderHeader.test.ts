// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { builderEvents, inner, mount, stopKeys } from "../../shared/test-support.js";
import "../mc-builder-header.js";
import type { McBuilderHeader } from "../McBuilderHeader.js";

afterEach(() => document.body.replaceChildren());

const model = { title: "DECK BUILDER", backLabel: "Back" };

describe("mc-builder-header", () => {
  it("draws the title and Back as the `back` stop", async () => {
    const el = await mount<McBuilderHeader>("mc-builder-header", { model });
    expect(inner(el, "h1.title")!.textContent).toBe("DECK BUILDER");
    expect(stopKeys(el)).toEqual(["back"]);
  });

  it("says back when Back is pressed", async () => {
    const el = await mount<McBuilderHeader>("mc-builder-header", { model });
    const seen = builderEvents(el);
    inner<HTMLElement>(el, "mc-button")!.dispatchEvent(new CustomEvent("mc-press", { bubbles: true, composed: true }));
    expect(seen).toEqual([{ type: "back" }]);
  });

  it("drops the row and limits the title when the scene says the toggle is in the way", async () => {
    const el = await mount<McBuilderHeader>("mc-builder-header", { model, drop: 30, maxWidth: 200 });
    const style = inner<HTMLElement>(el, "h1.title")!.getAttribute("style")!;
    expect(style).toContain("--title-drop:30px");
    expect(style).toContain("--title-max:200px");
  });

  it("keeps a one-line copy of the title at its natural size for the scene to measure", async () => {
    const el = await mount<McBuilderHeader>("mc-builder-header", { model, drop: 30, maxWidth: 200 });
    expect(el.ghost!.textContent).toBe("DECK BUILDER");
    expect(el.ghost!.getAttribute("aria-hidden")).toBe("true");
  });

  it("draws nothing without a model", async () => {
    const el = await mount<McBuilderHeader>("mc-builder-header");
    expect(inner(el, "h1.title")).toBeNull();
  });
});
