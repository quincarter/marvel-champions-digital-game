// @vitest-environment happy-dom
import "@mc/ui";
import { afterEach, describe, expect, it } from "vitest";
import "../mc-win-actions";
import type { LearnEventDetail } from "../../shared/learn-events.types";

afterEach(() => document.body.replaceChildren());

async function actions(starting = false) {
  const el = document.createElement("mc-win-actions");
  el.tellLabel = "Tell me more";
  el.startLabel = starting ? "Suiting up…" : "Start the fight ▸";
  el.starting = starting;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-win-actions", () => {
  it("has the two stops and raises tell-more and start when they are pressed", async () => {
    const el = await actions();
    const heard: LearnEventDetail[] = [];
    el.addEventListener("mc-learn", (e) => heard.push(e.detail));
    const root = el.shadowRoot!;
    root.querySelector<HTMLElement>('[data-stop="tell-me-more"]')!.click();
    root.querySelector<HTMLElement>('[data-stop="start-the-fight"]')!.click();
    expect(heard).toEqual([{ type: "tell-more" }, { type: "start" }]);
  });

  it("dims Start and takes it out of the route while the game is being made", async () => {
    const el = await actions(true);
    const root = el.shadowRoot!;
    expect(root.querySelector('[data-stop="start-the-fight"]')).toBeNull();
    expect(root.querySelector(".start")!.hasAttribute("disabled")).toBe(true);
    expect(root.querySelector(".start")!.getAttribute("label")).toBeNull();
    expect((root.querySelector(".start") as HTMLElement & { label: string }).label).toBe("Suiting up…");
  });
});
