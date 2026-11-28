import { html, render } from "lit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { watchedCard } from "./watched-card.js";

let host: HTMLElement;
beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
});
afterEach(() => document.body.replaceChildren());

describe("watchedCard", () => {
  it("raises the card hover events for a mouse over the element it is on, and reads the card afresh each time", () => {
    let id = "01001";
    render(html`<div id="tile" ${watchedCard(() => ({ cardId: id }))}></div>`, host);
    const tile = document.getElementById("tile")!;
    const entered = vi.fn();
    const left = vi.fn();
    document.body.addEventListener("mc-card-hover", (event) => entered((event as CustomEvent).detail.cardId));
    document.body.addEventListener("mc-card-hover-end", (event) => left((event as CustomEvent).detail.cardId));
    const mouse = (type: string) => {
      const event = new Event(type, { bubbles: true }) as Event & { pointerType: string };
      event.pointerType = "mouse";
      tile.dispatchEvent(event);
    };
    mouse("pointerenter");
    id = "01002";
    mouse("pointerleave");
    expect(entered).toHaveBeenCalledWith("01001");
    expect(left).toHaveBeenCalledWith("01002");
  });

  it("raises nothing for a finger, and nothing once the element is gone", () => {
    render(html`<div id="tile" ${watchedCard(() => ({ cardId: "01001" }))}></div>`, host);
    const tile = document.getElementById("tile")!;
    const entered = vi.fn();
    document.body.addEventListener("mc-card-hover", entered);
    const touch = new Event("pointerenter", { bubbles: true }) as Event & { pointerType: string };
    touch.pointerType = "touch";
    tile.dispatchEvent(touch);
    expect(entered).not.toHaveBeenCalled();
    render(html``, host);
    const mouse = new Event("pointerenter", { bubbles: true }) as Event & { pointerType: string };
    mouse.pointerType = "mouse";
    tile.dispatchEvent(mouse);
    expect(entered).not.toHaveBeenCalled();
  });
});
