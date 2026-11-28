// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-mod-beta-caption.js";
import { mount } from "../../shared/__tests__/test-mount.js";
import type { McModBetaCaption } from "../McModBetaCaption.js";

describe("mc-mod-beta-caption", () => {
  it("says its heading and its words, each in a span of its own", async () => {
    const el = await mount<McModBetaCaption>("mc-mod-beta-caption", { heading: "Beta", body: "Expect rough edges." });
    expect(el.shadowRoot!.querySelector(".heading")!.textContent).toBe("Beta");
    expect(el.shadowRoot!.querySelector(".body")!.textContent).toBe("Expect rough edges.");
    el.remove();
  });

  it("reflects the layout size, so a phone's caption is the small one", async () => {
    const el = await mount<McModBetaCaption>("mc-mod-beta-caption", { size: "phone" });
    expect(el.getAttribute("size")).toBe("phone");
    el.remove();
  });
});
