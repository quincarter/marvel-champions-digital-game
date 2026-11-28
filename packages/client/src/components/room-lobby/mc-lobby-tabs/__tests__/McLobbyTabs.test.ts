// @vitest-environment happy-dom
import "@mc/ui";
import { afterEach, describe, expect, it } from "vitest";
import "../mc-lobby-tabs.js";
import type { McLobbyTabs } from "../McLobbyTabs.js";
import type { LobbyEvent } from "../../room-lobby.types.js";

afterEach(() => document.body.replaceChildren());

async function mount(): Promise<McLobbyTabs> {
  const element = document.createElement("mc-lobby-tabs") as McLobbyTabs;
  element.model = {
    selected: "settings",
    tabs: [
      { id: "seats", label: "People" },
      { id: "settings", label: "Settings" },
      { id: "chat", label: "Chat", badge: 2 },
    ],
  };
  document.body.append(element);
  await element.updateComplete;
  return element;
}

describe("mc-lobby-tabs", () => {
  it("raises the tab a cell names", async () => {
    const element = await mount();
    const seen: LobbyEvent[] = [];
    element.addEventListener("mc-room-lobby", (event) => seen.push((event as CustomEvent<LobbyEvent>).detail));
    const rail = element.shadowRoot!.querySelector("mc-tab-rail")!;
    rail.dispatchEvent(
      new CustomEvent("mc-activate", { detail: { key: "tab:chat", id: "chat" }, bubbles: true, composed: true }),
    );
    expect(seen).toEqual([{ type: "tab", tab: "chat" }]);
  });

  it("draws nothing without tabs", async () => {
    const element = await mount();
    element.model = { selected: "seats", tabs: [] };
    await element.updateComplete;
    expect(element.shadowRoot!.querySelector("mc-tab-rail")).toBeNull();
  });
});
