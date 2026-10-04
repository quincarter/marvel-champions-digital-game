/**
 * docs/phase7-wave6.md §3.40: the basic recovery as an event. `on.basicRecovery` names the recovery's healing, so
 * `instead(...)` on it is Death Factor's "… instead of healing damage" (§4.1 Q20; the engine's
 * `basic-recovery-event.test.ts` drives it).
 */

import { describe, expect, it } from "vitest";
import { alterEgoInterrupt, on } from "./abilities.js";
import { discard, instead } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { self, YOUR_IDENTITY } from "./values.js";

describe("§3.40 `on.basicRecovery`", () => {
  it("Death Factor's shape: an alter-ego interrupt replacing the healing", () => {
    const definition = alterEgoInterrupt(on.basicRecovery(YOUR_IDENTITY), instead(discard(self)));
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.trigger).toMatchObject({
      kind: "interrupt",
      form: "alterEgo",
      on: { on: "basicRecovery", targetIs: { categories: ["identity"], controller: "you" } },
    });
    expect(definition.effects).toEqual([
      { kind: "replaceTriggeringEvent", with: [{ kind: "discardFromPlay", target: { kind: "self" } }] },
    ]);
  });
});
