// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { builderEvents, inner, mount, press, stop, stopKeys, tap } from "../../shared/test-support.js";
import "../mc-games-row.js";
import type { McGamesRow } from "../McGamesRow.js";
import type { GamesRowModel } from "../mc-games-row.types.js";

afterEach(() => document.body.replaceChildren());

const model = (over: Partial<GamesRowModel> = {}): GamesRowModel => ({
  cardId: "01022",
  name: "Web-Swing",
  detail: "Won with in 4 of 5 games",
  picture: { src: null },
  action: { label: "Add", kind: "add" },
  ...over,
});

describe("mc-games-row", () => {
  it("names its button by the label and the card", async () => {
    const el = await mount<McGamesRow>("mc-games-row", { model: model(), section: "try" });
    expect(stopKeys(el)).toEqual(["games:Add:01022"]);
    expect(inner(el, ".name")!.textContent).toBe("Web-Swing");
    expect(inner(el, ".detail")!.textContent).toBe("Won with in 4 of 5 games");
  });

  it("adds or removes a copy, as the deck list and the pool do", async () => {
    const add = await mount<McGamesRow>("mc-games-row", { model: model() });
    const seenAdd = builderEvents(add);
    press(stop(add, "games:Add:01022"));
    document.body.replaceChildren();
    const cut = await mount<McGamesRow>("mc-games-row", { model: model({ action: { label: "Cut", kind: "remove" } }) });
    const seenCut = builderEvents(cut);
    press(stop(cut, "games:Cut:01022"));
    expect(seenAdd).toEqual([{ type: "add", cardId: "01022" }]);
    expect(seenCut).toEqual([{ type: "remove", cardId: "01022" }]);
  });

  it("opens the card on a tap on its picture, and has no button for a card that is kept", async () => {
    const el = await mount<McGamesRow>("mc-games-row", { model: model({ action: null }) });
    const seen = builderEvents(el);
    tap(inner(el, ".art")!);
    expect(seen).toEqual([{ type: "open", cardId: "01022" }]);
    expect(stopKeys(el)).toEqual([]);
  });
});
