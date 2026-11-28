// @vitest-environment happy-dom
import { html, LitElement } from "lit";
import { afterEach, describe, expect, it } from "vitest";
import { settleElements } from "./element-settle.js";

class SettleChild extends LitElement {
  static override properties = { text: { type: String } };
  declare text: string;
  override render() {
    return html`<span>${this.text}</span>`;
  }
}
class SettleParent extends LitElement {
  static override properties = { text: { type: String } };
  declare text: string;
  override render() {
    return html`<settle-child .text=${this.text}></settle-child>`;
  }
}
customElements.define("settle-child", SettleChild);
customElements.define("settle-parent", SettleParent);

afterEach(() => document.body.replaceChildren());

describe("settleElements", () => {
  it("waits for a parent's render and then its child's, so the text is there when it resolves", async () => {
    const parent = document.createElement("settle-parent") as SettleParent;
    parent.text = "one";
    document.body.append(parent);
    await settleElements(parent);
    const child = parent.shadowRoot!.querySelector("settle-child")!;
    expect(child.shadowRoot!.querySelector("span")!.textContent).toBe("one");
    parent.text = "two";
    await settleElements(parent);
    expect(child.shadowRoot!.querySelector("span")!.textContent).toBe("two");
  });

  it("resolves at once for a tree with nothing updating", async () => {
    document.body.append(document.createElement("div"));
    await expect(settleElements(document.body)).resolves.toBeUndefined();
  });
});
