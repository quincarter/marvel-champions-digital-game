// @vitest-environment happy-dom
import "@mc/ui";
import { afterEach, describe, expect, it } from "vitest";
import "../mc-lobby-chat-pill.js";
import type { McLobbyChatPill } from "../McLobbyChatPill.js";
import { unreadLabel } from "../mc-lobby-chat-pill.types.js";
import type { LobbyChatPillModel, LobbyEvent } from "../../room-lobby.types.js";

afterEach(() => document.body.replaceChildren());

const model = (over: Partial<LobbyChatPillModel> = {}): LobbyChatPillModel => ({
  open: { stop: "chat-pill", label: "Chat", kind: "primary", command: { type: "chat", what: "open" } },
  unread: 0,
  popped: false,
  poppedText: "Chat is in its own window.",
  bringBack: {
    stop: "chat-bring-back",
    label: "Bring back",
    kind: "secondary",
    command: { type: "chat", what: "bring-back" },
  },
  ...over,
});

async function mount(m: LobbyChatPillModel | null): Promise<McLobbyChatPill> {
  const element = document.createElement("mc-lobby-chat-pill") as McLobbyChatPill;
  element.model = m;
  document.body.append(element);
  await element.updateComplete;
  return element;
}

const press = (element: McLobbyChatPill): void =>
  element.shadowRoot!.querySelector("mc-lobby-button")!.shadowRoot!.querySelector<HTMLElement>("mc-button")!.click();

describe("mc-lobby-chat-pill", () => {
  it("is the Chat button on the chat-pill stop, with no badge while nothing is unread", async () => {
    const element = await mount(model());
    expect(element.shadowRoot!.querySelector(".badge")).toBeNull();
    const seen: LobbyEvent[] = [];
    element.addEventListener("mc-room-lobby", (event) => seen.push((event as CustomEvent<LobbyEvent>).detail));
    press(element);
    expect(seen).toEqual([{ type: "chat", what: "open" }]);
  });

  it("badges the unread count, 9+ past nine", async () => {
    const element = await mount(model({ unread: 3 }));
    expect(element.shadowRoot!.querySelector(".badge")!.textContent).toBe("3");
    expect(unreadLabel(12)).toBe("9+");
    expect(unreadLabel(9)).toBe("9");
  });

  it("gives way to a card with Bring back while the chat is in its own window", async () => {
    const element = await mount(model({ popped: true, unread: 4 }));
    expect(element.shadowRoot!.querySelector(".words")!.textContent).toBe("Chat is in its own window.");
    expect(element.shadowRoot!.querySelector(".badge")).toBeNull();
    const seen: LobbyEvent[] = [];
    element.addEventListener("mc-room-lobby", (event) => seen.push((event as CustomEvent<LobbyEvent>).detail));
    press(element);
    expect(seen).toEqual([{ type: "chat", what: "bring-back" }]);
  });
});
