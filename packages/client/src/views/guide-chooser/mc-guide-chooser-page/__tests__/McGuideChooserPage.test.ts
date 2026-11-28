// @vitest-environment happy-dom
import "@mc/ui";
import { afterEach, describe, expect, it } from "vitest";
import "../mc-guide-chooser-page";
import type { GuideChooserPageModel } from "../mc-guide-chooser-page.types";
import type { LearnEventDetail } from "../../../../components/learn/shared/learn-events.types";

afterEach(() => document.body.replaceChildren());

const MODEL: GuideChooserPageModel = {
  art: { picture: { src: "title.webp" }, heading: "NEW TO THE FIGHT?" },
  options: {
    subtitle: "Pick how much help you want.",
    options: (["full", "hints", "off"] as const).map((value) => ({
      value,
      label: value,
      body: `${value} body`,
      selected: value === "full",
      recommended: value === "full",
      recommendedLabel: "RECOMMENDED",
    })),
    chips: [],
  },
  actions: { suitLabel: "Suit up", backLabel: "Back", backGlyph: undefined },
};

async function page(mode: "wide" | "narrow", model: GuideChooserPageModel | null = MODEL) {
  const el = document.createElement("mc-guide-chooser-page");
  el.mode = mode;
  el.model = model;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-guide-chooser-page", () => {
  it("composes the picture, the choices and the actions, with Back only when wide", async () => {
    const wide = (await page("wide")).shadowRoot!;
    for (const tag of ["mc-guide-art", "mc-guide-options", "mc-guide-actions"])
      expect(wide.querySelectorAll(tag), tag).toHaveLength(1);
    expect(wide.querySelector("mc-guide-actions")!.hasAttribute("show-back")).toBe(true);
    const narrow = (await page("narrow")).shadowRoot!;
    expect(narrow.querySelector("mc-guide-actions")!.hasAttribute("show-back")).toBe(false);
  });

  it("draws nothing without a model", async () => {
    const el = await page("narrow", null);
    expect(el.shadowRoot!.querySelector("mc-guide-art")).toBeNull();
  });

  it("lets one mc-learn event through from Suit up", async () => {
    const el = await page("narrow");
    const heard: LearnEventDetail[] = [];
    el.addEventListener("mc-learn", (e) => heard.push(e.detail));
    el.shadowRoot!.querySelector("mc-guide-actions")!
      .shadowRoot!.querySelector<HTMLElement>('[data-stop="suit-up"]')!
      .click();
    expect(heard).toEqual([{ type: "suit-up" }]);
  });
});
