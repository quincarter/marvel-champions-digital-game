// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../mc-switch-row";
import type { PressDetail } from "../../../../shared/press/press.types";

afterEach(() => document.body.replaceChildren());

async function row(set: (el: HTMLElementTagNameMap["mc-switch-row"]) => void) {
  const el = document.createElement("mc-switch-row");
  set(el);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

const heard = (el: HTMLElement): PressDetail[] => {
  const seen: PressDetail[] = [];
  el.addEventListener("mc-pressed", (e) => seen.push(e.detail));
  return seen;
};

describe("mc-switch-row", () => {
  it("shows the title, the detail and the state in words", async () => {
    const el = await row((r) => {
      r.titleText = "Sound";
      r.detail = "Music and effects.";
      r.state = "ON";
      r.on = true;
    });
    const root = el.shadowRoot!;
    expect(root.querySelector(".title")!.textContent).toBe("Sound");
    expect(root.querySelector(".detail")!.textContent).toBe("Music and effects.");
    expect(root.querySelector(".switch")!.textContent).toBe("ON");
    expect(el.hasAttribute("on")).toBe(true);
  });

  it("raises its action on a press, and nothing when unavailable", async () => {
    const el = await row((r) => {
      r.action = { type: "table", id: "sound" };
    });
    const seen = heard(el);
    el.press();
    expect(seen).toEqual([{ action: { type: "table", id: "sound" }, hold: false }]);
    el.unavailable = true;
    await el.updateComplete;
    el.press();
    expect(seen.length).toBe(1);
  });

  it("raises nothing when readonly, and shows the state at full strength", async () => {
    const el = await row((r) => {
      r.action = { type: "table", id: "sound" };
      r.readonly = true;
      r.onpaper = true;
      r.state = "ON";
    });
    const seen = heard(el);
    el.press();
    expect(seen).toEqual([]);
    expect(el.hasAttribute("readonly")).toBe(true);
    expect(el.hasAttribute("unavailable")).toBe(false);
    expect(el.hasAttribute("onpaper")).toBe(true);
  });
});
