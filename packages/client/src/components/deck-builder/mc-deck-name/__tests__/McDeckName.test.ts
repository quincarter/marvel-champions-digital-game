// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { builderEvents, inner, mount, stopKeys } from "../../shared/test-support.js";
import "../mc-deck-name.js";
import type { McDeckName } from "../McDeckName.js";

afterEach(() => document.body.replaceChildren());

const model = { label: "Deck name", text: "My deck", placeholder: "Deck name", clearLabel: "Clear" };

describe("mc-deck-name", () => {
  it("is the `name` stop, holding the accepted text", async () => {
    const el = await mount<McDeckName>("mc-deck-name", { model });
    expect(stopKeys(el)).toEqual(["name"]);
    expect(inner<HTMLElement & { value: string }>(el, "mc-search-field")!.value).toBe("My deck");
  });

  it("says the typed text", async () => {
    const el = await mount<McDeckName>("mc-deck-name", { model });
    const seen = builderEvents(el);
    inner<HTMLElement>(el, "mc-search-field")!.dispatchEvent(
      new CustomEvent("mc-search", { detail: { value: "New name", immediate: false }, bubbles: true, composed: true }),
    );
    expect(seen).toEqual([{ type: "name", text: "New name" }]);
  });

  it("gives the scene the field, to put its text back", async () => {
    const el = await mount<McDeckName>("mc-deck-name", { model });
    expect(typeof el.field?.restoreValue).toBe("function");
  });
});
