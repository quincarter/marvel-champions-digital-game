// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-side-story-page.js";
import type { SideStoryPageModel } from "../mc-side-story-page.types.js";

afterEach(() => document.body.replaceChildren());

const model = (hasBack: boolean): SideStoryPageModel => ({
  compact: false,
  header: { label: "SIDE STORY", title: "HOMECOMING", credit: "Marvel", closeLabel: "CLOSE", closeGlyph: null },
  where: "PAGE 1 · PANEL 1",
  actions: { hasBack, backLabel: "BACK", nextLabel: "NEXT", nextGlyph: null },
});

describe("mc-side-story-page", () => {
  it("composes the header, the reading area and the action bar in the reader frame", async () => {
    const el = document.createElement("mc-side-story-page");
    el.model = model(false);
    document.body.append(el);
    await el.updateComplete;
    const root = el.shadowRoot!;
    expect(root.querySelector("mc-reader")!.hasAttribute("no-side")).toBe(true);
    expect(root.querySelector("mc-side-story-header")).not.toBeNull();
    expect(root.querySelector("mc-side-story-actions")).not.toBeNull();
    await root.querySelector("mc-side-story-stage")!.updateComplete;
    expect(el.readingArea).not.toBeNull();
  });

  it("hands BACK to the action bar from the second beat on", async () => {
    const el = document.createElement("mc-side-story-page");
    el.model = model(true);
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("mc-side-story-actions")!.hasAttribute("has-back")).toBe(true);
  });
});
