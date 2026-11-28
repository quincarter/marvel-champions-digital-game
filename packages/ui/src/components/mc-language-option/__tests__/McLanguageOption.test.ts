import { afterEach, describe, expect, it } from "vitest";
import "../../mc-button/mc-button.js";
import "../mc-language-option.js";
import { activations, stop, tap } from "../../../shared/test-tap.js";

afterEach(() => document.body.replaceChildren());

describe("mc-language-option", () => {
  it("draws nothing without an option", async () => {
    const el = document.createElement("mc-language-option");
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("mc-button")).toBeNull();
  });

  it("marks the current language and reports a press by its key", async () => {
    const el = document.createElement("mc-language-option");
    el.option = { key: "es", label: "✓ Español", kind: "onInk", selected: true };
    document.body.append(el);
    await el.updateComplete;
    const keys = activations(el);
    expect(stop(el, "es").hasAttribute("selected")).toBe(true);
    tap(stop(el, "es"));
    expect(keys).toEqual(["es"]);
  });
});
