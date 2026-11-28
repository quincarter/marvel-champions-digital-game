// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { builderEvents, mount, press, stop, stopKeys } from "../../shared/test-support.js";
import "../mc-builder-actions.js";
import type { McBuilderActions } from "../McBuilderActions.js";
import type { BuilderActionsModel } from "../mc-builder-actions.types.js";

afterEach(() => document.body.replaceChildren());

const model = (over: Partial<BuilderActionsModel> = {}): BuilderActionsModel => ({
  precon: { label: "Precon", disabled: null },
  clear: { label: "Clear", disabled: null },
  delete: { label: "Delete", disabled: null },
  freeze: null,
  ...over,
});

describe("mc-builder-actions", () => {
  it("names each button by the stop keys the specs use", async () => {
    const el = await mount<McBuilderActions>("mc-builder-actions", { model: model() });
    expect(stopKeys(el)).toEqual(["preconstructed", "clear", "delete"]);
  });

  it("leaves out what a campaign's deck does not have", async () => {
    const el = await mount<McBuilderActions>("mc-builder-actions", {
      model: model({ precon: null, clear: null, delete: null, freeze: { label: "Freeze deck", disabled: null } }),
    });
    expect(stopKeys(el)).toEqual(["freeze-deck"]);
  });

  it("says which action was pressed", async () => {
    const el = await mount<McBuilderActions>("mc-builder-actions", {
      model: model({ freeze: { label: "Freeze", disabled: null } }),
    });
    const seen = builderEvents(el);
    for (const key of ["preconstructed", "clear", "delete", "freeze-deck"]) press(stop(el, key));
    expect(seen.map((s) => s.type)).toEqual(["precon", "clear", "delete", "freeze"]);
  });

  it("dims a precon button with no published precon, and fills an armed Delete", async () => {
    const el = await mount<McBuilderActions>("mc-builder-actions", {
      model: model({
        precon: { label: "Precon", disabled: "No precon" },
        delete: { label: "Sure?", disabled: null, armed: true },
      }),
    });
    expect(stop(el, "preconstructed").hasAttribute("disabled")).toBe(true);
    expect(stop(el, "delete").hasAttribute("selected")).toBe(true);
  });
});
