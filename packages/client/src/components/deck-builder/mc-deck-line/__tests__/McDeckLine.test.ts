// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { builderEvents, inner, mount, tap } from "../../shared/test-support.js";
import "../mc-deck-line.js";
import type { McDeckLine } from "../McDeckLine.js";
import type { DeckLineModel } from "../mc-deck-line.types.js";

afterEach(() => document.body.replaceChildren());

const line = (over: Partial<DeckLineModel> = {}): DeckLineModel => ({
  cardId: "01022",
  name: "Web-Swing",
  quantity: 2,
  note: null,
  minus: { aria: "Remove a copy", disabled: null },
  openOnTap: false,
  face: null,
  ...over,
});

describe("mc-deck-line", () => {
  it("reads the name, then the copies, then its own minus", async () => {
    const el = await mount<McDeckLine>("mc-deck-line", { model: line() });
    const order = [...el.shadowRoot!.querySelectorAll(".row > *")].map((e) => e.className || e.tagName.toLowerCase());
    expect(order).toEqual(["name", "qty", "mc-button"]);
    expect(inner(el, ".name")!.textContent).toBe("Web-Swing");
    expect(inner(el, ".qty")!.textContent).toBe("2");
  });

  it("removes a copy when its minus is pressed", async () => {
    const el = await mount<McDeckLine>("mc-deck-line", { model: line() });
    const seen = builderEvents(el);
    inner<HTMLElement>(el, "mc-button")!.dispatchEvent(new CustomEvent("mc-press", { bubbles: true, composed: true }));
    expect(seen).toEqual([{ type: "remove", cardId: "01022" }]);
  });

  it("opens the card on a plain tap only where the line is a campaign grant", async () => {
    const plain = await mount<McDeckLine>("mc-deck-line", { model: line() });
    const seenPlain = builderEvents(plain);
    tap(inner(plain, ".name")!);
    expect(seenPlain).toEqual([]);
    const grant = await mount<McDeckLine>("mc-deck-line", { model: line({ openOnTap: true, face: "Enhanced" }) });
    const seenGrant = builderEvents(grant);
    tap(inner(grant, ".name")!);
    expect(seenGrant).toEqual([{ type: "open", cardId: "01022", face: "Enhanced" }]);
  });

  it("dims a pinned line's minus with the reason and wraps its note", async () => {
    const el = await mount<McDeckLine>("mc-deck-line", {
      model: line({ minus: { aria: "Remove", disabled: "Granted by the campaign" }, note: "One of your 50." }),
    });
    const minus = inner<HTMLElement & { reason: string }>(el, "mc-button")!;
    expect(minus.hasAttribute("disabled")).toBe(true);
    expect(minus.reason).toBe("Granted by the campaign");
    expect(inner(el, ".note")!.textContent).toBe("One of your 50.");
  });
});
