// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-pack-text.js";
import { keepScroll } from "../../shared/list-scroll.js";
import { mount } from "../../shared/__tests__/test-mount.js";
import type { McPackText } from "../McPackText.js";

describe("mc-pack-text", () => {
  it("says its text in a span inside a native scroller named list:text", async () => {
    const el = await mount<McPackText>("mc-pack-text", { body: "First.\n\nSecond.", listId: "text:a" });
    expect(el.scroller!.getAttribute("data-key")).toBe("list:text");
    expect(el.scroller!.querySelector(".body")!.textContent).toBe("First.\n\nSecond.");
    el.remove();
  });

  it("puts a page's scroll place back when its id comes round again", async () => {
    keepScroll("text:b", 40);
    const el = await mount<McPackText>("mc-pack-text", { body: "x", listId: "text:a" });
    el.listId = "text:b";
    await el.updateComplete;
    expect(el.scroller!.scrollTop).toBe(40);
    el.remove();
  });
});
