// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-pack-gallery.js";
import { keepScroll } from "../../shared/list-scroll.js";
import { mount } from "../../shared/__tests__/test-mount.js";
import type { McPackGallery } from "../McPackGallery.js";
import type { GalleryTileModel } from "../../mc-pack-card/mc-pack-card.types.js";

const card = (key: string): GalleryTileModel => ({
  key,
  name: key,
  typeLine: "Event",
  quantity: 1,
  src: null,
  missing: key,
  hover: null,
});

describe("mc-pack-gallery", () => {
  it("says its count line, then each group's heading over a row of its cards, in a scroller named list:gallery", async () => {
    const el = await mount<McPackGallery>("mc-pack-gallery", {
      heading: "CARDS · 3 cards",
      listId: "gallery:a",
      sections: [
        { title: "Hero", cards: [card("card:a"), card("card:b")] },
        { title: "Deck", cards: [card("card:c")] },
      ],
    });
    expect(el.shadowRoot!.querySelector(".count")!.textContent).toBe("CARDS · 3 cards");
    expect(el.scroller!.getAttribute("data-key")).toBe("list:gallery");
    expect([...el.shadowRoot!.querySelectorAll(".head")].map((h) => h.textContent)).toEqual(["Hero · 2", "Deck · 1"]);
    expect([...el.shadowRoot!.querySelectorAll("mc-pack-card")].map((c) => c.getAttribute("data-stop"))).toEqual([
      "card:a",
      "card:b",
      "card:c",
    ]);
    el.remove();
  });

  it("puts a pack's scroll place back when its list id comes round again", async () => {
    keepScroll("gallery:b", 120);
    const el = await mount<McPackGallery>("mc-pack-gallery", { heading: "", listId: "gallery:a", sections: [] });
    el.listId = "gallery:b";
    await el.updateComplete;
    expect(el.scroller!.scrollTop).toBe(120);
    el.remove();
  });
});
