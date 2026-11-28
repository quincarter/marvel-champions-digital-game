// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-setup-difficulty";
import type { SetupOptionRow } from "../../../../view/setup-options";
import type { SetupEventDetail } from "../../shared/setup-events.types";
import type { DifficultyInput } from "../mc-setup-difficulty.types";

afterEach(() => document.body.replaceChildren());

/** Presses a control a query found by its attribute (typed as a plain `Element`). */
const press = (el: Element | null | undefined): void => (el as unknown as { press(): void }).press();

const input = (over: Partial<DifficultyInput> = {}): DifficultyInput => ({
  cards: [
    { id: "standard", name: "Standard", description: "Standard encounter set only." },
    { id: "expert", name: "Expert", description: "Expert set added." },
  ],
  selected: "standard",
  setChoices: [],
  optionRows: [],
  towerDefense: { offered: false, on: false, perHero: 1 },
  ...over,
});

const setRow: SetupOptionRow = {
  id: "standardSet",
  name: "Standard set",
  meta: "",
  span: 1,
  active: false,
  help: "",
  control: {
    kind: "groups",
    groups: [
      {
        label: null,
        chips: [
          { action: "standardSet:i", label: "I", selected: true, enabled: true },
          { action: "standardSet:ii", label: "II", selected: false, enabled: true },
        ],
      },
    ],
  },
};

async function section(i: DifficultyInput, mode: "wide" | "phone" = "wide") {
  const el = document.createElement("mc-setup-difficulty");
  el.input = i;
  el.mode = mode;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

const heard = (el: HTMLElement): SetupEventDetail[] => {
  const seen: SetupEventDetail[] = [];
  el.addEventListener("mc-setup", (e) => seen.push(e.detail));
  return seen;
};

describe("mc-setup-difficulty", () => {
  it("draws a card per difficulty, the chosen one marked, each a focus stop that raises difficulty", async () => {
    const el = await section(input({ selected: "expert" }));
    const cards = [...el.shadowRoot!.querySelectorAll("mc-press-card")];
    expect(cards.map((c) => c.getAttribute("data-stop"))).toEqual(["difficulty:standard", "difficulty:expert"]);
    expect(cards.map((c) => c.hasAttribute("selected"))).toEqual([false, true]);
    const seen = heard(el);
    cards[1]!.press();
    expect(seen).toEqual([{ type: "difficulty", id: "expert" }]);
  });

  it("draws the phone's segment strip as chips instead of cards", async () => {
    const el = await section(input(), "phone");
    expect(el.shadowRoot!.querySelectorAll("mc-press-card").length).toBe(0);
    const chips = [...el.shadowRoot!.querySelectorAll(".strip mc-chip")];
    expect(chips.map((c) => c.getAttribute("data-stop"))).toEqual(["difficulty:standard", "difficulty:expert"]);
    const seen = heard(el);
    press(chips[0]!);
    expect(seen).toEqual([{ type: "difficulty", id: "standard" }]);
  });

  it("folds the set choices into a card whose chips raise option actions and whose Cards link opens the sheet", async () => {
    const el = await section(input({ setChoices: [setRow] }));
    const seen = heard(el);
    const chips = [...el.shadowRoot!.querySelectorAll(".sets mc-chip")];
    const link = chips.find((c) => c.hasAttribute("link"))!;
    press(link);
    press(chips.find((c) => c.getAttribute("data-stop") === "option:standardSet:ii")!);
    expect(seen).toEqual([{ type: "sets-sheet" }, { type: "option", action: "standardSet:ii" }]);
  });

  it("offers Tower Defense's toggle as a card on wide and a check row on a phone, only when offered", async () => {
    const td = { offered: true, on: true, perHero: 2 };
    const wide = await section(input({ towerDefense: td }));
    const card = wide.shadowRoot!.querySelector('[data-stop="towerDefenseSetupDamage"]')!;
    expect(card.localName).toBe("mc-press-card");
    const seen = heard(wide);
    (card as HTMLElement & { press(): void }).press();
    expect(seen).toEqual([{ type: "tower-defense" }]);
    const phone = await section(input({ towerDefense: td }), "phone");
    expect(phone.shadowRoot!.querySelector('[data-stop="towerDefenseSetupDamage"]')!.localName).toBe("mc-check-row");
    const none = await section(input());
    expect(none.shadowRoot!.querySelector('[data-stop="towerDefenseSetupDamage"]')).toBeNull();
  });

  it("draws nothing without an input", async () => {
    const el = document.createElement("mc-setup-difficulty");
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot!.children.length).toBe(0);
  });
});
