// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-title-menu.js";

afterEach(() => document.body.replaceChildren());

describe("mc-title-menu", () => {
  it("draws one row per entry in order, each keyed as a focus stop, full or half", async () => {
    const el = document.createElement("mc-title-menu");
    el.input = {
      rows: [
        { key: "new-game", label: "Nueva partida", kind: "primary", width: "full", tall: true },
        { key: "campaign", label: "Campaña", kind: "secondary", width: "half" },
        { key: "play-online", label: "Jugar en línea", kind: "secondary", width: "half" },
      ],
    };
    document.body.append(el);
    await el.updateComplete;
    const rows = [...el.shadowRoot!.querySelectorAll("mc-title-menu-button")];
    expect(rows.map((r) => r.getAttribute("width"))).toEqual(["full", "half", "half"]);
    await Promise.all(rows.map((r) => (r as unknown as { updateComplete: Promise<unknown> }).updateComplete));
    expect(rows.map((r) => r.shadowRoot!.querySelector("mc-button")!.getAttribute("data-stop"))).toEqual([
      "new-game",
      "campaign",
      "play-online",
    ]);
  });

  it("draws nothing without an input", async () => {
    const el = document.createElement("mc-title-menu");
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("mc-title-menu-button")).toBeNull();
  });
});
