/**
 * docs/phase7-wave6.md §3.74: permanent cards are set aside before setup step 1 (RRG 1.8 "Permanent", p. 32), so
 * "Setup: Put [your permanent card] into play" is `putIntoPlayFromSetAside` (`permanent-set-aside.test.ts` in the
 * engine drives it; Vision's and Spectrum's Setups use it).
 */

import { describe, expect, it } from "vitest";
import { setup } from "./abilities.js";
import { putIntoPlayFromSetAside, turnFacedown } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { chosen, query, yourIdentity } from "./values.js";

describe("§3.74 `putIntoPlayFromSetAside`", () => {
  it("Logan's shape: put the named upgrade into play from your set-aside area, attached to your identity", () => {
    const definition = setup(
      putIntoPlayFromSetAside("claws", query("upgrade", { name: "Wolverine's Claws" }), { attachTo: yourIdentity }),
    );
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.effects).toEqual([
      {
        kind: "selectCards",
        slot: "claws",
        cards: {
          kind: "setAside",
          player: { kind: "controller" },
          filter: { categories: ["upgrade"], name: "Wolverine's Claws" },
        },
      },
      { kind: "putIntoPlay", card: { kind: "slot", slot: "claws" }, controller: { kind: "controller" } },
      { kind: "attach", card: { kind: "slot", slot: "claws" }, to: yourIdentity },
    ]);
  });

  it("no attachTo: into your play area only (Spectrum's energy forms, then turned facedown)", () => {
    const definition = setup(putIntoPlayFromSetAside("forms", query("upgrade")), turnFacedown(chosen("forms")));
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.effects.map((e) => e.kind)).toEqual(["selectCards", "putIntoPlay", "turnFacedown"]);
  });
});
