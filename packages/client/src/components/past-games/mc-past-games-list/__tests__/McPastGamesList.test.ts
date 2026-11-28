// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-past-games-list.js";
import type { McPastGamesList } from "../McPastGamesList.js";
import type { PastGameRowModel } from "../../mc-past-game-row/mc-past-game-row.types.js";

afterEach(() => document.body.replaceChildren());

const row = (id: string, selected = false): PastGameRowModel => ({
  id,
  selected,
  label: id,
  pictures: [],
  summary: { result: "WON", tone: "won", reason: "r", title: id, when: "w", fates: null, campaign: null },
});

async function mount(model: McPastGamesList["model"]): Promise<McPastGamesList> {
  const el = document.createElement("mc-past-games-list");
  el.model = model;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-past-games-list", () => {
  it("draws a stop per game, the picked one selected", async () => {
    const el = await mount({ rows: [row("a"), row("b", true)], empty: null });
    const rows = [...el.shadowRoot!.querySelectorAll<HTMLElement & { selected: boolean }>("mc-past-game-row")];
    expect(rows.map((r) => r.dataset.stop)).toEqual(["game:a", "game:b"]);
    expect(rows.map((r) => r.selected)).toEqual([false, true]);
    expect(el.scroller).not.toBeNull();
  });

  it("says one sentence in place of rows", async () => {
    const el = await mount({ rows: [], empty: "No games yet" });
    expect(el.shadowRoot!.querySelector("mc-past-game-row")).toBeNull();
    expect(el.shadowRoot!.querySelector<HTMLElement & { message: string }>("mc-empty-state")!.message).toBe(
      "No games yet",
    );
    expect(el.scroller).toBeNull();
  });

  it("turns a tap on a row into the screen's own event, once", async () => {
    const el = await mount({ rows: [row("a")], empty: null });
    const heard = vi.fn();
    const outer = vi.fn();
    document.body.addEventListener("mc-pressed", outer);
    el.addEventListener("mc-past-games", (event) => heard((event as CustomEvent).detail));
    el.shadowRoot!.querySelector<HTMLElement>("mc-past-game-row")!.click();
    expect(heard).toHaveBeenCalledWith({ type: "select", id: "a" });
    expect(outer).not.toHaveBeenCalled();
  });
});
