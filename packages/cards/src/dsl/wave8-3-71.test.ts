/**
 * docs/phase7-wave8.md §3.71: `discardDeckUntil(filter, bind, { bindAll })` and `raiseMoment(name, player, carry)`, and
 * what the validator lets the raising and the answering ability read. The engine's `discard-until-carried.test.ts`
 * drives the discard and the moment.
 */

import { describe, expect, it } from "vitest";
import { action, forcedResponse, on, response } from "./abilities.js";
import { andThen, cards, dealDamage, discardDeckUntil, moveCards, raiseMoment } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { chosen, eventPlayer, varAtLeast, varOf, you, yourIdentity } from "./values.js";

const filter = { aspect: "justice" } as const;
const amount = varOf;

describe("§3.71 a discard-until that binds every card, and a moment that carries it", () => {
  it("discardDeckUntil takes a player as before, or options with bindAll", () => {
    const bare = { kind: "discardDeckUntil", player: you, filter, bind: "found" };
    expect(discardDeckUntil(filter, "found")).toEqual(bare);
    expect(discardDeckUntil(filter, "found", eventPlayer)).toEqual({ ...bare, player: eventPlayer });
    expect(discardDeckUntil(filter, "found", { bindAll: "pulled" })).toEqual({ ...bare, bindAll: "pulled" });
    expect(discardDeckUntil(filter, "found", { bindAll: "pulled", player: eventPlayer })).toEqual({
      ...bare,
      player: eventPlayer,
      bindAll: "pulled",
    });
  });

  it("raiseMoment names the slots it carries; none leaves the effect as it was", () => {
    const bare = { kind: "raiseMoment", name: "pull", player: you };
    expect(raiseMoment("pull")).toEqual(bare);
    expect(raiseMoment("pull", you, [])).toEqual(bare);
    expect(raiseMoment("pull", you, ["pulled"])).toEqual({ ...bare, carry: ["pulled"] });
  });

  it("the raising ability reads the set's slot and totals, and may carry it once it is bound", () => {
    const pull = action(
      discardDeckUntil(filter, "found", { bindAll: "pulled" }),
      dealDamage(amount("pulled.count"), yourIdentity),
      andThen(moveCards(cards(chosen("found")), "hand")),
      moveCards(cards(chosen("pulled")), "discard"),
      raiseMoment("pull", you, ["pulled"]),
    );
    expect(validateDefinition(pull)).toEqual([]);
    expect(validateDefinition(action(raiseMoment("pull", you, ["pulled"]), discardDeckUntil(filter, "found")))).toEqual(
      ['effects[0] raiseMoment: carried slot "pulled" is not bound before the moment'],
    );
    // Without bindAll the set and its totals are not there to read.
    expect(
      validateDefinition(action(discardDeckUntil(filter, "found"), dealDamage(amount("pulled.count"), yourIdentity))),
    ).toEqual(['effects[1] dealDamage: var "pulled.count" is read before it is bound']);
  });

  it("an ability answering a moment reads what it carries as moment.<slot>; no other ability does", () => {
    const answer = [
      dealDamage(amount("moment.pulled.count"), yourIdentity),
      moveCards(cards(chosen("moment.pulled")), "discard"),
    ] as const;
    expect(validateDefinition(forcedResponse(on.moment("pull"), ...answer))).toEqual([]);
    expect(
      validateDefinition(
        response(on.moment("pull"), { while: varAtLeast("moment.pulled.mental") }, dealDamage(1, yourIdentity)),
      ),
    ).toEqual([]);
    expect(validateDefinition(action(...answer))).toEqual([
      'effects[0] dealDamage: var "moment.pulled.count" is read before it is bound',
      'effects[1] moveCards: slot "moment.pulled" is read before it is bound',
    ]);
  });
});
