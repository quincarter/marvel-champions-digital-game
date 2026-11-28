// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../mc-chat-lines.js";
import type { McChatLines } from "../McChatLines.js";
import type { ChatLinesModel } from "../mc-chat-lines.types.js";

afterEach(() => document.body.replaceChildren());

async function mount(model: ChatLinesModel): Promise<McChatLines> {
  const el = document.createElement("mc-chat-lines") as McChatLines;
  el.model = model;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-chat-lines", () => {
  it("says the empty words while nobody has spoken", async () => {
    const el = await mount({ lines: [], empty: "No messages yet", toEnd: 0 });
    expect(el.shadowRoot!.querySelector(".empty")!.textContent).toBe("No messages yet");
    expect(el.scroller!.getAttribute("data-key")).toBe("list:chat");
  });

  it("lists each line as who: text and marks mine in a heavier frame", async () => {
    const el = await mount({
      lines: [
        { id: "0", who: "Ava", text: "hi", mine: false },
        { id: "1", who: "Me", text: "yo", mine: true },
      ],
      empty: "",
      toEnd: 1,
    });
    const lines = [...el.shadowRoot!.querySelectorAll(".line")];
    expect(lines.map((l) => l.textContent!.trim())).toEqual(["Ava: hi", "Me: yo"]);
    expect(lines.map((l) => l.hasAttribute("data-mine"))).toEqual([false, true]);
  });

  it("takes the key it is given for its scroller", async () => {
    const el = await mount({ lines: [], empty: "", toEnd: 0 });
    el.listKey = "chat-list";
    await el.updateComplete;
    expect(el.scroller!.getAttribute("data-key")).toBe("chat-list");
  });
});
