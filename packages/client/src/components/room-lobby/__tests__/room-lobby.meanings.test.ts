// @vitest-environment happy-dom
import "@mc/ui";
import { afterEach, describe, expect, it } from "vitest";
import "../mc-lobby-button/mc-lobby-button.js";
import type { McLobbyButton } from "../mc-lobby-button/McLobbyButton.js";
import { lobbyMeanings, staleLobbyButtons } from "../room-lobby.meanings.js";

afterEach(() => document.body.replaceChildren());

async function mount(label: string): Promise<McLobbyButton> {
  const element = document.createElement("mc-lobby-button") as McLobbyButton;
  element.model = { stop: "seat:s1", label, kind: "primary", command: { type: "seat", seat: "s1", action: "ask" } };
  const host = document.createElement("div");
  host.attachShadow({ mode: "open" }).append(element);
  document.body.append(host);
  await element.updateComplete;
  return element;
}

describe("lobby meanings", () => {
  it("reads each button's meaning through shadow roots and names the ones that changed", async () => {
    const element = await mount("Ask");
    const first = lobbyMeanings(document.body);
    expect([...first.keys()]).toEqual(["seat:s1"]);
    const before = new Map([...first].map(([stop, { meaning }]) => [stop, meaning] as const));
    element.label = "Leave";
    element.command = { type: "seat", seat: "s1", action: "leave" };
    await element.updateComplete;
    expect(staleLobbyButtons(before, lobbyMeanings(document.body))).toEqual([element]);
    expect(staleLobbyButtons(new Map(), lobbyMeanings(document.body))).toEqual([]);
  });
});
