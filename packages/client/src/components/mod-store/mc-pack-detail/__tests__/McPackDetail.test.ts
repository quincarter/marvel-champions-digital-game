// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-pack-detail.js";
import { mount } from "../../shared/__tests__/test-mount.js";
import type { McPackDetail } from "../McPackDetail.js";
import type { PackDetailModel } from "../mc-pack-detail.types.js";

const pack = (over: Partial<PackDetailModel> = {}): PackDetailModel => ({
  id: "x",
  pictures: { cover: null, faces: [{ src: null, missing: "Hero", hover: null }], square: null },
  title: { name: "X", byline: "by Y", meta: "Hero pack", chip: "+ Install", solid: true },
  textId: "text:x",
  body: "About X.",
  status: { kind: "none" },
  actions: [{ id: "install", label: "Install", kind: "primary", enabled: true }],
  gallery: {
    heading: "CARDS · 1 card",
    listId: "gallery:x",
    sections: [
      {
        title: "Hero",
        cards: [{ key: "card:a", name: "A", typeLine: "Event", quantity: 1, src: null, missing: "A", hover: null }],
      },
    ],
  },
  ...over,
});

describe("mc-pack-detail", () => {
  it("composes the pictures, title, text, gallery, status and buttons", async () => {
    const el = await mount<McPackDetail>("mc-pack-detail", { pack: pack() });
    const root = el.shadowRoot!;
    for (const tag of [
      "mc-pack-faces",
      "mc-pack-title",
      "mc-pack-text",
      "mc-pack-gallery",
      "mc-pack-status",
      "mc-pack-actions",
    ]) {
      expect(root.querySelector(tag), tag).not.toBeNull();
    }
    el.remove();
  });

  it("puts the text beside the pictures, under the title, on a wide screen", async () => {
    const el = await mount<McPackDetail>("mc-pack-detail", { pack: pack(), size: "wide" });
    expect(el.shadowRoot!.querySelector(".side mc-pack-text")).not.toBeNull();
    expect(el.shadowRoot!.querySelector(".page > mc-pack-text")).toBeNull();
    el.remove();
  });

  it("puts the text under the header on a phone", async () => {
    const el = await mount<McPackDetail>("mc-pack-detail", { pack: pack(), size: "phone" });
    expect(el.shadowRoot!.querySelector(".side mc-pack-text")).toBeNull();
    expect(el.shadowRoot!.querySelector(".page > mc-pack-text")).not.toBeNull();
    el.remove();
  });

  it("marks a pack with neither a cover nor a card as square, and one with no cards as having no gallery", async () => {
    const el = await mount<McPackDetail>("mc-pack-detail", {
      pack: pack({
        pictures: { cover: null, faces: [], square: { src: null, missing: "X", fit: "contain" } },
        gallery: null,
      }),
    });
    expect(el.hasAttribute("square")).toBe(true);
    expect(el.hasAttribute("gallery")).toBe(false);
    expect(el.shadowRoot!.querySelector("mc-pack-gallery")).toBeNull();
    // A square pack's text goes under its header on any width.
    expect(el.shadowRoot!.querySelector(".page > mc-pack-text")).not.toBeNull();
    el.remove();
  });

  it("offers the scrollers the pad's stick moves: the gallery first, then the text", async () => {
    const el = await mount<McPackDetail>("mc-pack-detail", { pack: pack() });
    await Promise.all(
      [
        ...el.shadowRoot!.querySelectorAll<HTMLElement & { updateComplete: Promise<unknown> }>(
          "mc-pack-gallery, mc-pack-text",
        ),
      ].map((child) => child.updateComplete),
    );
    expect(el.scrollers.map((s) => s.getAttribute("data-key"))).toEqual(["list:gallery", "list:text"]);
    el.remove();
  });
});
