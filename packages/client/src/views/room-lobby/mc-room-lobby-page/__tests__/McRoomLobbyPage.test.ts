// @vitest-environment happy-dom
import "@mc/ui";
import { afterEach, describe, expect, it } from "vitest";
import "../mc-room-lobby-page.js";
import type { McRoomLobbyPage } from "../McRoomLobbyPage.js";
import type { LobbyButtonModel, LobbyPageModel } from "../../../../components/room-lobby/room-lobby.types.js";

afterEach(() => document.body.replaceChildren());

const BUTTON: LobbyButtonModel = { stop: "x", label: "X", kind: "primary", command: { type: "copy-link" } };

const MODEL: LobbyPageModel = {
  mode: "wide",
  phone: false,
  active: "seats",
  header: {
    title: "Room",
    backLabel: "Leave",
    backName: "Leave",
    backGlyph: null,
    role: "Host",
    eyebrow: "ROOM",
    code: "ABCD",
    copy: BUTTON,
    listed: null,
    connection: null,
    hidden: false,
  },
  tabs: null,
  seats: {
    kind: "seats",
    title: "People and seats",
    host: true,
    hint: null,
    setup: null,
    seatCount: null,
    plan: null,
    note: null,
    result: null,
    noSeats: null,
    rows: [],
    people: { heading: "People", rows: [], compact: false },
  },
  settings: { title: "Settings", loading: null, readOnly: null, groups: [] },
  chat: null,
  pill: null,
  footer: { words: "Waiting", bold: false, buttons: [], hidden: false },
  compact: false,
  chatOpen: false,
};

async function mount(model: LobbyPageModel): Promise<McRoomLobbyPage> {
  const element = document.createElement("mc-room-lobby-page") as McRoomLobbyPage;
  element.model = model;
  document.body.append(element);
  await element.updateComplete;
  return element;
}

const parts = (page: McRoomLobbyPage): string[] =>
  [...page.shadowRoot!.querySelectorAll("[class]")].map((e) => e.className).filter((c) => c !== "");

describe("mc-room-lobby-page", () => {
  it("shows seats, settings and the footer on a wide layout and mirrors the mode", async () => {
    const page = await mount(MODEL);
    expect(page.getAttribute("mode")).toBe("wide");
    expect(parts(page)).toEqual(expect.arrayContaining(["header", "seats", "settings", "footer"]));
    expect(page.shadowRoot!.querySelector("mc-lobby-seats")).not.toBeNull();
  });

  it("shows one panel under the tabs on a phone", async () => {
    const page = await mount({
      ...MODEL,
      mode: "tabs",
      phone: true,
      active: "settings",
      tabs: {
        selected: "settings",
        tabs: [
          { id: "seats", label: "People" },
          { id: "settings", label: "Settings" },
        ],
      },
    });
    expect(page.shadowRoot!.querySelector("mc-lobby-tabs")).not.toBeNull();
    expect(page.shadowRoot!.querySelector("mc-lobby-settings")).not.toBeNull();
    expect(page.shadowRoot!.querySelector("mc-lobby-seats")).toBeNull();
  });

  it("keeps seats above the tabs on the stacked layout and swaps the lower panel", async () => {
    const stacked: LobbyPageModel = {
      ...MODEL,
      mode: "stack",
      active: "settings",
      tabs: {
        selected: "settings",
        tabs: [
          { id: "settings", label: "Settings" },
          { id: "chat", label: "Chat" },
        ],
      },
    };
    const page = await mount(stacked);
    expect(page.shadowRoot!.querySelector("mc-lobby-seats")).not.toBeNull();
    expect(page.shadowRoot!.querySelector("mc-lobby-settings")).not.toBeNull();
  });

  it("composes the right panel for Epic and Competitive", async () => {
    const page = await mount({
      ...MODEL,
      seats: {
        kind: "epic",
        title: null,
        hint: "",
        organizer: null,
        limitLine: null,
        tables: [],
        people: { heading: "", rows: [], compact: true },
      },
    });
    expect(page.shadowRoot!.querySelector("mc-lobby-epic")).not.toBeNull();
    expect(page.shadowRoot!.querySelector("mc-lobby-seats")).toBeNull();
  });
});
