// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-deck-check-header.js";

describe("mc-deck-check-header", () => {
  it("shows the badge on the wide layout and the plain meta words on a narrow one", async () => {
    const el = document.createElement("mc-deck-check-header");
    el.title = "SPIDER-MAN — JUSTICE";
    el.badgeText = "40 CARDS · LEGAL";
    el.meta = "40 cards";
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("mc-deck-status-badge")).not.toBeNull();
    expect(el.shadowRoot!.querySelector(".meta")).toBeNull();
    el.size = "phone";
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("mc-deck-status-badge")).toBeNull();
    expect(el.shadowRoot!.querySelector(".meta")!.textContent).toBe("40 cards");
    el.remove();
  });

  it("says back when Back is pressed, and Back is a focus stop", async () => {
    const el = document.createElement("mc-deck-check-header");
    document.body.append(el);
    await el.updateComplete;
    const heard = vi.fn();
    el.addEventListener("mc-deck-check", (event) => heard(event.detail));
    const back = el.shadowRoot!.querySelector<HTMLElement>('[data-stop="back"]')!;
    back.dispatchEvent(new CustomEvent("mc-press", { bubbles: true, composed: true }));
    expect(heard).toHaveBeenCalledWith({ type: "back" });
    el.remove();
  });

  it("hangs the Cancel glyph on Back when it is given one, and slides Back's word over to make room", async () => {
    const el = document.createElement("mc-deck-check-header");
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector<HTMLElement & { glyph: unknown }>("mc-glyph-hint")!.glyph).toBeUndefined();
    el.backGlyph = { specs: [], width: 40, height: 20, ground: "ink", openness: 1 } as never;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector<HTMLElement>(".ctl")!.style.getPropertyValue("--mc-label-shift")).toBe("24px");
    el.remove();
  });
});
