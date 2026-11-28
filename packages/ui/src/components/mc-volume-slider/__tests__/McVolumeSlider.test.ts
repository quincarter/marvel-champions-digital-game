import { afterEach, describe, expect, it } from "vitest";
import "../../mc-button/mc-button.js";
import "../mc-volume-slider.js";
import type { SlideDetail } from "../../../shared/popup.types.js";

afterEach(() => document.body.replaceChildren());

async function mount(value = 50) {
  const el = document.createElement("mc-volume-slider");
  el.value = value;
  el.label = `${value}%`;
  document.body.append(el);
  await el.updateComplete;
  const track = el.track!;
  track.getBoundingClientRect = () => ({ left: 0, right: 118, top: 0, bottom: 40, width: 118, height: 40 }) as DOMRect;
  const slides: SlideDetail[] = [];
  el.addEventListener("mc-slide", (event) => slides.push((event as CustomEvent<SlideDetail>).detail));
  return { el, track, slides };
}

const at = (type: string, x: number, y: number, init: PointerEventInit = {}) =>
  new PointerEvent(type, { bubbles: true, composed: true, clientX: x, clientY: y, pointerId: 1, buttons: 1, ...init });

describe("mc-volume-slider", () => {
  it("puts the knob at its value and reads the percent", async () => {
    const { el } = await mount(30);
    expect(el.style.getPropertyValue("--share")).toBe("0.3");
    expect(el.shadowRoot!.querySelector(".label")!.textContent).toBe("30%");
  });

  it("reports a drag as slides, and its release as the committed one", async () => {
    const { track, slides } = await mount();
    track.dispatchEvent(at("pointerdown", 20, 20));
    track.dispatchEvent(at("pointermove", 40, 21));
    track.dispatchEvent(at("pointermove", 60, 21));
    track.dispatchEvent(at("pointerup", 68, 21));
    expect(slides.map((s) => s.commit)).toEqual([false, false, true]);
    expect(slides.at(-1)!.share).toBeCloseTo(0.6, 1);
  });

  it("leaves an up-and-down swipe to the page's scroll and reports nothing", async () => {
    const { track, slides } = await mount();
    track.dispatchEvent(at("pointerdown", 40, 5));
    track.dispatchEvent(at("pointermove", 41, 40));
    track.dispatchEvent(at("pointerup", 41, 90));
    expect(slides).toEqual([]);
  });

  it("forgets a press that is cancelled (the panel was covered)", async () => {
    const { el, track, slides } = await mount();
    track.dispatchEvent(at("pointerdown", 40, 20));
    el.cancelPress();
    track.dispatchEvent(at("pointerup", 40, 20));
    expect(slides).toEqual([]);
  });

  it("keeps the volume stop keys unless a screen names its own (the Controls hint size)", async () => {
    const { el } = await mount();
    const stops = (): (string | null)[] =>
      [...el.shadowRoot!.querySelectorAll("mc-button")].map((b) => b.getAttribute("data-stop"));
    expect(stops()).toEqual(["volume-down", "volume-up"]);
    el.downStop = "hint-size:down";
    el.upStop = "hint-size:up";
    await el.updateComplete;
    expect(stops()).toEqual(["hint-size:down", "hint-size:up"]);
  });

  it("is a settings row with a heading, detail and a preview slot, and the bare slider without", async () => {
    const { el } = await mount();
    expect(el.shadowRoot!.querySelector(".words")).toBeNull();
    el.heading = "Hint size";
    el.detail = "How big the hints are.";
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".heading")!.textContent).toBe("Hint size");
    expect(el.shadowRoot!.querySelector("slot[name='preview']")).not.toBeNull();
    expect(el.track).not.toBeNull();
    expect(el.hasAttribute("heading")).toBe(true);
  });
});
