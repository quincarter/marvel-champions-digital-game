// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-trophy-room-page.js";
import type { McTrophyRoomPage } from "../McTrophyRoomPage.js";
import type { TrophyRoomPageModel } from "../mc-trophy-room-page.types.js";

afterEach(() => document.body.replaceChildren());

const model = (over: Partial<TrophyRoomPageModel> = {}): TrophyRoomPageModel => ({
  phone: false,
  bar: { backLabel: "Title", backGlyph: undefined, title: "Trophy Room" },
  stats: { label: "Your stats", glyph: undefined },
  header: {
    rankLabel: "Rank 1 of 9",
    title: "Rookie",
    pointsLabel: "0 lifetime points",
    fraction: 0,
    nextLabel: "100 to Hero",
    earnedLabel: "0 of 10 achievements",
  },
  filters: {
    open: false,
    toggleLabel: "▸ Sort: Category ▲",
    expandLabel: "Expand all",
    toggleGlyph: undefined,
    expandGlyph: undefined,
    sorts: [],
    sort: "category",
    descending: false,
    ascendingLabel: "Ascending ▲",
    descendingLabel: "Descending ▼",
  },
  list: {
    rows: [{ kind: "section", id: "wins", title: "Battles won", count: "0 of 1", expanded: false }],
    groupLabels: {},
  },
  sheet: null,
  ...over,
});

async function mount(m: TrophyRoomPageModel): Promise<McTrophyRoomPage> {
  const el = document.createElement("mc-trophy-room-page");
  el.model = m;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-trophy-room-page", () => {
  it("composes the bar with Your stats in its end slot, the rank, the filters and the list", async () => {
    const el = await mount(model());
    const root = el.shadowRoot!;
    for (const tag of ["mc-top-bar", "mc-trophy-rank", "mc-trophy-filters", "mc-trophy-list"])
      expect(root.querySelector(tag), tag).not.toBeNull();
    expect(root.querySelector<HTMLElement>('[data-stop="stats"]')!.getAttribute("slot")).toBe("end");
    expect(root.querySelector("mc-trophy-sheet")).toBeNull();
  });

  it("covers the page with the achievement's sheet while one is open", async () => {
    const el = await mount(
      model({
        sheet: { name: "Ten wins", facts: "LOCKED", detail: "Win.", closeLabel: "Close", closeGlyph: undefined },
      }),
    );
    expect(el.shadowRoot!.querySelector("mc-trophy-sheet")).not.toBeNull();
  });

  it("says back from the bar and stats from the stats button, and the stats press is not also a back", async () => {
    const el = await mount(model());
    const heard = vi.fn();
    el.addEventListener("mc-trophy-room", (event) => heard((event as CustomEvent).detail));
    el.shadowRoot!.querySelector("mc-top-bar")!.dispatchEvent(
      new CustomEvent("mc-press", { bubbles: true, composed: true }),
    );
    el.shadowRoot!.querySelector<HTMLElement>('[data-stop="stats"]')!.dispatchEvent(
      new CustomEvent("mc-press", { bubbles: true, composed: true }),
    );
    expect(heard.mock.calls.map((call) => call[0])).toEqual([{ type: "back" }, { type: "stats" }]);
  });

  it("reflects the phone layout", async () => {
    const el = await mount(model({ phone: true }));
    expect(el.hasAttribute("phone")).toBe(true);
  });
});
