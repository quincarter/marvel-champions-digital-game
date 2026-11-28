// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-decks-thumb.js";
import type { McDecksThumb } from "../McDecksThumb.js";

afterEach(() => document.body.replaceChildren());

describe("mc-decks-thumb", () => {
  it("hands the scan to its tile with the missing word and raises the hover for its card", async () => {
    const thumb = document.createElement("mc-decks-thumb") as McDecksThumb;
    thumb.picture = { src: "/a.png", retry: "pack:a" };
    thumb.cardId = "01001";
    thumb.missing = "No scan";
    document.body.append(thumb);
    await thumb.updateComplete;
    const tile = thumb.shadowRoot!.querySelector("mc-picture-tile") as HTMLElement & { picture: unknown };
    expect(tile.picture).toEqual({ src: "/a.png", retry: "pack:a", missing: "No scan" });
    const seen: unknown[] = [];
    thumb.addEventListener("mc-card-hover", (event) => seen.push((event as CustomEvent).detail.cardId));
    const enter = new Event("pointerenter") as Event & { pointerType?: string };
    enter.pointerType = "mouse";
    thumb.dispatchEvent(enter);
    expect(seen).toEqual(["01001"]);
  });

  it("raises no hover without a card id", async () => {
    const thumb = document.createElement("mc-decks-thumb") as McDecksThumb;
    document.body.append(thumb);
    await thumb.updateComplete;
    const seen: unknown[] = [];
    thumb.addEventListener("mc-card-hover", () => seen.push(1));
    const enter = new Event("pointerenter") as Event & { pointerType?: string };
    enter.pointerType = "mouse";
    thumb.dispatchEvent(enter);
    expect(seen).toEqual([]);
  });
});
