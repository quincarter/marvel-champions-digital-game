import { describe, expect, it } from "vitest";
import "./mc-tab-rail.js";
import "../mc-picture-tile/mc-picture-tile.js";
import "../mc-list-row/mc-list-row.js";
import "../mc-empty-state/mc-empty-state.js";

async function mount<T extends HTMLElement & { updateComplete: Promise<boolean> }>(el: T): Promise<T> {
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-tab-rail", () => {
  it("draws one rail cell per tab, the chosen one selected, and raises mc-activate with the keyed id", async () => {
    const rail = await mount(document.createElement("mc-tab-rail"));
    rail.tabs = [
      { id: "a", label: "Alpha" },
      { id: "b", label: "Beta" },
      { id: "c", label: "Gamma", disabled: true },
    ];
    rail.selected = "b";
    await rail.updateComplete;
    const cells = [...rail.shadowRoot!.querySelectorAll("mc-button")];
    expect(cells.map((cell) => cell.getAttribute("data-key"))).toEqual(["tab:a", "tab:b", "tab:c"]);
    expect(cells.map((cell) => cell.hasAttribute("selected"))).toEqual([false, true, false]);
    expect(cells[2]!.hasAttribute("disabled")).toBe(true);
    const seen: { key: string; id: string }[] = [];
    rail.addEventListener("mc-activate", (event) => seen.push((event as CustomEvent).detail));
    cells[0]!.dispatchEvent(new CustomEvent("mc-press"));
    cells[2]!.dispatchEvent(new CustomEvent("mc-press"));
    expect(seen).toEqual([{ key: "tab:a", id: "a" }]);
    rail.remove();
  });
});

describe("mc-picture-tile", () => {
  const model = {
    src: "/a.png",
    focusY: 0.2,
    dim: true,
    chip: "LOCKED",
    chipTone: "locked" as const,
    title: "Spider-Man",
    detail: "Win 3 games",
    detailTone: "alert" as const,
    initial: "S",
  };

  it("shows a lazy, dimmed picture, the chip, and the caption with the alert detail", async () => {
    const tile = await mount(document.createElement("mc-picture-tile"));
    tile.model = model;
    await tile.updateComplete;
    const img = tile.shadowRoot!.querySelector("img")!;
    expect(img.getAttribute("loading")).toBe("lazy");
    expect(img.classList.contains("dim")).toBe(true);
    expect(img.style.objectPosition).toBe("50% 20%");
    expect(tile.shadowRoot!.querySelector(".chip.locked")!.textContent).toBe("LOCKED");
    expect(tile.shadowRoot!.querySelector(".title")!.textContent).toBe("Spider-Man");
    expect(tile.shadowRoot!.querySelector(".detail.alert")!.textContent).toBe("Win 3 games");
    tile.remove();
  });

  it("stands the faint initial in for a missing picture", async () => {
    const tile = await mount(document.createElement("mc-picture-tile"));
    tile.model = { ...model, src: null, dim: false, chipTone: "action", detailTone: "meta" };
    await tile.updateComplete;
    expect(tile.shadowRoot!.querySelector("img")).toBeNull();
    expect(tile.shadowRoot!.querySelector(".initial")!.textContent).toBe("S");
    tile.remove();
  });
});

describe("mc-list-row", () => {
  it("marks a closed row (dim title, red detail) and the active row", async () => {
    const row = await mount(document.createElement("mc-list-row"));
    row.model = { leading: "▶", title: "Song", detail: "Beat Rhino", open: false, active: false };
    await row.updateComplete;
    expect(row.classList.contains("closed")).toBe(true);
    expect(row.shadowRoot!.querySelector(".detail.alert")!.textContent).toBe("Beat Rhino");
    row.model = { leading: "■", title: "Song", detail: "Now playing", open: true, active: true };
    await row.updateComplete;
    expect(row.classList.contains("active")).toBe(true);
    expect(row.classList.contains("closed")).toBe(false);
    expect(row.shadowRoot!.querySelector(".badge")!.textContent).toBe("■");
    row.remove();
  });
});

describe("mc-empty-state", () => {
  it("says its text at its size", async () => {
    const empty = await mount(document.createElement("mc-empty-state"));
    empty.text = "Nothing here yet.";
    empty.size = 16;
    await empty.updateComplete;
    expect(empty.shadowRoot!.textContent).toContain("Nothing here yet.");
    expect(empty.style.getPropertyValue("--mc-empty-size")).toBe("16px");
    empty.remove();
  });
});
