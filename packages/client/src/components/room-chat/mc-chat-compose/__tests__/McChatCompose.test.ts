// @vitest-environment happy-dom
import "@mc/ui";
import { afterEach, describe, expect, it } from "vitest";
import "../mc-chat-compose.js";
import type { McChatCompose } from "../McChatCompose.js";
import type { RoomChatEvent } from "../mc-chat-compose.types.js";

afterEach(() => document.body.replaceChildren());

async function mount(over: Partial<McChatCompose> = {}): Promise<McChatCompose> {
  const el = document.createElement("mc-chat-compose") as McChatCompose;
  Object.assign(el, { placeholder: "Say something", sendLabel: "Send", ...over });
  document.body.append(el);
  await el.updateComplete;
  return el;
}

const seen = (el: McChatCompose): RoomChatEvent[] => {
  const out: RoomChatEvent[] = [];
  el.addEventListener("mc-room-chat", (event) => out.push((event as CustomEvent<RoomChatEvent>).detail));
  return out;
};

describe("mc-chat-compose", () => {
  it("names its two stops and hands the draft to the field", async () => {
    const el = await mount({ value: "hello" });
    const stops = [...el.shadowRoot!.querySelectorAll<HTMLElement>("[data-stop]")].map((p) => p.dataset.stop);
    expect(stops).toEqual(["chat-field", "chat-send"]);
    expect((el.shadowRoot!.querySelector("mc-text-field") as unknown as { value: string }).value).toBe("hello");
  });

  it("sends from Send (a keyboard click on its stop) as a button press", async () => {
    const el = await mount();
    const events = seen(el);
    el.shadowRoot!.querySelector<HTMLElement>('[data-stop="chat-send"]')!.click();
    expect(events).toEqual([{ type: "send", via: "button" }]);
  });

  it("sends on Enter in the field, and not while Send is off", async () => {
    const el = await mount();
    const events = seen(el);
    const field = el.shadowRoot!.querySelector("mc-text-field")!;
    field.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", composed: true }));
    expect(events).toEqual([{ type: "send", via: "enter" }]);
    el.disabled = true;
    await el.updateComplete;
    field.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", composed: true }));
    expect(events).toHaveLength(1);
  });
});
