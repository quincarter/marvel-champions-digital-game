// @vitest-environment happy-dom
import "@mc/ui";
import { afterEach, describe, expect, it } from "vitest";
import "../mc-continue-bar";
import type { LearnEventDetail } from "../../shared/learn-events.types";

afterEach(() => document.body.replaceChildren());

async function bar(starting = false) {
  const el = document.createElement("mc-continue-bar");
  el.label = starting ? "Suiting up…" : "Continue learning ▸";
  el.starting = starting;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-continue-bar", () => {
  it("is the continue-learning stop and raises continue when pressed", async () => {
    const el = await bar();
    const heard: LearnEventDetail[] = [];
    el.addEventListener("mc-learn", (e) => heard.push(e.detail));
    el.shadowRoot!.querySelector<HTMLElement>('[data-stop="continue-learning"]')!.click();
    expect(heard).toEqual([{ type: "continue" }]);
  });

  it("dims the button while the game is being made", async () => {
    const el = await bar(true);
    const button = el.shadowRoot!.querySelector("mc-button")!;
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(button.label).toBe("Suiting up…");
  });
});
