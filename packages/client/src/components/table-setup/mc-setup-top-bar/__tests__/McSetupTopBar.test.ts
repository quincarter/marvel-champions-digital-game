// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-setup-top-bar";
import type { SetupEventDetail } from "../../shared/setup-events.types";

afterEach(() => document.body.replaceChildren());

async function make(mode: "wide" | "phone", drop = 0, max = 0) {
  const el = document.createElement("mc-setup-top-bar");
  el.mode = mode;
  el.titleDrop = drop;
  el.titleMax = max;
  document.body.append(el);
  await el.updateComplete;
  const seen: SetupEventDetail[] = [];
  el.addEventListener("mc-setup", (e) => seen.push(e.detail));
  return { el, seen };
}

describe("mc-setup-top-bar", () => {
  it("draws Back as the back stop, the title and the step, and Back raises back", async () => {
    const { el, seen } = await make("wide");
    const back = el.shadowRoot!.querySelector("mc-chip")!;
    expect(back.getAttribute("data-stop")).toBe("back");
    expect(back.getAttribute("label")).toBe("◂ Seats");
    expect(el.shadowRoot!.querySelector(".title")!.textContent).toBe("Set the table");
    expect(el.shadowRoot!.querySelector(".step")!.textContent).toBe("STEP 4 OF 4");
    back.press();
    expect(seen).toEqual([{ type: "back" }]);
  });

  it("is a plain arrow and the short step on a phone", async () => {
    const { el } = await make("phone");
    expect(el.shadowRoot!.querySelector("mc-chip")!.getAttribute("label")).toBe("◂");
    expect(el.shadowRoot!.querySelector(".step")!.textContent).toBe("4/4");
  });

  it("drops and caps the title where the dark mode tab needs room", async () => {
    const { el } = await make("wide", 18, 120);
    const style = el.shadowRoot!.querySelector(".title")!.getAttribute("style")!;
    expect(style).toContain("--drop:18px");
    expect(style).toContain("--max:120px");
    const free = await make("wide");
    expect(free.el.shadowRoot!.querySelector(".title")!.getAttribute("style")).not.toContain("--max");
  });

  it("hangs the Cancel glyph on Back when wide, and none on a phone", async () => {
    const glyph = { specs: [], height: 20, ground: "ink", openness: 1, width: 30 } as never;
    const wide = await make("wide");
    wide.el.backGlyph = glyph;
    await wide.el.updateComplete;
    expect(wide.el.shadowRoot!.querySelector("mc-glyph-hint")!.glyph).toBe(glyph);
    const phone = await make("phone");
    phone.el.backGlyph = glyph;
    await phone.el.updateComplete;
    expect(phone.el.shadowRoot!.querySelector("mc-glyph-hint")!.glyph).toBeUndefined();
  });
});
