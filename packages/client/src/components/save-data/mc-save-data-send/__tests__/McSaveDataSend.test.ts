// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-save-data-send.js";
import type { McSaveDataSend } from "../McSaveDataSend.js";

afterEach(() => document.body.replaceChildren());

async function mount(): Promise<McSaveDataSend> {
  const el = document.createElement("mc-save-data-send");
  el.input = {
    phase: "showing",
    title: "Send",
    help: "Type this code.",
    code: "ABCD-EFGH-JKMN",
    qr: ["101", "010", "101"],
    link: "https://example.test/#receive=1",
    countdown: "Expires in 14:00",
    expired: false,
    copyLabel: "Copy code",
    newCodeLabel: "New code",
    backLabel: "Back",
    backGlyph: null,
  };
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-save-data-send", () => {
  it("renders what it is given", async () => {
    const el = await mount();
    const root = el.shadowRoot!;
    expect(root.querySelector(".code")!.textContent).toBe("ABCD-EFGH-JKMN");
    expect(root.querySelector("[data-stop='copy']")).not.toBeNull();
    expect(root.querySelector("mc-qr-code")).not.toBeNull();
  });

  it("offers New code once the code has run out, and shows only the title while uploading", async () => {
    const el = await mount();
    el.input = { ...(el.input as Extract<NonNullable<typeof el.input>, { phase: "showing" }>), expired: true };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("[data-stop='new-code']")).not.toBeNull();
    expect(el.shadowRoot!.querySelector("[data-stop='copy']")).toBeNull();
    el.input = { phase: "uploading", title: "Send" };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("mc-qr-code")).toBeNull();
    expect(el.shadowRoot!.querySelector(".title")!.textContent).toBe("Send");
  });
});
