// @vitest-environment happy-dom
import "@mc/ui";
import { afterEach, describe, expect, it } from "vitest";
import "../mc-lobby-plan.js";
import type { McLobbyPlan } from "../McLobbyPlan.js";
import type { LobbyPlanModel } from "../mc-lobby-plan.types.js";

afterEach(() => document.body.replaceChildren());

const PLAN: LobbyPlanModel = {
  heading: "The table",
  facts: "Expert difficulty · Heroic 2",
  items: [
    { key: "villain", name: "VILLAIN · Rhino", picture: { src: "/rhino.png" }, cardId: "01094", face: "front" },
    { key: "set:bomb", name: "Bomb Scare", picture: { src: null, missing: "No picture" } },
  ],
  noSets: null,
};

async function mount(model: LobbyPlanModel | null): Promise<McLobbyPlan> {
  const element = document.createElement("mc-lobby-plan") as McLobbyPlan;
  element.model = model;
  document.body.append(element);
  await element.updateComplete;
  return element;
}

const enter = (target: Element): void => {
  const event = new Event("pointerenter") as Event & { pointerType?: string };
  event.pointerType = "mouse";
  target.dispatchEvent(event);
};

describe("mc-lobby-plan", () => {
  it("draws nothing without a plan", async () => {
    const element = await mount(null);
    expect(element.shadowRoot!.querySelector(".grid")).toBeNull();
  });

  it("shows the facts, each item's picture and name, and the no-sets line when it has one", async () => {
    const element = await mount({ ...PLAN, noSets: "No modular set" });
    const root = element.shadowRoot!;
    expect(root.querySelector("mc-section-heading")!.label).toBe("The table");
    expect(root.querySelector(".facts")?.textContent).toBe("Expert difficulty · Heroic 2");
    expect([...root.querySelectorAll(".name")].map((n) => n.textContent)).toEqual(["VILLAIN · Rhino", "Bomb Scare"]);
    expect(root.querySelector(".none")?.textContent).toBe("No modular set");
  });

  it("raises the card hover for a picture with a card, with its face, and none for one without", async () => {
    const element = await mount(PLAN);
    const seen: unknown[] = [];
    element.addEventListener("mc-card-hover", (event) => {
      const { cardId, face } = (event as CustomEvent).detail;
      seen.push({ cardId, face });
    });
    const [villain, set] = [...element.shadowRoot!.querySelectorAll("mc-picture-tile")];
    enter(villain!);
    enter(set!);
    expect(seen).toEqual([{ cardId: "01094", face: "front" }]);
  });
});
