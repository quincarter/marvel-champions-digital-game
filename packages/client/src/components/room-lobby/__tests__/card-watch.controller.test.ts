// @vitest-environment happy-dom
import { html, LitElement } from "lit";
import { afterEach, describe, expect, it } from "vitest";
import { CardWatchController } from "../card-watch.controller.js";

class WatchHost extends LitElement {
  static override properties = { card: { type: String } };
  declare card: string;
  constructor() {
    super();
    this.card = "a";
    new CardWatchController(this);
  }
  override render() {
    return html`<div class="pic" data-card=${this.card}></div>`;
  }
}
customElements.define("watch-host", WatchHost);

afterEach(() => document.body.replaceChildren());

const enter = (target: Element): void => {
  const event = new Event("pointerenter") as Event & { pointerType?: string };
  event.pointerType = "mouse";
  target.dispatchEvent(event);
};

describe("CardWatchController", () => {
  it("binds a picture once and reads its card when the mouse arrives", async () => {
    const host = document.createElement("watch-host") as WatchHost;
    document.body.append(host);
    await host.updateComplete;
    const seen: string[] = [];
    host.addEventListener("mc-card-hover", (event) => seen.push((event as CustomEvent).detail.cardId));
    const pic = host.shadowRoot!.querySelector(".pic")!;
    enter(pic);
    host.card = "b";
    await host.updateComplete;
    enter(pic);
    expect(seen).toEqual(["a", "b"]);
  });

  it("does nothing for an empty card id", async () => {
    const host = document.createElement("watch-host") as WatchHost;
    host.card = "";
    document.body.append(host);
    await host.updateComplete;
    const seen: unknown[] = [];
    host.addEventListener("mc-card-hover", () => seen.push(1));
    enter(host.shadowRoot!.querySelector(".pic")!);
    expect(seen).toEqual([]);
  });
});
