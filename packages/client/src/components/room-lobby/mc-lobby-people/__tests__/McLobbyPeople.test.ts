// @vitest-environment happy-dom
import "@mc/ui";
import { afterEach, describe, expect, it } from "vitest";
import "../mc-lobby-people.js";
import type { McLobbyPeople } from "../McLobbyPeople.js";
import type { LobbyPeopleModel } from "../mc-lobby-people.types.js";

afterEach(() => document.body.replaceChildren());

const PEOPLE: LobbyPeopleModel = {
  heading: "People",
  compact: false,
  rows: [
    {
      id: "p1",
      name: "Ana (you)",
      role: "HOST",
      device: "Desk PC",
      platform: "windows",
      more: "Seat 1 · Different build",
      line: "Ana (you) · Host · Seat 1",
    },
    { id: "p2", name: "Ben", role: "WATCHER", device: null, platform: null, more: null, line: "Ben · Watcher" },
  ],
};

async function mount(model: LobbyPeopleModel): Promise<McLobbyPeople> {
  const element = document.createElement("mc-lobby-people") as McLobbyPeople;
  element.model = model;
  document.body.append(element);
  await element.updateComplete;
  return element;
}

describe("mc-lobby-people", () => {
  it("draws a card per person with the role boxed and the device in words beside its icon", async () => {
    const root = (await mount(PEOPLE)).shadowRoot!;
    expect(root.querySelector("mc-section-heading")!.label).toBe("People");
    const [ana, ben] = [...root.querySelectorAll(".person")];
    expect(ana!.querySelector(".name")?.textContent).toBe("Ana (you)");
    expect(ana!.querySelector(".role")?.textContent).toBe("HOST");
    expect(ana!.querySelector(".device span")?.textContent).toBe("Desk PC");
    expect(ana!.querySelector(".device svg")).not.toBeNull();
    expect(ana!.querySelector(".more")?.textContent).toBe("Seat 1 · Different build");
    expect(ben!.querySelector(".device")).toBeNull();
    expect(ben!.querySelector(".more")).toBeNull();
  });

  it("draws one line each when compact", async () => {
    const root = (await mount({ ...PEOPLE, compact: true })).shadowRoot!;
    expect([...root.querySelectorAll(".line")].map((l) => l.textContent)).toEqual([
      "Ana (you) · Host · Seat 1",
      "Ben · Watcher",
    ]);
    expect(root.querySelector(".person")).toBeNull();
  });
});
