import { afterEach, describe, expect, it } from "vitest";
import "../mc-dotted-term";

afterEach(() => document.body.replaceChildren());

async function term() {
  const el = document.createElement("mc-dotted-term");
  el.label = "threat";
  el.stop = "term:threat";
  el.action = "threat";
  document.body.append(el);
  await el.updateComplete;
  return el;
}

const pointer = (type: string, pointerType: string): Event => {
  const event = new Event(type);
  Object.defineProperty(event, "pointerType", { value: pointerType });
  return event;
};

describe("mc-dotted-term", () => {
  it("says its word in a span and is a stop", async () => {
    const el = await term();
    expect(el.shadowRoot!.querySelector(".word")!.textContent).toBe("threat");
    expect(el.dataset.stop).toBe("term:threat");
  });

  it("raises mc-pressed on click() and mc-term-hover for a mouse only", async () => {
    const el = await term();
    const pressed: unknown[] = [];
    const hovered: boolean[] = [];
    el.addEventListener("mc-pressed", (e) => pressed.push((e as CustomEvent).detail));
    el.addEventListener("mc-term-hover", (e) => hovered.push((e as CustomEvent<{ over: boolean }>).detail.over));
    el.click();
    el.dispatchEvent(pointer("pointerenter", "mouse"));
    el.dispatchEvent(pointer("pointerleave", "mouse"));
    el.dispatchEvent(pointer("pointerenter", "touch"));
    expect(pressed).toEqual([{ action: "threat", hold: false }]);
    expect(hovered).toEqual([true, false]);
  });
});
