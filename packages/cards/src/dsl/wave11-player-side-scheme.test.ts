/**
 * Wave 11 hero packs: `PLAYER_SIDE_SCHEME` / `ENCOUNTER_SIDE_SCHEME`, side schemes by card type, not controller
 * (Strategy Session 61019, Stakeout 61014). The engine's `player-side-scheme-query.test.ts` drives the field.
 */

import { describe, expect, it } from "vitest";
import { ENCOUNTER_SIDE_SCHEME, PLAYER_SIDE_SCHEME, query } from "./values.js";

describe("PLAYER_SIDE_SCHEME / ENCOUNTER_SIDE_SCHEME", () => {
  it("read the card type, with no controller term", () => {
    expect(PLAYER_SIDE_SCHEME).toEqual({ categories: ["sideScheme"], playerSideScheme: true });
    expect(ENCOUNTER_SIDE_SCHEME).toEqual({ categories: ["sideScheme"], playerSideScheme: false });
    expect(PLAYER_SIDE_SCHEME).not.toHaveProperty("controller");
    expect({ ...ENCOUNTER_SIDE_SCHEME, withoutKeyword: "permanent" }).toEqual(
      query("sideScheme", { playerSideScheme: false, withoutKeyword: "permanent" }),
    );
  });
});
