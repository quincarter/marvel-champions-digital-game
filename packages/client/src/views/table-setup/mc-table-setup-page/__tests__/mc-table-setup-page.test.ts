// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-table-setup-page";
import type { SetupEventDetail } from "../../../../components/table-setup/shared/setup-events.types";
import type { TableSetupPageInput } from "../mc-table-setup-page.types";

afterEach(() => document.body.replaceChildren());

const input = (): TableSetupPageInput => ({
  difficulty: {
    cards: [{ id: "standard", name: "Standard", description: "Standard encounter set only." }],
    selected: "standard",
    setChoices: [],
    optionRows: [],
    towerDefense: { offered: false, on: false, perHero: 1 },
  },
  modulars: {
    cw: null,
    villainName: "Rhino",
    required: [],
    options: [],
    hood: [],
    randomSets: false,
    right: "",
    openGroups: new Map(),
    pictures: new Map(),
  },
  seating: {
    seats: [
      {
        index: 0,
        name: "Spider-Man",
        meta: "First player",
        chipLabel: "YOU",
        selected: true,
        identityCardId: undefined,
      },
    ],
    room: false,
    pictures: new Map(),
  },
  summary: { rows: [], seedText: "1", watchable: false, room: false, villain: null },
  encounter: { composition: [], whatsInThere: [], nemesis: null, deckSize: 30 },
  deal: { starting: false, room: false, blocked: null, status: "", footerLine: "" },
  titleDrop: 0,
  titleMax: 0,
});

async function make(mode: "wide" | "phone") {
  const el = document.createElement("mc-table-setup-page");
  el.input = input();
  el.mode = mode;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

const tags = (parent: Element) => [...parent.children].map((c) => c.localName);

describe("mc-table-setup-page", () => {
  it("composes the five sections in the body and the summary and deal bar in the sidebar when wide", async () => {
    const el = await make("wide");
    const root = el.renderRoot;
    expect(tags(root.querySelector(".main")!)).toEqual([
      "mc-setup-difficulty",
      "mc-setup-modulars",
      "mc-setup-seating",
      "mc-setup-encounter",
    ]);
    expect(tags(root.querySelector(".side")!)).toEqual(["mc-setup-summary", "mc-setup-deal-bar"]);
    expect(root.querySelector("mc-setup-top-bar")).not.toBeNull();
    expect(el.scroller).toBe(root.querySelector(".main"));
  });

  it("is one scrolling page with the deal bar pinned under it on a phone", async () => {
    const el = await make("phone");
    const root = el.renderRoot;
    expect(tags(root.querySelector(".main")!)).toEqual([
      "mc-setup-difficulty",
      "mc-setup-modulars",
      "mc-setup-seating",
      "mc-setup-summary",
      "mc-setup-encounter",
    ]);
    expect(root.querySelector(".side")).toBeNull();
    expect(root.querySelector(".body > mc-setup-deal-bar")).not.toBeNull();
  });

  it("lets a section's mc-setup event through to whoever listens on the page", async () => {
    const el = await make("wide");
    const seen: SetupEventDetail[] = [];
    el.addEventListener("mc-setup", (e) => seen.push(e.detail));
    const section = el.renderRoot.querySelector("mc-setup-difficulty")!;
    await section.updateComplete;
    section.shadowRoot!.querySelector("mc-press-card")!.press();
    expect(seen).toEqual([{ type: "difficulty", id: "standard" }]);
  });

  it("draws nothing without an input", async () => {
    const el = document.createElement("mc-table-setup-page");
    document.body.append(el);
    await el.updateComplete;
    expect(el.renderRoot.querySelector(".body")).toBeNull();
  });
});
