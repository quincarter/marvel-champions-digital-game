import { afterEach, describe, expect, it } from "vitest";
import "../mc-search-hits";

afterEach(() => document.body.replaceChildren());

describe("mc-search-hits", () => {
  it("hands its text and words to the field and its rows to the list", async () => {
    const el = document.createElement("mc-search-hits");
    el.query = "retaliate";
    el.placeholder = "Search";
    el.rows = [{ key: "toc:2", title: "Retaliate" }];
    el.selected = "toc:2";
    document.body.append(el);
    await el.updateComplete;
    const field = el.field!;
    expect(field.value).toBe("retaliate");
    expect(field.placeholder).toBe("Search");
    expect(field.dataset.stop).toBe("search");
    expect(el.toc!.rows).toHaveLength(1);
    expect(el.toc!.selected).toBe("toc:2");
  });

  it("keeps the field's stop key under the name the screen chose", async () => {
    const el = document.createElement("mc-search-hits");
    el.searchStop = "find";
    document.body.append(el);
    await el.updateComplete;
    expect(el.field!.dataset.stop).toBe("find");
  });
});
