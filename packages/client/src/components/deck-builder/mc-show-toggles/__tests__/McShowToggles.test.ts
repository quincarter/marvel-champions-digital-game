// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { builderEvents, inner, mount, press, stop, stopKeys } from "../../shared/test-support.js";
import "../mc-show-toggles.js";
import type { McShowToggles } from "../McShowToggles.js";
import type { ShowTogglesModel } from "../mc-show-toggles.types.js";

afterEach(() => document.body.replaceChildren());

const model: ShowTogglesModel = {
  label: "Show",
  toggles: [
    { id: "show-hero", key: "hideHero", label: "Hero", shown: true },
    { id: "show-basic", key: "hideBasic", label: "Basic", shown: false },
  ],
  count: "128 cards",
};

describe("mc-show-toggles", () => {
  it("ticks the chip that is on, so state is never colour alone", async () => {
    const el = await mount<McShowToggles>("mc-show-toggles", { model });
    expect(stopKeys(el)).toEqual(["type:show-hero", "type:show-basic"]);
    expect((stop(el, "type:show-hero") as unknown as { label: string }).label).toBe("✓ Hero");
    expect((stop(el, "type:show-basic") as unknown as { label: string }).label).toBe("Basic");
  });

  it("flips the key it names", async () => {
    const el = await mount<McShowToggles>("mc-show-toggles", { model });
    const seen = builderEvents(el);
    press(stop(el, "type:show-basic"));
    expect(seen).toEqual([{ type: "show", key: "hideBasic" }]);
  });

  it("shows the card count only inline", async () => {
    const el = await mount<McShowToggles>("mc-show-toggles", { model });
    expect(inner(el, ".count")).toBeNull();
    el.inline = true;
    await el.updateComplete;
    expect(inner(el, ".count")!.textContent).toBe("128 cards");
  });
});
