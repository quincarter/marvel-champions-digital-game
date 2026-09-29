/**
 * `cardInspectModel`'s no-game path (the Deck edit/Deck builder screens' own Inspect, and any picker with no live
 * instance behind it), against `{ kind: "flipSide" }`: before this fix, `textOf`/`printedKeywordsOf`/
 * `printedTraitsOf`/`faceNameOf` each checked a card's own top-level fields (`"text" in card`, etc.) before ever
 * looking at `face.kind`, so a flip-side request on a card that also carries a front `text`/`keywords`/`traits` (S.H.
 * I.E.L.D. Tech's Enhanced side, MC27 p. 22; any player-card `flipSide`) silently showed the front — the request
 * never reached `card.flipSide` at all. `27182a` (Compact Darts) is a real content record with exactly that shape.
 */
import { describe, expect, it } from "vitest";
import { CARDS_BY_ID } from "../content/pool.js";
import { cardInspectModel } from "./inspect-model.js";

const COMPACT_DARTS = CARDS_BY_ID.get("27182a")!;

describe("cardInspectModel: flipSide face, against a real Enhanced S.H.I.E.L.D. Tech card", () => {
  it("has a front and flipSide fixture shaped so a front-first bug would go unnoticed otherwise", () => {
    expect(COMPACT_DARTS).toBeDefined();
    expect("text" in COMPACT_DARTS).toBe(true);
    expect("flipSide" in COMPACT_DARTS && COMPACT_DARTS.flipSide).toBeTruthy();
  });

  it("shows the flipSide's own text, not the front's", () => {
    const front = cardInspectModel(COMPACT_DARTS, { kind: "front" });
    const flipped = cardInspectModel(COMPACT_DARTS, { kind: "flipSide" });
    expect(flipped.rulesText).not.toBe(front.rulesText);
    expect(flipped.rulesText).toMatch(/2 different enemies/);
    expect(front.rulesText).toMatch(/an enemy/);
    expect(front.rulesText).not.toMatch(/2 different enemies/);
  });

  it("shows the flipSide's own traits (ENHANCED) and name", () => {
    const flipped = cardInspectModel(COMPACT_DARTS, { kind: "flipSide" });
    expect(flipped.traits.map((t) => t.toUpperCase())).toContain("ENHANCED");
    expect(flipped.name).toBe("Compact Darts");
  });

  it("shows the flipSide's own art, distinct from the front's", () => {
    const front = cardInspectModel(COMPACT_DARTS, { kind: "front" });
    const flipped = cardInspectModel(COMPACT_DARTS, { kind: "flipSide" });
    expect(flipped.art?.url).not.toBe(front.art?.url);
    expect(flipped.art?.url).toMatch(/27182b/);
  });
});
