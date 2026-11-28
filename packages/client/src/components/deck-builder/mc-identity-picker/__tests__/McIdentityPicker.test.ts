// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { builderEvents, inner, mount, press, stop, stopKeys } from "../../shared/test-support.js";
import "../mc-identity-picker.js";
import type { McIdentityPicker } from "../McIdentityPicker.js";
import type { IdentityPickerModel } from "../mc-identity-picker.types.js";

afterEach(() => document.body.replaceChildren());

const model = (over: Partial<IdentityPickerModel> = {}): IdentityPickerModel => ({
  label: "Pick a hero",
  search: { text: "", placeholder: "Search heroes", clearLabel: "Clear" },
  tiles: [
    { id: "01001a", name: "Spider-Man", picture: { src: null } },
    { id: "01010a", name: "Captain Marvel", picture: { src: null } },
  ],
  empty: null,
  tileMin: 170,
  ...over,
});

describe("mc-identity-picker", () => {
  it("names the search and every tile by the stop keys the specs and the pad route use", async () => {
    const el = await mount<McIdentityPicker>("mc-identity-picker", { model: model() });
    expect(stopKeys(el)).toEqual(["identity-search", "identity:01001a", "identity:01010a"]);
  });

  it("says pick-hero for a pressed tile and identity-search for the accepted text", async () => {
    const el = await mount<McIdentityPicker>("mc-identity-picker", { model: model() });
    const seen = builderEvents(el);
    press(stop(el, "identity:01010a"));
    inner<HTMLElement>(el, "mc-search-field")!.dispatchEvent(
      new CustomEvent("mc-search", { detail: { value: "cap", immediate: false }, bubbles: true, composed: true }),
    );
    expect(seen).toEqual([
      { type: "pick-hero", id: "01010a" },
      { type: "identity-search", text: "cap" },
    ]);
  });

  it("says why there are no tiles when nothing matches", async () => {
    const el = await mount<McIdentityPicker>("mc-identity-picker", { model: model({ tiles: [], empty: "No hero" }) });
    expect(inner(el, ".empty")!.textContent).toBe("No hero");
    expect(inner(el, ".grid")).toBeNull();
  });
});
