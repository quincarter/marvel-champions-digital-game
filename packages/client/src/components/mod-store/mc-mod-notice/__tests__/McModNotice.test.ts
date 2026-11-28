// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-mod-notice.js";
import { hear, mount, press, stop } from "../../shared/__tests__/test-mount.js";
import type { McModNotice } from "../McModNotice.js";

const props = {
  lines: [
    { speaker: "Deadpool", text: "Psst.", portrait: { src: "x.webp", focus: { x: 0.5, y: 0.15, centered: true } } },
    { speaker: "Spider-Man", text: "Bugs.", portrait: { src: null } },
  ],
  buttons: [
    { id: "report", label: "Report a problem" },
    { id: "close", label: "Got it" },
  ],
};

describe("mc-mod-notice", () => {
  it("shows each speaker's words in a bubble beside a round portrait, the second mirrored on a wide screen", async () => {
    const el = await mount<McModNotice>("mc-mod-notice", { ...props, size: "wide" });
    const speakers = [...el.shadowRoot!.querySelectorAll(".speaker")];
    expect(speakers.map((s) => s.querySelector(".who")!.textContent)).toEqual(["Deadpool", "Spider-Man"]);
    expect(speakers.map((s) => s.className)).toEqual(["speaker left", "speaker right"]);
    el.remove();
  });

  it("does not mirror on a phone, and says an initial where a portrait has not loaded", async () => {
    const el = await mount<McModNotice>("mc-mod-notice", { ...props, size: "phone" });
    expect([...el.shadowRoot!.querySelectorAll(".speaker")].map((s) => s.className)).toEqual([
      "speaker left",
      "speaker left",
    ]);
    const portrait = el.shadowRoot!.querySelectorAll<HTMLElement & { picture: { missing: string } }>(
      ".portrait mc-picture-tile",
    )[1]!;
    expect(portrait.picture.missing).toBe("S");
    el.remove();
  });

  it("answers with close or report from its two buttons, keyed as the pad route knows them", async () => {
    const el = await mount<McModNotice>("mc-mod-notice", props);
    const heard = hear(el);
    press(stop(el, "close"));
    press(stop(el, "report"));
    expect(heard).toEqual([
      { type: "notice", answer: "close" },
      { type: "notice", answer: "report" },
    ]);
    el.remove();
  });

  it("covers the store with a backdrop that takes every press", async () => {
    const el = await mount<McModNotice>("mc-mod-notice", props);
    expect(el.shadowRoot!.querySelector(".backdrop")).not.toBeNull();
    el.remove();
  });

  it("draws nothing without speakers", async () => {
    const el = await mount<McModNotice>("mc-mod-notice");
    expect(el.shadowRoot!.children.length).toBe(0);
    el.remove();
  });
});
