import { afterEach, describe, expect, it } from "vitest";
import "../mc-deck-row.js";
import type { McDeckRow } from "../McDeckRow.js";
import type { DeckPickDetail, McDeckRowModel } from "../mc-deck-row.types.js";

afterEach(() => document.body.replaceChildren());

const deck = (over: Partial<McDeckRowModel> = {}): McDeckRowModel => ({
  deckId: "precon:core-spider-man-justice",
  name: "Spider-Man (Justice)",
  source: "Precon · 40 cards",
  stamps: [{ label: "Justice", fill: "#f0c040", ink: "#111111" }],
  verdict: "✓ Legal",
  legal: true,
  picture: { src: "/spider.png", retry: "pack:spider" },
  seatLabel: "Seat",
  disabled: null,
  cardId: "01001a",
  ...over,
});

async function mount(model: McDeckRowModel): Promise<McDeckRow> {
  const row = document.createElement("mc-deck-row") as McDeckRow;
  row.model = model;
  document.body.append(row);
  await row.updateComplete;
  return row;
}

const text = (row: McDeckRow, selector: string): string | undefined =>
  row.shadowRoot!.querySelector(selector)?.textContent?.trim();

describe("mc-deck-row", () => {
  it("shows the name, stamps, source and verdict, and gives the picture to its tile", async () => {
    const row = await mount(deck());
    expect(text(row, ".name")).toBe("Spider-Man (Justice)");
    expect(text(row, ".stamp")).toBe("Justice");
    expect(row.shadowRoot!.querySelector(".stamp")!.getAttribute("style")).toContain("--stamp-fill:#f0c040");
    expect(text(row, ".source")).toBe("Precon · 40 cards");
    expect(text(row, ".verdict")).toBe("✓ Legal");
    const tile = row.shadowRoot!.querySelector("mc-picture-tile") as HTMLElement & { picture: unknown };
    expect(tile.picture).toEqual({ src: "/spider.png", retry: "pack:spider" });
  });

  it("puts a mark before a verdict that has none, so a problem is not only a colour", async () => {
    const row = await mount(deck({ legal: false, verdict: "Needs 40 cards" }));
    expect(text(row, ".verdict")).toBe("✕ Needs 40 cards");
    expect(row.shadowRoot!.querySelector(".verdict")!.getAttribute("data-status")).toBe("blocked");
    row.model = deck({ status: "locked", legal: false, mark: "Locked ·", verdict: "Beat Rhino" });
    await row.updateComplete;
    expect(text(row, ".verdict")).toBe("Locked · Beat Rhino");
  });

  it("is one stop named by the deck, and a press raises mc-deck-pick once", async () => {
    const row = await mount(deck());
    const stops = [...row.shadowRoot!.querySelectorAll<HTMLElement>("[data-stop]")].map((part) => part.dataset.stop);
    expect(stops).toEqual(["deck:precon:core-spider-man-justice"]);
    const picks: DeckPickDetail[] = [];
    const leaked: Event[] = [];
    row.addEventListener("mc-deck-pick", (event) => picks.push((event as CustomEvent<DeckPickDetail>).detail));
    row.addEventListener("mc-press", (event) => leaked.push(event));
    row.shadowRoot!.querySelector<HTMLElement>("[data-stop]")!.click();
    expect(picks).toEqual([{ deckId: "precon:core-spider-man-justice" }]);
    expect(leaked).toEqual([]);
  });

  it("keeps a disabled deck's button, dimmed with its reason, and raises nothing", async () => {
    const row = await mount(deck({ disabled: "Needs 40 cards", legal: false, verdict: "Needs 40 cards" }));
    const button = row.shadowRoot!.querySelector("mc-button")!;
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(button.getAttribute("reason")).toBe("Needs 40 cards");
    const picks: unknown[] = [];
    row.addEventListener("mc-deck-pick", (event) => picks.push(event));
    (button as HTMLElement).click();
    expect(picks).toEqual([]);
  });

  it("raises the card hover and inspect events for its card from the picture, and none with no card", async () => {
    const row = await mount(deck());
    const thumb = row.shadowRoot!.querySelector<HTMLElement>(".thumb")!;
    const seen: string[] = [];
    row.addEventListener("mc-card-hover", (event) => seen.push(`hover:${(event as CustomEvent).detail.cardId}`));
    row.addEventListener("mc-card-hover-end", (event) => seen.push(`end:${(event as CustomEvent).detail.cardId}`));
    const enter = new Event("pointerenter");
    Object.defineProperty(enter, "pointerType", { value: "mouse" });
    thumb.dispatchEvent(enter);
    thumb.dispatchEvent(new Event("pointerleave"));
    expect(seen).toEqual(["hover:01001a", "end:01001a"]);

    row.model = deck({ cardId: null });
    await row.updateComplete;
    thumb.dispatchEvent(enter);
    expect(seen).toHaveLength(2);
  });

  it("lets a picture's retry event out of its shadow, for the screen's picture leases", async () => {
    const row = await mount(deck());
    const seen: unknown[] = [];
    row.addEventListener("mc-image-error", (event) => seen.push((event as CustomEvent).detail));
    const tile = row.shadowRoot!.querySelector("mc-picture-tile") as HTMLElement & { updateComplete: Promise<boolean> };
    await tile.updateComplete;
    tile.shadowRoot!.querySelector("img")!.dispatchEvent(new Event("error"));
    expect(seen).toEqual([{ src: "/spider.png", key: "pack:spider" }]);
  });
});
