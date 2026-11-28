// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import type { FilterChip } from "@mc/ui";
import "../mc-seats-chips.js";
import type { McSeatsChips } from "../McSeatsChips.js";
import type { SeatsEvent } from "../../seats.types.js";
import { settle, stop, stopKeys } from "../../mc-seats-filters/__tests__/kit.js";

afterEach(() => document.body.replaceChildren());

const chips: FilterChip[] = [
  {
    id: "aspect:leadership",
    label: "Leadership",
    selected: true,
    tint: { fill: "#0a0", ink: "#fff" },
    info: { open: true, label: "About Leadership" },
  },
  { id: "playable-now", label: "Playable now", selected: false, disabled: "Nothing to play yet" },
];

async function mount(set: Partial<McSeatsChips> = {}): Promise<{ element: McSeatsChips; seen: SeatsEvent[] }> {
  const element = document.createElement("mc-seats-chips") as McSeatsChips;
  const seen: SeatsEvent[] = [];
  element.addEventListener("mc-seats", (event) => seen.push((event as CustomEvent<SeatsEvent>).detail));
  Object.assign(element, { chips, ...set });
  document.body.append(element);
  await settle(element);
  return { element, seen };
}

describe("mc-seats-chips", () => {
  it("is a stop per chip, and the aspect chip's i is named by the aspect", async () => {
    const { element } = await mount();
    expect(stopKeys(element)).toEqual([
      "hero-chip:aspect:leadership",
      "hero-chip-info:leadership",
      "hero-chip:playable-now",
    ]);
  });

  it("raises the chip's id on a press of the body and of the i", async () => {
    const { element, seen } = await mount();
    stop(element, "hero-chip:aspect:leadership").click();
    stop(element, "hero-chip-info:leadership").click();
    expect(seen).toEqual([
      { type: "chip", id: "aspect:leadership" },
      { type: "chip-info", id: "aspect:leadership" },
    ]);
  });

  it("raises nothing from a chip that is unavailable", async () => {
    const { element, seen } = await mount();
    stop(element, "hero-chip:playable-now").click();
    expect(seen).toEqual([]);
  });

  it("hands out the i segment of a chip for a tip to point at, and none for a chip without one", async () => {
    const { element } = await mount();
    expect(await element.infoElementOf("aspect:leadership")).toBe(stop(element, "hero-chip-info:leadership"));
    expect(await element.infoElementOf("playable-now")).toBeNull();
    expect(await element.infoElementOf("aspect:unknown")).toBeNull();
  });

  it("draws nothing while the chips are folded away, and a rail when asked", async () => {
    const folded = await mount({ chips: [] });
    expect(folded.element.shadowRoot!.querySelector(".bar")).toBeNull();
    const rail = await mount({ rail: true });
    expect(rail.element.hasAttribute("rail")).toBe(true);
  });
});
