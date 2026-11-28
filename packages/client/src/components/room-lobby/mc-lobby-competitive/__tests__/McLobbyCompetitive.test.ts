// @vitest-environment happy-dom
import "@mc/ui";
import { afterEach, describe, expect, it } from "vitest";
import "../mc-lobby-competitive.js";
import type { McLobbyCompetitive } from "../McLobbyCompetitive.js";
import type { LobbyButtonModel, LobbyCompetitiveModel, LobbyEvent, LobbyTeamModel } from "../../room-lobby.types.js";

afterEach(() => document.body.replaceChildren());

const button = (key: string, label = key, selected = false): LobbyButtonModel => ({
  stop: key,
  label,
  kind: "secondary",
  selected,
  command: { type: "competitive", key },
});

const team = (id: string, mine: boolean): LobbyTeamModel => ({
  team: id,
  mine,
  title: id,
  status: "Not sealed · Not ready",
  seats: [],
  speak: null,
  seal: button(`seal:${id}`),
  ready: button(`ready:${id}`),
});

const COMP: LobbyCompetitiveModel = {
  kind: "competitive",
  title: "Teams",
  detail: "Two sides, one sealed scenario each.",
  result: null,
  sizes: [button("comp:size1", "1v1", true), button("comp:size2", "2v2")],
  teams: [team("registration", true), team("resistance", false)],
  people: {
    heading: "People",
    compact: true,
    rows: [
      { id: "p1", name: "Ana (you)", role: "HOST", device: null, platform: null, more: null, line: "Ana (you) · Host" },
    ],
  },
};

async function mount(model: LobbyCompetitiveModel): Promise<McLobbyCompetitive> {
  const element = document.createElement("mc-lobby-competitive") as McLobbyCompetitive;
  element.model = model;
  document.body.append(element);
  await element.updateComplete;
  return element;
}

const heard = (element: McLobbyCompetitive): LobbyEvent[] => {
  const seen: LobbyEvent[] = [];
  element.addEventListener("mc-room-lobby", (event) => seen.push((event as CustomEvent<LobbyEvent>).detail));
  return seen;
};

describe("mc-lobby-competitive", () => {
  it("exposes one list:seats scroller with the detail, the teams and the people", async () => {
    const element = await mount(COMP);
    const scroller = element.scroller!;
    expect(scroller.dataset.key).toBe("list:seats");
    expect(scroller.querySelector(".detail")!.textContent).toBe("Two sides, one sealed scenario each.");
    expect(scroller.querySelectorAll("mc-lobby-team")).toHaveLength(2);
    expect(scroller.querySelector("mc-lobby-people")!.model!.rows[0]!.line).toBe("Ana (you) · Host");
  });

  it("leaves the size buttons and the result out when the model has none", async () => {
    const element = await mount({ ...COMP, sizes: null });
    const root = element.shadowRoot!;
    expect(root.querySelector("mc-lobby-button-row")).toBeNull();
    expect(root.querySelector(".result")).toBeNull();
  });

  it("boxes the start result with its lines and raises Dismiss", async () => {
    const element = await mount({
      ...COMP,
      result: {
        headline: "Could not start",
        lines: ["Seat 1: deck turned down."],
        dismiss: {
          stop: "start-result-dismiss",
          label: "Dismiss",
          kind: "secondary",
          command: { type: "dismiss-result" },
        },
      },
    });
    const seen = heard(element);
    const result = element.shadowRoot!.querySelector(".result")!;
    expect(result.querySelector("h3")!.textContent).toBe("Could not start");
    expect([...result.querySelectorAll("p")].map((p) => p.textContent)).toEqual(["Seat 1: deck turned down."]);
    result.querySelector("mc-lobby-button")!.shadowRoot!.querySelector<HTMLElement>("mc-button")!.click();
    expect(seen).toEqual([{ type: "dismiss-result" }]);
  });

  it("raises the size choice as a competitive event", async () => {
    const element = await mount(COMP);
    const seen = heard(element);
    const row = element.shadowRoot!.querySelector("mc-lobby-button-row")!;
    row
      .shadowRoot!.querySelectorAll("mc-lobby-button")[1]!
      .shadowRoot!.querySelector<HTMLElement>("mc-button")!
      .click();
    expect(seen).toEqual([{ type: "competitive", key: "comp:size2" }]);
  });
});
