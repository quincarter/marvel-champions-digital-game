import { afterEach, describe, expect, it } from "vitest";
import "../mc-stepper";
import type { StepperPressDetail } from "../mc-stepper.types";

afterEach(() => document.body.replaceChildren());

async function stepper() {
  const el = document.createElement("mc-stepper");
  el.label = "All packs";
  el.prevStop = "pack:prev";
  el.nameStop = "pack:name";
  el.nextStop = "pack:next";
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-stepper", () => {
  it("draws three buttons carrying the focus stop keys it was given", async () => {
    const el = await stepper();
    const stops = [...el.shadowRoot!.querySelectorAll<HTMLElement>("[data-stop]")].map((b) => b.dataset.stop);
    expect(stops).toEqual(["pack:prev", "pack:name", "pack:next"]);
  });

  it("raises one mc-stepper-press per press, naming the part, and keeps the button's own event inside", async () => {
    const el = await stepper();
    const seen: StepperPressDetail[] = [];
    const leaked: Event[] = [];
    el.addEventListener("mc-stepper-press", (e) => seen.push(e.detail));
    document.body.addEventListener("mc-press", (e) => leaked.push(e));
    const buttons = el.shadowRoot!.querySelectorAll<HTMLElement>("mc-button");
    buttons[2]!.click();
    buttons[1]!.click();
    expect(seen).toEqual([{ part: "next" }, { part: "name" }]);
    expect(leaked).toHaveLength(0);
  });

  it("marks the middle chosen and each disabled part", async () => {
    const el = await stepper();
    el.selected = true;
    el.nextDisabled = true;
    await el.updateComplete;
    const buttons = el.shadowRoot!.querySelectorAll("mc-button");
    expect(buttons[1]!.hasAttribute("selected")).toBe(true);
    expect(buttons[2]!.hasAttribute("disabled")).toBe(true);
  });
});
