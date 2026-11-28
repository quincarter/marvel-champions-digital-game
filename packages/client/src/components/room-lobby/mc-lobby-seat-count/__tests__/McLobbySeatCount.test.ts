// @vitest-environment happy-dom
import "@mc/ui";
import { afterEach, describe, expect, it } from "vitest";
import "../mc-lobby-seat-count.js";
import type { McLobbySeatCount } from "../McLobbySeatCount.js";
import type { LobbySeatCountModel } from "../mc-lobby-seat-count.types.js";

afterEach(() => document.body.replaceChildren());

const MODEL: LobbySeatCountModel = {
  label: "Seats: 3",
  less: {
    stop: "seats:less",
    label: "−",
    aria: "Fewer seats",
    kind: "secondary",
    command: { type: "seat-count", to: 2 },
    enabled: false,
    reason: "The last seat is taken",
  },
  more: {
    stop: "seats:more",
    label: "+",
    aria: "More seats",
    kind: "secondary",
    command: { type: "seat-count", to: 4 },
  },
  hint: "One to four seats",
};

async function mount(): Promise<McLobbySeatCount> {
  const element = document.createElement("mc-lobby-seat-count") as McLobbySeatCount;
  element.model = MODEL;
  document.body.append(element);
  await element.updateComplete;
  return element;
}

describe("mc-lobby-seat-count", () => {
  it("puts the count in the stepper and the two buttons in its arrow slots", async () => {
    const element = await mount();
    const root = element.shadowRoot!;
    const stepper = root.querySelector("mc-stepper")!;
    expect(stepper.label).toBe("Seats: 3");
    expect([...root.querySelectorAll("mc-lobby-button")].map((b) => b.getAttribute("slot"))).toEqual(["prev", "next"]);
    expect(root.querySelector(".hint")?.textContent).toBe("One to four seats");
  });

  it("raises each button's command, and the reason of a button that is off", async () => {
    const element = await mount();
    const [less, more] = [...element.shadowRoot!.querySelectorAll("mc-lobby-button")];
    await Promise.all([less!.updateComplete, more!.updateComplete]);
    const seen: unknown[] = [];
    element.addEventListener("mc-pressed", (event) => seen.push((event as CustomEvent).detail.action));
    more!.shadowRoot!.querySelector<HTMLElement>("mc-button")!.click();
    less!.shadowRoot!.querySelector<HTMLElement>("mc-button")!.click();
    expect(seen).toEqual([
      { type: "seat-count", to: 4 },
      { type: "blocked", reason: "The last seat is taken" },
    ]);
  });
});
