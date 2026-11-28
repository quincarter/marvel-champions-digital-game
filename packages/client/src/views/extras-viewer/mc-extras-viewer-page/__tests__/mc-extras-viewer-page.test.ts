// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-extras-viewer-page.js";
import type { ViewerPageModel } from "../mc-extras-viewer-page.types.js";

afterEach(() => document.body.replaceChildren());

const model = (text: ViewerPageModel["text"], wide = true): ViewerPageModel => ({
  compact: false,
  wide,
  header: { title: "SPIDER-MAN", closeLabel: "Close" },
  slide: { picture: { src: "a.png" }, caption: "Cover", arrows: false, empty: "" },
  text,
});

async function page(m: ViewerPageModel) {
  const el = document.createElement("mc-extras-viewer-page");
  el.model = m;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-extras-viewer-page", () => {
  it("composes the header, the picture and the words, and reflects the wide layout", async () => {
    const el = await page(model({ subtitle: "Peter", lines: [], promo: null, note: "" }));
    const root = el.shadowRoot!;
    expect(root.querySelector("mc-top-bar")).not.toBeNull();
    expect(root.querySelector("mc-viewer-slide")).not.toBeNull();
    expect(root.querySelector("mc-viewer-text")).not.toBeNull();
    expect(el.hasAttribute("wide")).toBe(true);
  });

  it("leaves the words out for a file with none (a piece of artwork)", async () => {
    const el = await page(model(null, false));
    expect(el.shadowRoot!.querySelector("mc-viewer-text")).toBeNull();
    expect(el.hasAttribute("wide")).toBe(false);
  });
});
