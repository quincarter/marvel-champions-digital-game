// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../mc-detail-hero.js";
import type { McDetailHero } from "../McDetailHero.js";
import type { HeroDetailModel } from "../../seats.types.js";

afterEach(() => document.body.replaceChildren());

const hero = (over: Partial<HeroDetailModel> = {}): HeroDetailModel => ({
  name: "Spider-Man",
  credit: "Justice deck · tested by Quin",
  stats: "Peter Parker · 10 HP · hand 5",
  obligationLabel: "Obligation",
  obligation: "Financial Woes",
  nemesisLabel: "Nemesis",
  nemesis: "Sandman",
  ...over,
});

async function mount(model: HeroDetailModel | null): Promise<McDetailHero> {
  const el = document.createElement("mc-detail-hero") as McDetailHero;
  el.model = model;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-detail-hero", () => {
  it("shows the name, credit and stats, then the obligation and nemesis facts", async () => {
    const el = await mount(hero());
    const root = el.shadowRoot!;
    expect(root.querySelector(".name")!.textContent).toBe("Spider-Man");
    expect(root.querySelector(".credit")!.textContent).toBe("Justice deck · tested by Quin");
    expect(root.querySelector(".stats")!.textContent).toBe("Peter Parker · 10 HP · hand 5");
    const obligation = root.querySelector<HTMLElement & { label: string; text: string }>(".obligation")!;
    const nemesis = root.querySelector<HTMLElement & { label: string; text: string }>(".nemesis")!;
    expect([obligation.label, obligation.text]).toEqual(["Obligation", "Financial Woes"]);
    expect([nemesis.label, nemesis.text]).toEqual(["Nemesis", "Sandman"]);
  });

  it("leaves out a credit it has none of, and draws nothing without a hero", async () => {
    const el = await mount(hero({ credit: null }));
    expect(el.shadowRoot!.querySelector(".credit")).toBeNull();
    el.model = null;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".name")).toBeNull();
  });
});
