// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-civil-sides.js";
import type { McCivilSides } from "../McCivilSides.js";

afterEach(() => document.body.replaceChildren());

async function mount(): Promise<McCivilSides> {
  const el = document.createElement("mc-civil-sides");
  el.sides = [
    {
      side: "a",
      name: "Registration",
      action: "civil:side:a",
      selected: true,
      leaderNames: [],
      leaders: [{ scenarioId: "s", cardId: "c", name: "Iron Man" }],
    },
    { side: "b", name: "Resistance", action: "civil:side:b", selected: false, leaderNames: [], leaders: [] },
  ] as never;
  el.pictures = { leader: () => ({ src: null }), face: () => ({ src: null }), back: { src: null } };
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-civil-sides", () => {
  it("renders what it is given", async () => {
    const el = await mount();
    const root = el.shadowRoot!;
    expect(root.querySelectorAll("mc-press-card").length).toBe(2);
    expect(root.querySelector(".shape.square")).not.toBeNull();
    expect(root.querySelector(".shape.triangle")).not.toBeNull();
    expect(root.querySelector("figcaption")!.textContent).toBe("Iron Man");
  });
});
