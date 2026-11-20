import { describe, expect, it } from "vitest";
import { COMPETITIVE_TAPPED_MESSAGE, GAME_MODE_OPTIONS, gameModeOptionsView, selectMode } from "./game-mode-options.js";

describe("game mode options", () => {
  it("has exactly two options, cooperative first", () => {
    expect(GAME_MODE_OPTIONS.map((o) => o.id)).toEqual(["cooperative", "competitive"]);
  });

  it("shows competitive disabled with the owner's wording", () => {
    const [coop, comp] = GAME_MODE_OPTIONS;
    expect(coop).toMatchObject({ label: "Cooperative", enabled: true, note: "Co-op only for now" });
    expect(comp).toMatchObject({
      label: "Competitive",
      enabled: false,
      note: "Online rooms",
      reason:
        "Two teams, each against the other's leader. Pick Competitive when you host an online room; hot-seat play is coming soon.",
    });
  });

  it("selects cooperative, even when asked for competitive, and always yields the cooperative mode", () => {
    for (const asked of ["cooperative", "competitive"] as const) {
      const v = gameModeOptionsView(asked);
      expect(v.rows.filter((r) => r.selected).map((r) => r.id)).toEqual(["cooperative"]);
      expect(v.gameMode).toBe("cooperative");
    }
  });

  it("selecting competitive returns the draft unchanged with the reason", () => {
    const draft = { a: 1 };
    const r = selectMode(draft, "competitive");
    expect(r.ok).toBe(false);
    expect(r.draft).toBe(draft);
    expect(r).toMatchObject({ message: COMPETITIVE_TAPPED_MESSAGE });
    expect(COMPETITIVE_TAPPED_MESSAGE).toBe(
      "Competitive mode is played in an online room. Play this scenario cooperatively here.",
    );
  });

  it("selecting cooperative is accepted and leaves the draft unchanged", () => {
    const draft = { a: 1 };
    const r = selectMode(draft, "cooperative");
    expect(r).toEqual({ ok: true, draft });
    expect(r.draft).toBe(draft);
  });
});
