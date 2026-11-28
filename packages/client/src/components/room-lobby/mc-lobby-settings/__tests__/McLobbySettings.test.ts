// @vitest-environment happy-dom
import "@mc/ui";
import { afterEach, describe, expect, it } from "vitest";
import "../mc-lobby-settings.js";
import type { McLobbySettings } from "../McLobbySettings.js";
import type { LobbyButtonModel, LobbyEvent, LobbySettingsModel } from "../../room-lobby.types.js";

afterEach(() => document.body.replaceChildren());

const button = (stop: string, command: LobbyEvent): LobbyButtonModel => ({
  stop,
  label: stop,
  kind: "secondary",
  command,
});

const model = (over: Partial<LobbySettingsModel> = {}): LobbySettingsModel => ({
  title: "Settings",
  loading: null,
  readOnly: null,
  groups: [
    {
      id: "lead",
      heading: null,
      items: [
        {
          kind: "toggle",
          stop: "multi",
          title: "Many seats",
          detail: "One person, many seats.",
          on: true,
          onLabel: "On",
          offLabel: "Off",
          pressable: true,
          command: { type: "setting", key: "multi" },
        },
        {
          kind: "toggle",
          stop: "chat",
          title: "Chat",
          detail: "Say hello.",
          on: false,
          onLabel: "On",
          offLabel: "Off",
          pressable: false,
          command: { type: "setting", key: "chat" },
        },
      ],
    },
    {
      id: "mode",
      heading: "Game mode",
      items: [
        {
          kind: "choice",
          stop: "mode:standard",
          title: "Standard",
          detail: "Everyone on one table.",
          selected: true,
          pressable: true,
          command: { type: "setting", key: "mode:standard" },
        },
        {
          kind: "choice",
          stop: "mode:epic",
          title: "Epic",
          detail: "Several tables.",
          selected: false,
          pressable: false,
          command: { type: "setting", key: "mode:epic" },
        },
        {
          kind: "mode",
          pictures: [],
          title: "Standard",
          tagline: "One table.",
          change: button("epicmode:change", { type: "setting", key: "epicmode:change" }),
        },
      ],
    },
    {
      id: "mods",
      heading: "Mods",
      items: [
        {
          kind: "mod",
          name: "pack v1",
          state: "Missing",
          store: button("modstore:pack", { type: "mod-store", mod: "pack" }),
        },
        { kind: "text", text: "Only the host changes these.", bold: true },
      ],
    },
  ],
  ...over,
});

async function mount(m: LobbySettingsModel | null): Promise<McLobbySettings> {
  const element = document.createElement("mc-lobby-settings") as McLobbySettings;
  element.model = m;
  document.body.append(element);
  await element.updateComplete;
  return element;
}

const heard = (element: HTMLElement): LobbyEvent[] => {
  const seen: LobbyEvent[] = [];
  element.addEventListener("mc-room-lobby", (event) => seen.push((event as CustomEvent<LobbyEvent>).detail));
  return seen;
};

describe("mc-lobby-settings", () => {
  it("draws every kind of row under its group's heading, in a list:settings scroller", async () => {
    const element = await mount(model());
    const root = element.shadowRoot!;
    expect(root.querySelector(".title")!.textContent).toBe("Settings");
    expect(element.scroller!.dataset.key).toBe("list:settings");
    expect(root.querySelectorAll("mc-section-heading").length).toBe(2);
    expect(root.querySelectorAll("mc-switch-row").length).toBe(2);
    expect(root.querySelector(".mode-title")!.textContent).toBe("Standard");
    expect(root.querySelector(".mod-state")!.textContent).toBe("Missing");
    expect(root.querySelector(".text")!.hasAttribute("data-bold")).toBe(true);
  });

  it("raises a toggle's command from the host's row and nothing from a read-only one", async () => {
    const element = await mount(model());
    const seen = heard(element);
    const [host, guest] = [...element.shadowRoot!.querySelectorAll<HTMLElement & { press(): void }>("mc-switch-row")];
    expect(host!.dataset.stop).toBe("multi");
    host!.press();
    guest!.press();
    expect(seen).toEqual([{ type: "setting", key: "multi" }]);
    expect(guest!.hasAttribute("readonly")).toBe(true);
  });

  it("shows a choice as a press card for the host and drops an unchosen one nobody can press", async () => {
    const element = await mount(model());
    const root = element.shadowRoot!;
    const cards = root.querySelectorAll<HTMLElement & { press(): void }>("mc-press-card");
    expect(cards.length).toBe(1);
    const seen = heard(element);
    cards[0]!.press();
    expect(seen).toEqual([{ type: "setting", key: "mode:standard" }]);
    expect(root.textContent).not.toContain("Several tables.");
  });

  it("keeps a chosen choice for a guest as plain words", async () => {
    const guest = model({
      groups: [
        {
          id: "mode",
          heading: null,
          items: [
            {
              kind: "choice",
              stop: "mode:standard",
              title: "Standard",
              detail: "Everyone on one table.",
              selected: true,
              pressable: false,
              command: { type: "setting", key: "mode:standard" },
            },
          ],
        },
      ],
    });
    const element = await mount(guest);
    expect(element.shadowRoot!.querySelector("mc-press-card")).toBeNull();
    expect(element.shadowRoot!.querySelector(".plain-choice .pick-title")!.textContent).toBe("Standard");
  });

  it("raises the mode's Change and the Mod Store link through the relay as one event", async () => {
    const element = await mount(model());
    const seen = heard(element);
    for (const stop of ["epicmode:change", "modstore:pack"]) {
      const inner = [...element.shadowRoot!.querySelectorAll("mc-lobby-button")]
        .map((b) => b.shadowRoot!.querySelector<HTMLElement>("mc-button")!)
        .find((b) => b.dataset.stop === stop)!;
      inner.click();
    }
    expect(seen).toEqual([
      { type: "setting", key: "epicmode:change" },
      { type: "mod-store", mod: "pack" },
    ]);
  });

  it("shows only the loading line while the room has sent no settings, and the read-only note otherwise", async () => {
    const loading = await mount(model({ loading: "Connecting..." }));
    expect(loading.shadowRoot!.querySelector(".loading")!.textContent).toBe("Connecting...");
    expect(loading.shadowRoot!.querySelector("mc-switch-row")).toBeNull();
    const note = await mount(model({ readOnly: "Only the host changes these." }));
    expect(note.shadowRoot!.querySelector(".note")!.textContent).toBe("Only the host changes these.");
  });

  it("draws nothing without a model", async () => {
    const element = await mount(null);
    expect(element.scroller).toBeNull();
  });
});
