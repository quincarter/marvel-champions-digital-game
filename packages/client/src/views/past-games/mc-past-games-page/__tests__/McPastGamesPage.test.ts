// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-past-games-page.js";
import type { McPastGamesPage } from "../McPastGamesPage.js";
import type { PastGamesPageModel } from "../mc-past-games-page.types.js";
import type { PastGameDetailsModel } from "../../../../components/past-games/mc-past-game-details/mc-past-game-details.types.js";

afterEach(() => document.body.replaceChildren());

const details: PastGameDetailsModel = {
  id: "g1",
  pictures: [],
  summary: { result: "WON", tone: "won", reason: "r", title: "t", when: "w", fates: null, campaign: null },
  seats: [],
  actions: [{ action: "watch", label: "Watch" }],
  busy: false,
  closeLabel: "Close",
};

const model = (over: Partial<PastGamesPageModel> = {}): PastGamesPageModel => ({
  side: true,
  phone: false,
  bar: { backLabel: "Back", backGlyph: undefined, title: "Past games", titleDrop: 0, titleMaxRight: 0 },
  file: { label: "Open a replay file", disabled: false },
  filters: { tabs: [{ id: "all", label: "All (1)" }], selected: "all", glyph: undefined },
  search: {
    value: "",
    placeholder: "Search",
    clearLabel: "Clear",
    exportLabel: "Export",
    exportDisabled: false,
  },
  list: { rows: [], empty: "No games yet" },
  details,
  status: "",
  ...over,
});

async function mount(m: PastGamesPageModel): Promise<McPastGamesPage> {
  const el = document.createElement("mc-past-games-page");
  el.model = m;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-past-games-page", () => {
  it("composes the bar, the tabs, the search, the list and, wide, the details beside the list", async () => {
    const el = await mount(model());
    const root = el.shadowRoot!;
    for (const tag of ["mc-top-bar", "mc-past-games-filters", "mc-past-games-search", "mc-past-games-list"])
      expect(root.querySelector(tag), tag).not.toBeNull();
    expect(root.querySelector("mc-past-games-file-button")!.getAttribute("slot")).toBe("end");
    const side = root.querySelector("mc-past-game-details")!;
    expect(side.hasAttribute("popup")).toBe(false);
    expect(side.closest(".main")).not.toBeNull();
    expect(el.hasAttribute("side")).toBe(true);
  });

  it("stands the details over the whole screen as a popup when narrow", async () => {
    const el = await mount(model({ side: false, phone: true }));
    const popup = el.shadowRoot!.querySelector("mc-past-game-details")!;
    expect(popup.hasAttribute("popup")).toBe(true);
    expect(popup.closest(".main")).toBeNull();
    expect(el.hasAttribute("phone")).toBe(true);
  });

  it("shows no details without a game, and a note at the foot only while it has one", async () => {
    const el = await mount(model({ details: null, status: "Link copied" }));
    expect(el.shadowRoot!.querySelector("mc-past-game-details")).toBeNull();
    expect(el.shadowRoot!.querySelector<HTMLElement & { text: string }>("mc-toast")!.text).toBe("Link copied");
  });

  it("says back when the bar's Back is pressed", async () => {
    const el = await mount(model());
    const heard = vi.fn();
    el.addEventListener("mc-past-games", (event) => heard((event as CustomEvent).detail));
    el.shadowRoot!.querySelector("mc-top-bar")!.dispatchEvent(
      new CustomEvent("mc-press", { bubbles: true, composed: true }),
    );
    expect(heard).toHaveBeenCalledWith({ type: "back" });
  });
});
