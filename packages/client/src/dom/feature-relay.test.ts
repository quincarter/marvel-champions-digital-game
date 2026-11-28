// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { LitElement } from "lit";
import { FeatureRelay } from "./feature-relay.js";

class RelayHost extends LitElement {
  readonly relay = new FeatureRelay<{ type: string }>(this, "mc-thing");
}
if (!customElements.get("relay-host-test")) customElements.define("relay-host-test", RelayHost);

afterEach(() => document.body.replaceChildren());

const press = (action: unknown): CustomEvent =>
  new CustomEvent("mc-pressed", { detail: { action, hold: false }, bubbles: true, composed: true });

describe("FeatureRelay", () => {
  it("raises the screen's event for a typed action and stops the press", async () => {
    const host = document.createElement("relay-host-test");
    document.body.append(host);
    const outer = vi.fn();
    const heard = vi.fn();
    document.body.addEventListener("mc-pressed", outer);
    host.addEventListener("mc-thing", (event) => heard((event as CustomEvent).detail));
    host.dispatchEvent(press({ type: "go", id: "a" }));
    expect(heard).toHaveBeenCalledWith({ type: "go", id: "a" });
    expect(outer).not.toHaveBeenCalled();
  });

  it("says nothing for an action that is not typed", () => {
    const host = document.createElement("relay-host-test");
    document.body.append(host);
    const heard = vi.fn();
    host.addEventListener("mc-thing", heard);
    host.dispatchEvent(press("plain"));
    host.dispatchEvent(press(null));
    expect(heard).not.toHaveBeenCalled();
  });
});
