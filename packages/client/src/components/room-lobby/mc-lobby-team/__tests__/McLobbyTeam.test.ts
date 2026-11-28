// @vitest-environment happy-dom
import "@mc/ui";
import { afterEach, describe, expect, it } from "vitest";
import "../mc-lobby-team.js";
import type { McLobbyTeam } from "../McLobbyTeam.js";
import type { LobbyButtonModel, LobbyEvent, LobbySeatRowModel, LobbyTeamModel } from "../../room-lobby.types.js";

afterEach(() => document.body.replaceChildren());

const button = (key: string, label = key, extra: Partial<LobbyButtonModel> = {}): LobbyButtonModel => ({
  stop: key,
  label,
  kind: "secondary",
  command: { type: "competitive", key },
  ...extra,
});

const row = (id: string): LobbySeatRowModel => ({
  id,
  mine: false,
  tag: `SEAT ${id}`,
  deck: null,
  noDeck: "No deck yet",
  holder: { text: "Open", held: false, connected: false },
  requestedByMe: null,
  mismatch: null,
  action: null,
  play: null,
  give: null,
  problem: null,
  missingMods: [],
  deckButton: null,
  requests: [],
});

const TEAM: LobbyTeamModel = {
  team: "registration",
  mine: true,
  title: "Registration (you)",
  status: "Sealed · Not ready",
  seats: [
    { row: row("s1"), move: button("team:s1", "Move to Resistance") },
    { row: row("s2"), move: null },
  ],
  speak: null,
  seal: button("seal:registration", "Build for Resistance"),
  ready: button("ready:registration", "Ready"),
};

async function mount(model: LobbyTeamModel): Promise<McLobbyTeam> {
  const element = document.createElement("mc-lobby-team") as McLobbyTeam;
  element.model = model;
  document.body.append(element);
  await element.updateComplete;
  return element;
}

const heard = (element: McLobbyTeam): LobbyEvent[] => {
  const seen: LobbyEvent[] = [];
  element.addEventListener("mc-room-lobby", (event) => seen.push((event as CustomEvent<LobbyEvent>).detail));
  return seen;
};

const press = (element: McLobbyTeam, stop: string): void => {
  const inner = [...element.shadowRoot!.querySelectorAll("mc-lobby-button")]
    .find((b) => (b as unknown as { stop: string }).stop === stop)!
    .shadowRoot!.querySelector<HTMLElement>("mc-button")!;
  inner.click();
};

describe("mc-lobby-team", () => {
  it("shows the title and status and marks your own side", async () => {
    const element = await mount(TEAM);
    expect(element.hasAttribute("mine")).toBe(true);
    expect(element.shadowRoot!.querySelector(".title")!.textContent).toBe("Registration (you)");
    expect(element.shadowRoot!.querySelector(".status")!.textContent).toBe("Sealed · Not ready");
  });

  it("draws a seat row per seat and a move button only where the model has one", async () => {
    const element = await mount(TEAM);
    const seats = [...element.shadowRoot!.querySelectorAll(".seat")];
    expect(seats).toHaveLength(2);
    expect(seats[0]!.querySelector("mc-lobby-button")).not.toBeNull();
    expect(seats[1]!.querySelector("mc-lobby-button")).toBeNull();
  });

  it("leaves speak out unless the host has it", async () => {
    const element = await mount(TEAM);
    expect(element.shadowRoot!.querySelector(".actions")!.querySelectorAll("mc-lobby-button")).toHaveLength(2);
    element.model = { ...TEAM, speak: button("speak:registration", "Speak for Registration") };
    await element.updateComplete;
    expect(element.shadowRoot!.querySelector(".actions")!.querySelectorAll("mc-lobby-button")).toHaveLength(3);
  });

  it("raises each button's command as a competitive event", async () => {
    const element = await mount(TEAM);
    const seen = heard(element);
    press(element, "team:s1");
    press(element, "seal:registration");
    press(element, "ready:registration");
    expect(seen).toEqual([
      { type: "competitive", key: "team:s1" },
      { type: "competitive", key: "seal:registration" },
      { type: "competitive", key: "ready:registration" },
    ]);
  });

  it("says why a blocked Ready cannot be pressed", async () => {
    const element = await mount({
      ...TEAM,
      ready: button("ready:registration", "Ready", { enabled: false, reason: "Seal a scenario first." }),
    });
    const seen = heard(element);
    press(element, "ready:registration");
    expect(seen).toEqual([{ type: "blocked", reason: "Seal a scenario first." }]);
  });
});
