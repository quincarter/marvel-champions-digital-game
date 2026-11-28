// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { builderEvents, inner, mount, press, stop, stopKeys } from "../../shared/test-support.js";
import "../mc-aspect-picker.js";
import type { McAspectPicker } from "../McAspectPicker.js";
import type { AspectPickerModel } from "../mc-aspect-picker.types.js";

afterEach(() => document.body.replaceChildren());

const chip = (aspect: string, over = {}) => ({
  aspect,
  label: aspect.toUpperCase(),
  fill: "#c33",
  ink: "#fff",
  selected: false,
  disabled: null,
  infoLabel: `About ${aspect}`,
  infoOpen: false,
  ...over,
});

const model = (over: Partial<AspectPickerModel> = {}): AspectPickerModel => ({
  label: "Aspect",
  chips: [chip("aggression", { selected: true }), chip("justice")],
  ...over,
});

describe("mc-aspect-picker", () => {
  it("names each chip aspect:<aspect> for the pad route", async () => {
    const el = await mount<McAspectPicker>("mc-aspect-picker", { model: model() });
    expect(stopKeys(el)).toEqual(["aspect:aggression", "aspect:justice"]);
  });

  it("says which aspect was pressed, and which one's tip", async () => {
    const el = await mount<McAspectPicker>("mc-aspect-picker", { model: model() });
    const seen = builderEvents(el);
    press(stop(el, "aspect:justice"));
    const tipChip = inner(el, 'mc-tip-chip[data-aspect="justice"]')!;
    tipChip.dispatchEvent(new CustomEvent("mc-info", { detail: { key: "justice" }, bubbles: true, composed: true }));
    expect(seen).toEqual([
      { type: "aspect", aspect: "justice" },
      { type: "aspect-info", aspect: "justice" },
    ]);
  });

  it("leaves a frozen deck's chips dimmed with the reason", async () => {
    const el = await mount<McAspectPicker>("mc-aspect-picker", {
      model: model({ chips: [chip("justice", { disabled: "Frozen" })] }),
    });
    const tipChip = inner<HTMLElement & { reason: string; disabled: boolean }>(el, "mc-tip-chip")!;
    expect(tipChip.disabled).toBe(true);
    expect(tipChip.reason).toBe("Frozen");
  });

  it('finds the open tip\'s "i" segment', async () => {
    const el = await mount<McAspectPicker>("mc-aspect-picker", { model: model() });
    expect(await el.infoElementOf("justice")).not.toBeNull();
    expect(await el.infoElementOf("pool")).toBeNull();
  });
});
