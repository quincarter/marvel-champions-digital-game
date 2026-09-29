/**
 * docs/phase7-wave5.md §3.27: the builder for MC27 p. 22 reputation node 5's lasting reward, "During the Resolve
 * Mulligans step of game setup, each player may take 1 additional mulligan" (RRG 1.8 p. 67 erratum). It emits the plain
 * data `packages/engine/src/campaign/sm-queries.test.ts` resolves at the `beforeStartingHands` campaign window.
 */

import { describe, expect, it } from "vitest";
import { grantAdditionalMulligans } from "./effects.js";

describe("§3.27 grantAdditionalMulligans", () => {
  it("defaults to the one additional mulligan node 5 prints", () => {
    expect(grantAdditionalMulligans()).toEqual({ kind: "grantAdditionalMulligans", amount: 1 });
    expect(grantAdditionalMulligans(2)).toEqual({ kind: "grantAdditionalMulligans", amount: 2 });
  });
});
