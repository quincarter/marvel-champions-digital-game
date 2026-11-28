// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { builderEvents, inner, mount, press, stop, stopKeys } from "../../shared/test-support.js";
import "../mc-builder-tabs.js";
import type { McBuilderTabs } from "../McBuilderTabs.js";
import type { BuilderTabsModel } from "../mc-builder-tabs.types.js";

afterEach(() => document.body.replaceChildren());

const narrow: BuilderTabsModel = {
  prefix: "tab:",
  selected: "pool",
  tabs: [
    { id: "pool", label: "Pool" },
    { id: "deck", label: "Deck 15/40" },
    { id: "games", label: "From your games" },
  ],
};

describe("mc-builder-tabs", () => {
  it("names the narrow tabs tab:<id> and the rail's rail:<id>", async () => {
    const el = await mount<McBuilderTabs>("mc-builder-tabs", { model: narrow });
    expect(stopKeys(el)).toEqual(["tab:pool", "tab:deck", "tab:games"]);
    document.body.replaceChildren();
    const rail = await mount<McBuilderTabs>("mc-builder-tabs", {
      model: {
        prefix: "rail:",
        selected: "deck",
        tabs: [
          { id: "deck", label: "Your deck" },
          { id: "games", label: "Games" },
        ],
      },
    });
    expect(stopKeys(rail)).toEqual(["rail:deck", "rail:games"]);
  });

  it("says tab for the narrow strip and rail-tab for the rail", async () => {
    const el = await mount<McBuilderTabs>("mc-builder-tabs", { model: narrow });
    const seen = builderEvents(el);
    press(stop(el, "tab:deck"));
    document.body.replaceChildren();
    const rail = await mount<McBuilderTabs>("mc-builder-tabs", {
      model: {
        prefix: "rail:",
        selected: "deck",
        tabs: [
          { id: "deck", label: "Your deck" },
          { id: "games", label: "Games" },
        ],
      },
    });
    const seenRail = builderEvents(rail);
    press(stop(rail, "rail:games"));
    expect(seen).toEqual([{ type: "tab", tab: "deck" }]);
    expect(seenRail).toEqual([{ type: "rail-tab", tab: "games" }]);
  });

  it("hangs the LB / RB glyphs over the strip only when it is given one", async () => {
    const el = await mount<McBuilderTabs>("mc-builder-tabs", { model: narrow });
    expect(inner(el, ".hint")).toBeNull();
    el.model = { ...narrow, glyph: { specs: [], height: 14, ground: "paper", openness: 1 } };
    await el.updateComplete;
    expect(inner(el, ".hint")).not.toBeNull();
  });
});
