// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-player-controls.js";
import type { MusicEventDetail } from "../../shared/music-events.types.js";

afterEach(() => document.body.replaceChildren());

async function controls(set: (el: HTMLElementTagNameMap["mc-player-controls"]) => void = () => {}) {
  const el = document.createElement("mc-player-controls");
  el.shuffleLabel = "Shuffle";
  el.nextLabel = "Next";
  el.pauseLabel = "Pause";
  set(el);
  document.body.append(el);
  await el.updateComplete;
  for (const button of el.shadowRoot!.querySelectorAll<HTMLElement & { updateComplete: Promise<unknown> }>("mc-button"))
    await button.updateComplete;
  return el;
}

const stop = (el: HTMLElement, key: string): HTMLElement => el.shadowRoot!.querySelector(`[data-stop="${key}"]`)!;
const press = (button: HTMLElement) =>
  button.dispatchEvent(new CustomEvent("mc-press", { bubbles: true, composed: true }));

describe("mc-player-controls", () => {
  it("draws Shuffle, Next and Pause as focus stops, with Shuffle and Pause chosen from the properties", async () => {
    const el = await controls((c) => {
      c.shuffleOn = true;
      c.paused = true;
    });
    expect(stop(el, "shuffle").hasAttribute("selected")).toBe(true);
    expect(stop(el, "next").hasAttribute("selected")).toBe(false);
    expect(stop(el, "pause").hasAttribute("selected")).toBe(true);
  });

  it("dims Shuffle and Next with the reason, but never Pause", async () => {
    const el = await controls((c) => (c.reason = "Earn a song first"));
    expect(stop(el, "shuffle").hasAttribute("disabled")).toBe(true);
    expect(stop(el, "next").hasAttribute("disabled")).toBe(true);
    expect(stop(el, "pause").hasAttribute("disabled")).toBe(false);
  });

  it("raises one mc-music press per button, by its key", async () => {
    const el = await controls();
    const heard = vi.fn();
    el.addEventListener("mc-music", (event) => heard(event.detail satisfies MusicEventDetail));
    for (const key of ["shuffle", "next", "pause"]) press(stop(el, key));
    expect(heard.mock.calls.map(([detail]) => detail)).toEqual([
      { type: "press", key: "shuffle" },
      { type: "press", key: "next" },
      { type: "press", key: "pause" },
    ]);
  });

  it("hangs a glyph hint on a control that has one, and reflects the slider", async () => {
    const el = await controls((c) => {
      c.withSlider = true;
      c.glyphs = { pause: { specs: [], height: 20, ground: "paper", openness: 1, width: 40 } };
    });
    expect(el.hasAttribute("slider")).toBe(true);
    expect(el.shadowRoot!.querySelectorAll("mc-glyph-hint")).toHaveLength(1);
    expect(stop(el, "pause").parentElement!.style.getPropertyValue("--mc-label-shift")).toBe("24px");
  });
});
