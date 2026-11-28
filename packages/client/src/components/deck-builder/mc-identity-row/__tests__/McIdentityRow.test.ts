// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { inner, mount, press, tap } from "../../shared/test-support.js";
import "../mc-identity-row.js";
import type { McIdentityRow } from "../McIdentityRow.js";
import type { PressDetail } from "@mc/ui";

afterEach(() => document.body.replaceChildren());

const model = { cardId: "01001a", label: "Identity", name: "Spider-Man", cue: "Read card", picture: { src: null } };

describe("mc-identity-row", () => {
  it("is the identity-card stop and shows the hero's name with its cue", async () => {
    const el = await mount<McIdentityRow>("mc-identity-row", { model });
    expect(el.dataset.stop).toBe("identity-card");
    expect(inner(el, ".name")!.textContent).toBe("Spider-Man");
    expect(inner(el, ".cue")!.textContent).toBe("Read card");
    expect(inner<HTMLElement>(el, "mc-card-art")!.getAttribute("card-id")).toBe("01001a");
  });

  it("opens the hero's card on a tap, on Enter and on Inspect", async () => {
    const el = await mount<McIdentityRow>("mc-identity-row", { model });
    const seen: PressDetail[] = [];
    el.addEventListener("mc-pressed", (e) => seen.push((e as CustomEvent<PressDetail>).detail));
    tap(el);
    press(el);
    el.inspect();
    expect(seen.map((s) => s.action)).toEqual([
      { type: "identity-card" },
      { type: "identity-card" },
      { type: "identity-card" },
    ]);
  });
});
