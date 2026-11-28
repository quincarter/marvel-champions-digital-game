// @vitest-environment happy-dom
import "@mc/ui";
import { afterEach, describe, expect, it } from "vitest";
import "../mc-lobby-chat.js";
import type { McLobbyChat } from "../McLobbyChat.js";
import type { LobbyButtonModel, LobbyChatModel, LobbyEvent } from "../../room-lobby.types.js";

afterEach(() => document.body.replaceChildren());

const button = (stop: string, what: "open" | "close" | "popout" | "bring-back"): LobbyButtonModel => ({
  stop,
  label: stop,
  kind: "secondary",
  command: { type: "chat", what },
});

const model = (over: Partial<LobbyChatModel> = {}): LobbyChatModel => ({
  title: "Chat",
  floating: false,
  enabled: true,
  off: "Chat is off.",
  popped: false,
  poppedText: "Chat is in its own window.",
  bringBack: button("chat-bring-back", "bring-back"),
  popBlocked: null,
  popout: null,
  close: null,
  lines: { lines: [{ id: "0", who: "Ava", text: "hi", mine: false }], empty: "Nobody yet", toEnd: 1 },
  compose: { value: "draft", placeholder: "Say something", sendLabel: "Send", disabled: false },
  ...over,
});

async function mount(m: LobbyChatModel | null): Promise<McLobbyChat> {
  const element = document.createElement("mc-lobby-chat") as McLobbyChat;
  element.model = m;
  document.body.append(element);
  await element.updateComplete;
  return element;
}

const stopsOf = (element: McLobbyChat): string[] =>
  [...element.shadowRoot!.querySelectorAll("mc-lobby-button")].map((b) => (b as HTMLElement & { stop: string }).stop);

describe("mc-lobby-chat", () => {
  it("composes the lines (list:chat) and the compose row with the lobby's stop names", async () => {
    const element = await mount(model());
    const lines = element.shadowRoot!.querySelector("mc-chat-lines")!;
    await (lines as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    expect(lines.shadowRoot!.querySelector(".line")!.textContent!.trim()).toBe("Ava: hi");
    expect(element.scroller!.dataset.key).toBe("list:chat");
    expect(element.compose!.fieldStop).toBe("chat-field");
    expect(element.compose!.sendStop).toBe("chat-send");
    expect(element.compose!.value).toBe("draft");
  });

  it("keeps the same compose element when a line arrives", async () => {
    const element = await mount(model());
    const before = element.compose;
    element.model = model({ lines: { lines: [], empty: "Nobody yet", toEnd: 2 } });
    await element.updateComplete;
    expect(element.compose).toBe(before);
  });

  it("marks the floating panel and shows Close and Pop out only when the model gives them", async () => {
    const plain = await mount(model());
    expect(plain.hasAttribute("floating")).toBe(false);
    expect(stopsOf(plain)).toEqual([]);
    const floating = await mount(
      model({ floating: true, popout: button("chat-popout", "popout"), close: button("chat-close", "close") }),
    );
    expect(floating.hasAttribute("floating")).toBe(true);
    expect(stopsOf(floating)).toEqual(["chat-popout", "chat-close"]);
  });

  it("raises a window button's command as one mc-room-lobby event", async () => {
    const element = await mount(model({ close: button("chat-close", "close") }));
    const seen: LobbyEvent[] = [];
    element.addEventListener("mc-room-lobby", (event) => seen.push((event as CustomEvent<LobbyEvent>).detail));
    element.shadowRoot!.querySelector("mc-lobby-button")!.shadowRoot!.querySelector<HTMLElement>("mc-button")!.click();
    expect(seen).toEqual([{ type: "chat", what: "close" }]);
  });

  it("lets the compose row's send through", async () => {
    const element = await mount(model());
    const seen: unknown[] = [];
    element.addEventListener("mc-room-chat", (event) => seen.push((event as CustomEvent).detail));
    element.compose!.dispatchEvent(
      new CustomEvent("mc-room-chat", { detail: { type: "send", via: "enter" }, bubbles: true, composed: true }),
    );
    expect(seen).toEqual([{ type: "send", via: "enter" }]);
  });

  it("shows only the off words when chat is off", async () => {
    const element = await mount(model({ enabled: false, close: button("chat-close", "close") }));
    expect(element.shadowRoot!.querySelector(".words")!.textContent).toBe("Chat is off.");
    expect(element.compose).toBeNull();
    expect(element.scroller).toBeNull();
    expect(stopsOf(element)).toEqual(["chat-close"]);
  });

  it("shows only the popped words and Bring back while the chat is in its own window", async () => {
    const element = await mount(model({ popped: true, popout: button("chat-popout", "popout") }));
    expect(element.shadowRoot!.querySelector(".words")!.textContent).toBe("Chat is in its own window.");
    expect(element.compose).toBeNull();
    expect(stopsOf(element)).toEqual(["chat-bring-back"]);
  });

  it("says when the browser blocked the pop-out", async () => {
    const element = await mount(model({ popBlocked: "Allow pop-ups." }));
    expect(element.shadowRoot!.querySelector(".blocked")!.textContent).toBe("Allow pop-ups.");
  });
});
