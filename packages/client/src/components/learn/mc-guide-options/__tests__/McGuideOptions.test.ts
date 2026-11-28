// @vitest-environment happy-dom
import "@mc/ui";
import { afterEach, describe, expect, it } from "vitest";
import "../mc-guide-options";
import type { GuideOptionModel } from "../../mc-guide-option/mc-guide-option.types";
import type { LearnEventDetail } from "../../shared/learn-events.types";

afterEach(() => document.body.replaceChildren());

const option = (value: GuideOptionModel["value"], extra: Partial<GuideOptionModel> = {}): GuideOptionModel => ({
  value,
  label: value,
  body: `${value} body`,
  selected: value === "full",
  recommended: value === "full",
  recommendedLabel: "RECOMMENDED",
  ...extra,
});

async function options(chips: string[] = []) {
  const el = document.createElement("mc-guide-options");
  el.subtitle = "Pick how much help you want.";
  el.options = [option("full"), option("hints"), option("off")];
  el.chips = chips;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-guide-options", () => {
  it("draws the subtitle and a radio card per level, in order", async () => {
    const el = await options();
    expect(el.shadowRoot!.querySelector(".subtitle")!.textContent).toBe("Pick how much help you want.");
    const cards = [...el.shadowRoot!.querySelectorAll("mc-guide-option")];
    expect(cards.map((card) => card.model!.value)).toEqual(["full", "hints", "off"]);
  });

  it("holds the lesson chips in the recommended card only, and none on a narrow screen", async () => {
    const wide = await options(["1 · HOW TO WIN", "2 · PAYING FOR CARDS"]);
    const cards = [...wide.shadowRoot!.querySelectorAll("mc-guide-option")];
    expect(cards[0]!.querySelectorAll("mc-stamp")).toHaveLength(2);
    expect(cards[1]!.querySelector("mc-stamp")).toBeNull();
    const narrow = await options();
    expect(narrow.shadowRoot!.querySelector(".chips")).toBeNull();
  });

  it("turns a tap on a card into one mc-learn option event", async () => {
    const el = await options();
    const heard: LearnEventDetail[] = [];
    el.addEventListener("mc-learn", (e) => heard.push(e.detail));
    el.shadowRoot!.querySelectorAll("mc-guide-option")[1]!.click();
    expect(heard).toEqual([{ type: "option", value: "hints" }]);
  });
});
