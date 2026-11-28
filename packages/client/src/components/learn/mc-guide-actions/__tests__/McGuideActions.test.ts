// @vitest-environment happy-dom
import "@mc/ui";
import { afterEach, describe, expect, it } from "vitest";
import "../mc-guide-actions";
import type { LearnEventDetail } from "../../shared/learn-events.types";

afterEach(() => document.body.replaceChildren());

async function actions(showBack: boolean) {
  const el = document.createElement("mc-guide-actions");
  el.suitLabel = "Suit up";
  el.backLabel = "Back";
  el.showBack = showBack;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-guide-actions", () => {
  it("has Suit up and, wide, Back as stops, and raises their events", async () => {
    const el = await actions(true);
    const heard: LearnEventDetail[] = [];
    el.addEventListener("mc-learn", (e) => heard.push(e.detail));
    const root = el.shadowRoot!;
    root.querySelector<HTMLElement>('[data-stop="suit-up"]')!.click();
    root.querySelector<HTMLElement>('[data-stop="back"]')!.click();
    expect(heard).toEqual([{ type: "suit-up" }, { type: "back" }]);
  });

  it("draws no Back on a narrow screen", async () => {
    const el = await actions(false);
    expect(el.shadowRoot!.querySelector('[data-stop="back"]')).toBeNull();
    expect(el.shadowRoot!.querySelector('[data-stop="suit-up"]')).not.toBeNull();
  });
});
