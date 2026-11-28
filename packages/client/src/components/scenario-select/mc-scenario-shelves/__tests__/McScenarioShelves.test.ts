// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { inner, mount, selectEvents } from "../../test-support.js";
import "../mc-scenario-shelves.js";

afterEach(() => document.body.replaceChildren());

const item = (id: string) => ({
  id,
  cardId: id,
  picture: { src: null, cover: { x: 0.5, y: 0 } },
  selected: false,
  inspect: true,
  card: {
    src: null,
    focusY: 0,
    dim: false,
    chip: "",
    chipTone: "action",
    title: id,
    detail: "",
    detailTone: "meta",
    initial: id.slice(0, 1),
  },
});
const model = {
  randomRow: { drillBack: null, title: "", buttons: [{ id: "random-box", label: "Random box" }] },
  roster: {
    mode: "shelves",
    shelves: [
      { id: "core", title: "Core Set", count: "1", cover: null, open: true, seeAll: "See all", items: [item("rhino")] },
    ],
    cardWidth: 0,
    cardHeight: 0,
    gap: 12,
    contentWidth: 0,
    previousLabel: "Back",
    nextLabel: "Next",
    emptyText: null,
    clearLabel: "",
    stops: { entry: "scenario:", fold: "scenario-shelf:", clear: "scenario-clear" },
  },
};

describe("mc-scenario-shelves", () => {
  it("marks the roster's tiles and fold headers as the screen's focus stops", async () => {
    const el = await mount("mc-scenario-shelves", { model });
    const roster = inner<HTMLElement>(el, "mc-shelf-roster")!;
    const keys = [...roster.shadowRoot!.querySelectorAll<HTMLElement>("[data-stop]")].map((n) => n.dataset.stop);
    expect(keys).toContain("scenario-shelf:core");
    expect(
      roster.shadowRoot!.querySelector("mc-picture-card")!.shadowRoot!.querySelector<HTMLElement>("[data-stop]")!
        .dataset.stop,
    ).toBe("scenario:rhino");
  });

  it("re-raises the roster's tap and hold as the screen's own event, and not as its own", async () => {
    const el = await mount("mc-scenario-shelves", { model });
    const seen = selectEvents(el);
    const leaked: string[] = [];
    document.body.addEventListener("mc-activate", () => leaked.push("mc-activate"));
    const roster = inner<HTMLElement>(el, "mc-shelf-roster")!;
    roster.dispatchEvent(
      new CustomEvent("mc-activate", { detail: { key: "entry:rhino" }, bubbles: true, composed: true }),
    );
    roster.dispatchEvent(
      new CustomEvent("mc-inspect", { detail: { key: "entry:rhino" }, bubbles: true, composed: true }),
    );
    expect(seen).toEqual([
      { type: "tile", key: "entry:rhino" },
      { type: "inspect", key: "entry:rhino" },
    ]);
    expect(leaked).toEqual([]);
  });
});
