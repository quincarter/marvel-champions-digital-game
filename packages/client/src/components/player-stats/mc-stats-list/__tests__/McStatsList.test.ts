// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../../mc-stats-matchup-legend/mc-stats-matchup-legend";
import "../../mc-stats-credited/mc-stats-credited";
import "../mc-stats-list";
import type { StatsEventDetail } from "../../shared/stats-events.types";
import type { StatsBlock } from "../mc-stats-list.types";

afterEach(() => document.body.replaceChildren());

const row = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  label: id,
  value: "1–0",
  detail: "",
  highlight: false,
  cardId: null,
  picture: null,
  gameId: null,
  linkLabel: "",
  losses: [],
  lossLegend: "",
  ...over,
});

const blocks: StatsBlock[] = [
  { kind: "heading", id: "h", title: "Heroes" },
  { kind: "note", id: "n", text: "Older games are being read." },
  { kind: "stat", id: "hero:favorite", row: row("hero:favorite") },
  {
    kind: "cards",
    id: "all:played:strip:0",
    cards: [{ key: "card:all:played:strip:0:01008", cardId: "01008", value: "2 played", detail: "", picture: null }],
  },
  { kind: "legend", id: "l", entries: [{ kind: "unplayed", label: "Not played", color: "" }] },
];

async function list(set: (el: HTMLElementTagNameMap["mc-stats-list"]) => void = () => undefined) {
  const el = document.createElement("mc-stats-list");
  el.blocks = blocks;
  el.scrollKey = "heroes";
  set(el);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-stats-list", () => {
  it("stacks each block as its own element, in order, in a scroller the specs find by key", async () => {
    const el = await list();
    const root = el.shadowRoot!;
    expect(root.querySelector(".scroller")!.getAttribute("data-key")).toBe("list");
    const kinds = [...root.querySelectorAll(".blocks > *")].map((c) => c.localName);
    expect(kinds).toEqual(["mc-section-heading", "mc-stats-note", "mc-stats-row", "div", "mc-stats-matchup-legend"]);
  });

  it("names a stat row's focus stop after its id and a card's after its key", async () => {
    const el = await list();
    await el.updateComplete;
    const stat = el.shadowRoot!.querySelector("mc-stats-row")!;
    await stat.updateComplete;
    expect(stat.getAttribute("data-stop")).toBe("row:hero:favorite");
    const card = el.shadowRoot!.querySelector("mc-stats-card")!;
    await card.updateComplete;
    expect(card.getAttribute("data-stop")).toBe("card:all:played:strip:0:01008");
  });

  it("passes a stat row's press up as the screen's one event", async () => {
    const el = await list((e) => {
      e.blocks = [{ kind: "stat", id: "rec:fastest", row: row("rec:fastest", { gameId: "g1" }) }];
    });
    const seen: StatsEventDetail[] = [];
    el.addEventListener("mc-player-stats", (e) => seen.push(e.detail));
    const stat = el.shadowRoot!.querySelector("mc-stats-row")!;
    await stat.updateComplete;
    stat.press();
    expect(seen).toEqual([{ type: "open-game", gameId: "g1" }]);
  });

  it("gives each tab back its own place in the list", async () => {
    const el = await list();
    const scroller = el.scroller!;
    scroller.scrollTop = 40;
    el.scrollKey = "villains";
    await el.updateComplete;
    expect(el.scroller!.scrollTop).toBe(0);
    el.scroller!.scrollTop = 15;
    el.scrollKey = "heroes";
    await el.updateComplete;
    expect(el.scroller!.scrollTop).toBe(40);
    el.scrollKey = "villains";
    await el.updateComplete;
    expect(el.scroller!.scrollTop).toBe(15);
  });
});
