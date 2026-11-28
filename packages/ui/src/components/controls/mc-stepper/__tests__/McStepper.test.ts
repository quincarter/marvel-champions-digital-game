// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../mc-stepper";
import type { PressDetail } from "../../../../shared/press/press.types";

afterEach(() => document.body.replaceChildren());

async function stepper(set: (el: HTMLElementTagNameMap["mc-stepper"]) => void) {
  const el = document.createElement("mc-stepper");
  set(el);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-stepper", () => {
  it("draws an arrow either side of the choice, each a focus stop that raises its own action", async () => {
    const el = await stepper((s) => {
      s.label = "Spider-Man · 4 games";
      s.prevStop = "hero:previous";
      s.nextStop = "hero:next";
      s.prevAction = { dir: -1 };
      s.nextAction = { dir: 1 };
    });
    const chips = [...el.shadowRoot!.querySelectorAll("mc-chip")];
    expect(chips.map((c) => c.getAttribute("data-stop"))).toEqual(["hero:previous", "", "hero:next"]);
    expect(chips[1]!.getAttribute("label")).toBe("Spider-Man · 4 games");
    const seen: PressDetail[] = [];
    el.addEventListener("mc-pressed", (e) => seen.push(e.detail));
    (chips[2] as HTMLElement & { press(): void }).press();
    (chips[0] as HTMLElement & { press(): void }).press();
    expect(seen.map((d) => d.action)).toEqual([{ dir: 1 }, { dir: -1 }]);
  });

  it("stands alone with one choice: no arrows", async () => {
    const el = await stepper((s) => {
      s.label = "Only one";
      s.several = false;
    });
    expect(el.shadowRoot!.querySelectorAll("mc-chip")).toHaveLength(1);
  });

  it("names the middle chip as a stop when it has one", async () => {
    const el = await stepper((s) => {
      s.nameStop = "hero:01001a";
    });
    expect(el.shadowRoot!.querySelector(".name")!.getAttribute("data-stop")).toBe("hero:01001a");
  });
});
