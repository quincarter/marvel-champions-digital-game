// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { builderEvents, mount, press, stop, stopKeys } from "../../shared/test-support.js";
import "../mc-builder-save-bar.js";
import type { McBuilderSaveBar } from "../McBuilderSaveBar.js";

afterEach(() => document.body.replaceChildren());

describe("mc-builder-save-bar", () => {
  it("is Save alone on the wide rail, and Review then Save on a phone's Deck tab", async () => {
    const wide = await mount<McBuilderSaveBar>("mc-builder-save-bar", {
      model: { save: { label: "Save deck", disabled: null }, review: null },
    });
    expect(stopKeys(wide)).toEqual(["save"]);
    document.body.replaceChildren();
    const phone = await mount<McBuilderSaveBar>("mc-builder-save-bar", {
      model: { save: { label: "Save deck", disabled: null }, review: { label: "Review", disabled: null } },
    });
    expect(stopKeys(phone)).toEqual(["deck-review", "save"]);
  });

  it("says save and review", async () => {
    const el = await mount<McBuilderSaveBar>("mc-builder-save-bar", {
      model: { save: { label: "Save deck", disabled: null }, review: { label: "Review", disabled: null } },
    });
    const seen = builderEvents(el);
    press(stop(el, "save"));
    press(stop(el, "deck-review"));
    expect(seen).toEqual([{ type: "save" }, { type: "review" }]);
  });

  it("dims Save while a save is in flight or the campaign deck is frozen, with the reason", async () => {
    const el = await mount<McBuilderSaveBar>("mc-builder-save-bar", {
      model: { save: { label: "Saving", disabled: "Frozen" }, review: null },
    });
    const save = stop(el, "save") as HTMLElement & { reason: string };
    expect(save.hasAttribute("disabled")).toBe(true);
    expect(save.reason).toBe("Frozen");
  });
});
