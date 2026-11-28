// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { builderEvents, inner, mount, press, stop, stopKeys } from "../../shared/test-support.js";
import "../mc-deck-list.js";
import type { McDeckList } from "../McDeckList.js";
import type { DeckListModel } from "../mc-deck-list.types.js";

afterEach(() => document.body.replaceChildren());

const line = (cardId: string, name: string) => ({
  cardId,
  name,
  quantity: 1,
  note: null,
  minus: { aria: "Remove", disabled: null },
  openOnTap: false,
  face: null,
});

const model = (over: Partial<DeckListModel> = {}): DeckListModel => ({
  label: "Your deck",
  sortLabel: "Sort: Aspect",
  reviewLabel: "Review",
  reviewDisabled: false,
  groups: [
    { label: "Allies · 1", lines: [line("a1", "Ally One")] },
    { label: "Events · 2", lines: [line("e1", "Event One"), line("e2", "Event Two")] },
  ],
  ...over,
});

describe("mc-deck-list", () => {
  it("names Sort and Review as stops and lists every group's lines", async () => {
    const el = await mount<McDeckList>("mc-deck-list", { model: model() });
    expect(stopKeys(el)).toEqual(["deck-sort", "deck-review"]);
    expect(el.shadowRoot!.querySelectorAll("mc-deck-line")).toHaveLength(3);
    expect([...el.shadowRoot!.querySelectorAll(".head")].map((h) => h.textContent)).toEqual([
      "Allies · 1",
      "Events · 2",
    ]);
  });

  it("says sort and review", async () => {
    const el = await mount<McDeckList>("mc-deck-list", { model: model() });
    const seen = builderEvents(el);
    press(stop(el, "deck-sort"));
    press(stop(el, "deck-review"));
    expect(seen).toEqual([{ type: "deck-sort" }, { type: "review" }]);
  });

  it("leaves Review out when the pinned bar carries it", async () => {
    const el = await mount<McDeckList>("mc-deck-list", { model: model({ reviewLabel: null }) });
    expect(stopKeys(el)).toEqual(["deck-sort"]);
  });

  it("flows, with no scroller of its own, when told to", async () => {
    const el = await mount<McDeckList>("mc-deck-list", { model: model(), flow: true });
    expect(el.hasAttribute("flow")).toBe(true);
    expect(inner(el, ".groups")).not.toBeNull();
  });
});
