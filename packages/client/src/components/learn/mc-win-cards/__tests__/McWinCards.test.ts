// @vitest-environment happy-dom
import "@mc/ui";
import { afterEach, describe, expect, it } from "vitest";
import "../mc-win-cards";
import type { WinCardModel, WinCardsInput } from "../mc-win-cards.types";
import type { LearnEventDetail } from "../../shared/learn-events.types";

afterEach(() => document.body.replaceChildren());

const card = (key: string, extra: Partial<WinCardModel> = {}): WinCardModel => ({
  tag: key === "win" ? "WIN" : "LOSE",
  tone: key === "win" ? "heal" : "red",
  heading: `${key} heading`,
  cardId: `card-${key}`,
  face: undefined,
  picture: { src: `${key}.webp` },
  art: key === "scheme" ? "landscape" : "portrait",
  scanKey: `scan:${key}`,
  body: `${key} words`,
  ...extra,
});

const INPUT: WinCardsInput = {
  win: card("win"),
  scheme: card("scheme", {
    terms: {
      runs: [
        { kind: "text", text: "The plan reaches 7 " },
        { kind: "term", id: "threat", label: "threat" },
        { kind: "text", text: "." },
      ],
      tips: { threat: { heading: "Threat", body: "Pressure.", linkLabel: "Rules glossary" } },
    },
  }),
  hero: card("hero"),
};

async function cards(mode: "wide" | "narrow") {
  const el = document.createElement("mc-win-cards");
  el.mode = mode;
  el.input = INPUT;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-win-cards", () => {
  it("draws the win, scheme and hero cards, the wide win card over its words", async () => {
    const wide = await cards("wide");
    const all = [...wide.shadowRoot!.querySelectorAll("mc-win-card")];
    expect(all.map((c) => c.getAttribute("scan-key"))).toEqual(["scan:win", "scan:scheme", "scan:hero"]);
    expect(all[0]!.getAttribute("layout")).toBe("column");
    expect(all[1]!.getAttribute("layout")).toBe("row");
    const narrow = await cards("narrow");
    expect(narrow.shadowRoot!.querySelector("mc-win-card")!.getAttribute("layout")).toBe("row");
  });

  it("puts the plain words in a span and the scheme's sentence in term text with the threat term as a stop", async () => {
    const el = await cards("wide");
    const [win, scheme] = [...el.shadowRoot!.querySelectorAll("mc-win-card")];
    expect(win!.querySelector("span")!.textContent).toBe("win words");
    const text = scheme!.querySelector("mc-term-text")!;
    await text.updateComplete;
    expect(text.shadowRoot!.querySelector<HTMLElement>("mc-dotted-term")!.dataset.stop).toBe("term:threat");
  });

  it("tells the scene a tip opened and closes it on closeTip", async () => {
    const el = await cards("wide");
    const heard: LearnEventDetail[] = [];
    el.addEventListener("mc-learn", (e) => heard.push(e.detail));
    const text = el.shadowRoot!.querySelector("mc-term-text")!;
    await text.updateComplete;
    text.shadowRoot!.querySelector<HTMLElement>("mc-dotted-term")!.click();
    await text.updateComplete;
    expect(el.closeTip()).toBe(true);
    expect(el.closeTip()).toBe(false);
    expect(heard).toEqual([
      { type: "tip", open: true },
      { type: "tip", open: false },
    ]);
  });
});
