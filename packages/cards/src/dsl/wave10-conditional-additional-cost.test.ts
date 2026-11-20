import { trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import { additionalCostToPlay, costIf, eitherCost, exhaustThis, giveStatusCost } from "./abilities.js";
import { addCounters } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { self, varOf, youHaveTrait, yourIdentity } from "./values.js";

/**
 * docs/phase7-wave10-hero-packs.md H8.4 (Gilgamesh, `hercules` 59025): the DSL surface of a conditional part in an
 * additional cost to play, "As an additional cost to play this card, if you do not have the Eternal trait, confuse
 * your identity." The engine's behavior is tested in
 * `packages/engine/src/conditional-additional-play-cost.test.ts` and with the card in `wave10/hercules/basic.test.ts`.
 */
describe("additionalCostToPlay with a costIf part", () => {
  const ETERNAL = trait("ETERNAL");
  const confuseYourself = giveStatusCost(yourIdentity, "confused");
  const gilgamesh = additionalCostToPlay(costIf(youHaveTrait(ETERNAL), {}, confuseYourself));

  it("builds a constant whose cost is the board's pick between nothing and confusing your identity", () => {
    expect(gilgamesh.trigger).toEqual({ kind: "constant", additionalCostToPlay: {} });
    expect(gilgamesh.cost).toEqual({
      conditional: {
        condition: { kind: "hasTrait", of: yourIdentity, trait: ETERNAL },
        then: {},
        else: { giveStatus: { status: "confused", to: yourIdentity } },
      },
    });
    expect(gilgamesh.effects).toEqual([]);
    expect(validateDefinition(gilgamesh)).toEqual([]);
  });

  it("other components may stand beside the conditional part", () => {
    const beside = additionalCostToPlay({ ...confuseYourself, ...costIf(youHaveTrait(ETERNAL), {}, exhaustThis) });
    expect(validateDefinition(beside)).toEqual([]);
  });

  it("resources stay refused, in a branch as outside one", () => {
    const refusal = "an additional cost to play has no resources";
    expect(validateDefinition(additionalCostToPlay({ ...confuseYourself, resources: 1 }))).toContain(refusal);
    expect(validateDefinition(additionalCostToPlay(costIf(youHaveTrait(ETERNAL), {}, { resources: 1 })))).toContain(
      refusal,
    );
    expect(validateDefinition(additionalCostToPlay(eitherCost(confuseYourself, { resources: 1 })))).toContain(refusal);
  });

  // The player's pick, named in the play command's costSelection.branch ("exhaust or destroy Arms (Intact)",
  // `sentinel-tw`; #890 item 11).
  it("an either/or choice is accepted, in a branch as outside one", () => {
    expect(validateDefinition(additionalCostToPlay(eitherCost(confuseYourself, exhaustThis)))).toEqual([]);
    expect(
      validateDefinition(
        additionalCostToPlay(costIf(youHaveTrait(ETERNAL), {}, eitherCost(confuseYourself, exhaustThis))),
      ),
    ).toEqual([]);
  });

  it("a branch cannot itself be conditional, as in any cost", () => {
    const nested = additionalCostToPlay(
      costIf(youHaveTrait(ETERNAL), {}, costIf(youHaveTrait(ETERNAL), {}, confuseYourself)),
    );
    expect(validateDefinition(nested)).toContain("cost conditional: a branch cannot itself be conditional");
  });

  // The pick is made as the play is priced and is not recorded (engine `playCostWith`), so nothing can read it.
  it("its effects cannot read cost.condition", () => {
    const reads = additionalCostToPlay(
      costIf(youHaveTrait(ETERNAL), {}, confuseYourself),
      {},
      addCounters("branch", varOf("cost.condition"), self),
    );
    expect(validateDefinition(reads).join("\n")).toContain("cost.condition");
  });
});
