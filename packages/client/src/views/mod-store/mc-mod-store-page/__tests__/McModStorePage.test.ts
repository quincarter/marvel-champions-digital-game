// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-mod-store-page.js";
import type { McModStorePage } from "../mc-mod-store-page.js";
import type { BrowseModel, ModStorePageModel } from "../mc-mod-store-page.types.js";

const browse = (over: Partial<BrowseModel> = {}): BrowseModel => ({
  caption: { heading: "Beta", body: "Rough edges." },
  tabs: [
    { id: "all", label: "All" },
    { id: "credits", label: "Credits" },
  ],
  selected: "all",
  toggle: { shown: false, open: false, label: "Search" },
  offline: null,
  updateBar: null,
  finders: null,
  body: {
    kind: "grid",
    listId: "grid:all",
    scrollFrom: 0,
    tiles: [
      {
        id: "a",
        name: "A",
        meta: "",
        summary: "",
        foot: "",
        badge: "+ Install",
        solid: true,
        letter: "A",
        thumb: { src: null, fit: "contain" },
      },
    ],
  },
  ...over,
});

const model = (over: Partial<ModStorePageModel> = {}): ModStorePageModel => ({
  header: {
    backLabel: "◂ TITLE",
    heading: "Mod Store",
    badge: "Beta",
    installedText: "",
    aboutLabel: "About mods",
    backGlyph: undefined,
    aboutGlyph: undefined,
  },
  browse: browse(),
  detail: null,
  notice: null,
  ...over,
});

async function mountPage(m: ModStorePageModel): Promise<McModStorePage> {
  const page = document.createElement("mc-mod-store-page");
  page.model = m;
  document.body.append(page);
  await page.updateComplete;
  return page;
}

describe("mc-mod-store-page", () => {
  it("composes the header, caption, tabs and the grid in the browse view", async () => {
    const page = await mountPage(model());
    const root = page.shadowRoot!;
    for (const tag of ["mc-top-bar", "mc-mod-beta-caption", "mc-mod-tabs", "mc-pack-grid"]) {
      expect(root.querySelector(tag), tag).not.toBeNull();
    }
    expect(root.querySelector("mc-pack-detail")).toBeNull();
    expect(root.querySelector("mc-mod-notice")).toBeNull();
    page.remove();
  });

  it("draws the finders, the offline strip and the Update all bar only when the model has them", async () => {
    const page = await mountPage(model());
    expect(page.shadowRoot!.querySelector("mc-mod-finders")).toBeNull();
    expect(page.shadowRoot!.querySelector("mc-mod-message[kind=offline]")).toBeNull();
    page.model = model({
      browse: browse({
        offline: "OFFLINE",
        updateBar: { text: "1 update", fraction: null, action: null, show: null },
        finders: {
          search: { value: "", placeholder: "Search", clearLabel: "Clear" },
          sortLabel: "⇅ A to Z",
          chips: [],
          clearLabel: "",
          countText: "1 packs",
        },
      }),
    });
    await page.updateComplete;
    expect(page.shadowRoot!.querySelector("mc-mod-finders")).not.toBeNull();
    expect(page.shadowRoot!.querySelector("mc-mod-message[kind=offline]")).not.toBeNull();
    expect(page.shadowRoot!.querySelector("mc-mod-update-bar")).not.toBeNull();
    page.remove();
  });

  it("shows Credits in place of the grid, and a message in place of either", async () => {
    const page = await mountPage(
      model({ browse: browse({ body: { kind: "credits", intro: "Who", empty: "None", credits: [] } }) }),
    );
    expect(page.shadowRoot!.querySelector("mc-creator-list")).not.toBeNull();
    expect(page.shadowRoot!.querySelector("mc-pack-grid")).toBeNull();
    page.model = model({ browse: browse({ body: { kind: "message", text: "Loading", retryLabel: "" } }) });
    await page.updateComplete;
    expect(page.shadowRoot!.querySelector("mc-creator-list")).toBeNull();
    expect(page.shadowRoot!.querySelector("mc-mod-message:not([kind=offline])")).not.toBeNull();
    page.remove();
  });

  it("shows a pack's page in place of the browse view, and the heads-up over either", async () => {
    const page = await mountPage(
      model({
        browse: null,
        detail: {
          id: "a",
          pictures: { cover: null, faces: [], square: { src: null, missing: "A", fit: "contain" } },
          title: { name: "A", byline: "", meta: "", chip: "+ Install", solid: true },
          textId: "text:a",
          body: "",
          status: { kind: "none" },
          actions: [],
          gallery: null,
        },
        notice: {
          lines: [{ speaker: "Deadpool", text: "Hi", portrait: { src: null } }],
          buttons: [],
          closeGlyph: undefined,
        },
      }),
    );
    expect(page.shadowRoot!.querySelector("mc-pack-detail")).not.toBeNull();
    expect(page.shadowRoot!.querySelector(".browse")).toBeNull();
    expect(page.shadowRoot!.querySelector("mc-mod-notice")).not.toBeNull();
    page.remove();
  });

  it("offers the scrollers the pad's stick moves from whichever list is on screen", async () => {
    const page = await mountPage(model());
    await Promise.all(
      [...page.shadowRoot!.querySelectorAll<HTMLElement & { updateComplete: Promise<unknown> }>("mc-pack-grid")].map(
        (el) => el.updateComplete,
      ),
    );
    expect(page.scrollers.map((s) => s.getAttribute("data-key"))).toEqual(["list:grid"]);
    page.remove();
  });

  it("draws nothing without a model", async () => {
    const page = document.createElement("mc-mod-store-page");
    document.body.append(page);
    await page.updateComplete;
    expect(page.shadowRoot!.children.length).toBe(0);
    page.remove();
  });
});
