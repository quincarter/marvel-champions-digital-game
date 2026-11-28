// @vitest-environment happy-dom
import "@mc/ui";
import { afterEach, describe, expect, it } from "vitest";
import "../mc-how-to-win-page";
import type { HowToWinPageModel } from "../mc-how-to-win-page.types";
import type { WinCardModel } from "../../../../components/learn/mc-win-cards/mc-win-cards.types";
import type { LearnEventDetail } from "../../../../components/learn/shared/learn-events.types";

afterEach(() => document.body.replaceChildren());

const card = (key: string): WinCardModel => ({
  tag: key === "win" ? "WIN" : "LOSE",
  tone: key === "win" ? "heal" : "red",
  heading: key,
  cardId: key,
  face: undefined,
  picture: { src: `${key}.webp` },
  art: "portrait",
  scanKey: `scan:${key}`,
  body: `${key} words`,
});

const MODEL: HowToWinPageModel = {
  header: {
    heading: "LESSON 1 OF 5",
    closeLabel: "Back",
    glyph: undefined,
    ticks: { count: 5, filled: 1, label: "Lesson 1 of 5" },
  },
  title: { first: "ONE WAY TO WIN.", second: "TWO WAYS TO LOSE." },
  cards: { win: card("win"), scheme: card("scheme"), hero: card("hero") },
  round: { label: "EVERY ROUND", steps: ["YOU ACT & DRAW UP", "VILLAIN ACTS"] },
  actions: { tellLabel: "Tell me more", startLabel: "Start the fight ▸", starting: false },
};

async function page() {
  const el = document.createElement("mc-how-to-win-page");
  el.mode = "wide";
  el.model = MODEL;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-how-to-win-page", () => {
  it("composes the header, the headline, the cards, the strip and the actions", async () => {
    const root = (await page()).shadowRoot!;
    for (const tag of ["mc-top-bar", "mc-win-title", "mc-win-cards", "mc-round-strip", "mc-win-actions"])
      expect(root.querySelectorAll(tag), tag).toHaveLength(1);
    expect(root.querySelector("mc-win-cards")!.getAttribute("mode")).toBe("wide");
    expect(root.querySelector("mc-top-bar")!.heading).toBe("LESSON 1 OF 5");
  });

  it("draws nothing without a model", async () => {
    const el = document.createElement("mc-how-to-win-page");
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("mc-win-cards")).toBeNull();
  });

  it("lets one mc-learn event through from the actions", async () => {
    const el = await page();
    const heard: LearnEventDetail[] = [];
    el.addEventListener("mc-learn", (e) => heard.push(e.detail));
    const actions = el.shadowRoot!.querySelector("mc-win-actions")!;
    actions.shadowRoot!.querySelector<HTMLElement>('[data-stop="start-the-fight"]')!.click();
    expect(heard).toEqual([{ type: "start" }]);
    expect(el.closeTip()).toBe(false);
  });
});
