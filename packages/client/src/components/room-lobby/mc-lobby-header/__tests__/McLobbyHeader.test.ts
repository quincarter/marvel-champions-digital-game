// @vitest-environment happy-dom
import "@mc/ui";
import { afterEach, describe, expect, it } from "vitest";
import "../mc-lobby-header.js";
import type { McLobbyHeader } from "../McLobbyHeader.js";
import type { LobbyEvent, LobbyHeaderModel } from "../../room-lobby.types.js";

afterEach(() => document.body.replaceChildren());

const MODEL: LobbyHeaderModel = {
  title: "Room",
  backLabel: "Leave",
  backName: "Leave",
  backGlyph: null,
  role: "Host",
  eyebrow: "ROOM",
  code: "ABCD",
  copy: { stop: "copy", label: "Copy link", kind: "onInk", command: { type: "copy-link" } },
  listed: { stop: "listed", label: "Live now: off", kind: "onInk", command: { type: "setting", key: "listed" } },
  connection: "Reconnecting",
  hidden: false,
};

async function mount(model: LobbyHeaderModel): Promise<McLobbyHeader> {
  const element = document.createElement("mc-lobby-header") as McLobbyHeader;
  element.model = model;
  document.body.append(element);
  await element.updateComplete;
  return element;
}

const heard = (element: McLobbyHeader): LobbyEvent[] => {
  const seen: LobbyEvent[] = [];
  element.addEventListener("mc-room-lobby", (event) => seen.push((event as CustomEvent<LobbyEvent>).detail));
  return seen;
};

const press = (element: McLobbyHeader, selector: string): void =>
  element
    .shadowRoot!.querySelector<HTMLElement>(selector)!
    .shadowRoot!.querySelector<HTMLElement>("mc-button")!
    .click();

describe("mc-lobby-header", () => {
  it("shows the code and the connection line", async () => {
    const element = await mount(MODEL);
    expect(element.shadowRoot!.querySelector(".code")!.textContent).toBe("ABCD");
    expect(element.shadowRoot!.querySelector(".connection")!.textContent).toBe("Reconnecting");
  });

  it("raises copy-link and the Live now setting through its buttons", async () => {
    const element = await mount(MODEL);
    const seen = heard(element);
    await Promise.all(
      [".copy", ".listed"].map(
        (s) =>
          (element.shadowRoot!.querySelector(s) as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete,
      ),
    );
    press(element, ".copy");
    press(element, ".listed");
    expect(seen).toEqual([{ type: "copy-link" }, { type: "setting", key: "listed" }]);
  });

  it("raises leave from the top bar and hides while the keyboard covers it", async () => {
    const element = await mount({ ...MODEL, listed: null, connection: null, hidden: true });
    const seen = heard(element);
    element
      .shadowRoot!.querySelector("mc-top-bar")!
      .dispatchEvent(new CustomEvent("mc-press", { bubbles: true, composed: true }));
    expect(seen).toEqual([{ type: "leave" }]);
    expect(element.hasAttribute("hidden")).toBe(true);
    expect(element.shadowRoot!.querySelector(".listed")).toBeNull();
  });
});
