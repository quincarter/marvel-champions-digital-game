// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-civil-leaders.js";
import type { McCivilLeaders } from "../McCivilLeaders.js";

afterEach(() => document.body.replaceChildren());

async function mount(): Promise<McCivilLeaders> {
  const el = document.createElement("mc-civil-leaders");
  el.leaders = [
    {
      scenarioId: "s",
      cardId: "c",
      name: "Iron Man",
      word: "Leader",
      action: "civil:leader:s",
      selected: false,
      openingStage: "I",
      ownSet: "Iron Man set",
      stages: [
        {
          numeral: "I",
          hp: "10",
          hpByPlayers: [],
          face: { cardId: "c1", face: { kind: "front" }, landscape: false, name: "Iron Man" },
        },
      ],
    },
  ] as never;
  el.expertNote = "Expert uses III and IV";
  el.pictures = { leader: () => ({ src: null }), face: () => ({ src: null }), back: { src: null } };
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-civil-leaders", () => {
  it("renders what it is given", async () => {
    const el = await mount();
    const root = el.shadowRoot!;
    expect(root.querySelector(".name")!.textContent).toBe("Iron Man");
    expect(root.querySelector("mc-press-card")!.getAttribute("data-stop")).toBe("civil:leader:s");
    expect(root.querySelector(".note")!.textContent).toBe("Expert uses III and IV");
    expect((root.querySelector("mc-card-art") as unknown as { cardId: string }).cardId).toBe("c1");
  });

  it("offers Choose this leader when reading a leader that is not chosen", async () => {
    const el = await mount();
    const card = el.shadowRoot!.querySelector("mc-press-card")! as unknown as {
      holdAction: { choice?: { optionId: string } };
    };
    expect(card.holdAction.choice!.optionId).toBe("civil:leader:s");
  });
});
