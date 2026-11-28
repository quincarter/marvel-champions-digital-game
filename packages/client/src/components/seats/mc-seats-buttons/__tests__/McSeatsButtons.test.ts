// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-seats-buttons.js";
import type { McSeatsButtons } from "../McSeatsButtons.js";
import type { SeatsButtonModel, SeatsEvent } from "../../seats.types.js";
import { settle, stop, stopKeys, tap } from "../../mc-seats-filters/__tests__/kit.js";

afterEach(() => document.body.replaceChildren());

const buttons: SeatsButtonModel[] = [
  { action: "random", label: "Random", disabled: null, selected: false },
  { action: "game-art", label: "Game art", disabled: null, selected: true },
  { action: "preconstructed", label: "Use preconstructed", disabled: "Fill a seat first", selected: false },
];

async function mount(): Promise<{ element: McSeatsButtons; seen: SeatsEvent[] }> {
  const element = document.createElement("mc-seats-buttons") as McSeatsButtons;
  const seen: SeatsEvent[] = [];
  element.addEventListener("mc-seats", (event) => seen.push((event as CustomEvent<SeatsEvent>).detail));
  element.buttons = buttons;
  document.body.append(element);
  await settle(element);
  return { element, seen };
}

describe("mc-seats-buttons", () => {
  it("is a stop per button, named as the specs name them", async () => {
    const { element } = await mount();
    expect(stopKeys(element)).toEqual(["hero-random", "hero-art", "preconstructed"]);
  });

  it("shows the art switch as chosen and a button that cannot act as dimmed with its reason", async () => {
    const { element } = await mount();
    expect(stop(element, "hero-art").hasAttribute("selected")).toBe(true);
    const dim = stop(element, "preconstructed");
    expect(dim.hasAttribute("disabled")).toBe(true);
    expect((dim as unknown as { reason: string }).reason).toBe("Fill a seat first");
  });

  it("raises the action from a tap and from Enter, a dimmed button's included (the scene explains)", async () => {
    const { element, seen } = await mount();
    tap(stop(element, "hero-random"));
    stop(element, "hero-art").click();
    stop(element, "preconstructed").click();
    expect(seen).toEqual([
      { type: "action", action: "random" },
      { type: "action", action: "game-art" },
      { type: "action", action: "preconstructed" },
    ]);
  });
});
