// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-trophy-list.js";
import type { McTrophyList } from "../McTrophyList.js";
import type { TrophyRow } from "../../../../view/trophy-room-model.js";
import { trophyKeyOf } from "../mc-trophy-list.types.js";

afterEach(() => document.body.replaceChildren());

const rows: readonly TrophyRow[] = [
  { kind: "section", id: "wins", title: "Battles won", count: "1 of 2 · 50%", expanded: true },
  {
    kind: "achievement",
    id: "wins-1",
    name: "First win",
    detail: "Win a game.",
    state: "earned",
    stateLabel: "EARNED",
    reward: "",
    progress: null,
    progressLabel: "",
  },
  { kind: "section", id: "mods", title: "Mods", count: "0 of 1 · 0%", expanded: true },
  { kind: "group", id: "silly", title: "Silly pack", count: "0 of 1" },
];

async function mount(): Promise<McTrophyList> {
  const el = document.createElement("mc-trophy-list");
  el.model = { rows, groupLabels: { silly: "From Silly pack" } };
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-trophy-list", () => {
  it("draws a heading per family, a card per achievement and a label per pack, with a stop on the first two only", async () => {
    const el = await mount();
    const root = el.shadowRoot!;
    expect(root.querySelectorAll("mc-trophy-family")).toHaveLength(2);
    expect(root.querySelectorAll("mc-trophy-tile")).toHaveLength(1);
    expect(root.querySelectorAll("mc-trophy-group")).toHaveLength(1);
    const stops = [...root.querySelectorAll<HTMLElement>("[data-stop]")].map((node) => node.dataset.stop);
    expect(stops).toEqual(["sec:wins", "row:wins-1", "sec:mods"]);
    expect(root.querySelector<HTMLElement & { label: string }>("mc-trophy-group")!.label).toBe("From Silly pack");
    expect(el.scroller).not.toBeNull();
  });

  it("turns a tap on a heading or a card into the screen's own event, once", async () => {
    const el = await mount();
    const heard = vi.fn();
    const outer = vi.fn();
    document.body.addEventListener("mc-pressed", outer);
    el.addEventListener("mc-trophy-room", (event) => heard((event as CustomEvent).detail));
    el.shadowRoot!.querySelector<HTMLElement>("mc-trophy-family")!.click();
    el.shadowRoot!.querySelector<HTMLElement>("mc-trophy-tile")!.click();
    expect(heard).toHaveBeenNthCalledWith(1, { type: "family", id: "wins" });
    expect(heard).toHaveBeenNthCalledWith(2, { type: "achievement", id: "wins-1" });
    expect(outer).not.toHaveBeenCalled();
  });

  it("keys a row by what it shows", () => {
    expect(rows.map(trophyKeyOf)).toEqual(["sec:wins", "row:wins-1", "sec:mods", "grp:silly"]);
  });
});
