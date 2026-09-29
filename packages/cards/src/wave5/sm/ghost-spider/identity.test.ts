import { describe, expect, it } from "vitest";
import {
  endTurn,
  identityOf,
  inst,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  picking,
  play,
  run,
  runWith,
  settle,
  stackEncounterDeck,
  toHero,
  use,
} from "../../../testing/harness.js";
import { moveToDiscard } from "../../../testing/staging.js";
import { WAVE5_DEPS } from "../../index.js";
import { startWave5Game } from "../../testing.js";
import { ghostSpiderScenario, ghostSpiderScenarioWithExtras } from "./support.js";

// Real Core data: the Rhino villain phase always attacks a lone player. `01186` (Advance, "The villain schemes")
// and `01101` (Hydra Mercenary) are the same neutral stack `core/heroes/spider-man.test.ts`'s own Backflip test
// uses to reach an attack.
const ADVANCE = "01186";
const HYDRA_MERCENARY = "01101";

const ghostSpiderVsRhino = (seed = 1) => startWave5Game(ghostSpiderScenario("rhino", { seed }));

describe("Ghost-Spider (identity, 27001a/b)", () => {
  it("27001a.ghost-spider-constant (Dizzying Reflexes): readies Ghost-Spider after an Interrupt on an event resolves (limit once per phase)", () => {
    // Backflip (01003, Spider-Man's own 0-cost Interrupt (defense) event) isn't in Ghost-Spider's own precon
    // (her signature events are `events.ts`, not yet scripted) — added as an extra, legality off, purely to give
    // her hand *some* real Interrupt-on-an-event ability to resolve, the same test-only relaxation
    // `wave4/vision/support.ts`'s `visionScenarioWithExtras` uses.
    const state = startWave5Game(ghostSpiderScenarioWithExtras("rhino", { seed: 1, extraCodes: ["01003"] }));
    const stacked = stackEncounterDeck(state, ADVANCE, HYDRA_MERCENARY);
    const given = moveToHand(stacked, P1, "01003");
    const [backflip] = given.ids as [never];
    const identity = identityOf(given.state, P1);
    const exhausted = patchInstance(run(given.state, toHero(P1)), identity, { exhausted: true });
    const option = `${backflip}:01003.backflip-interrupt`;
    const after = settle(
      runWith(WAVE5_DEPS, exhausted, endTurn(P1)),
      (s) => {
        const prompt = s.pendingChoice?.prompt;
        if (prompt?.kind === "payForCard" && prompt.instanceId === backflip) return []; // Backflip costs 0.
        return picking(option)(s);
      },
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, identity).damage).toBe(0); // Backflip's own effect: all damage prevented.
    expect(inst(after, identity).exhausted).toBe(false); // Dizzying Reflexes readied her.
  });

  it("27001b.gwen-stacy-action: readies George Stacy (limit once per round)", () => {
    const state = ghostSpiderVsRhino(2);
    const given = moveToHand(state, P1, "27007"); // George Stacy.
    const [stacy] = given.ids as [never];
    const withStacy = run(given.state, play(P1, stacy, payWith(given.state, P1, 1, given.ids)));
    const exhausted = patchInstance(withStacy, stacy, { exhausted: true });
    const identity = identityOf(exhausted, P1);
    const after = settle(
      runWith(WAVE5_DEPS, exhausted, use(P1, identity, "27001b.gwen-stacy-action")),
      picking("1"), // option 1: "Ready George Stacy" (the second `option(...)` in `chooseOne`).
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, stacy).exhausted).toBe(false);
    // Limit once per round: using it again this round is refused outright.
    expect(() => runWith(WAVE5_DEPS, after, use(P1, identity, "27001b.gwen-stacy-action"))).toThrow(/limit_reached/);
  });

  it("27001b.gwen-stacy-action: shuffles Ticket to the Multiverse from the discard pile into the deck", () => {
    const state = ghostSpiderVsRhino(3);
    const { state: withDiscard, id: ticket } = moveToDiscard(state, P1, "27008"); // Ticket to the Multiverse.
    const identity = identityOf(withDiscard, P1);
    const before = { deck: withDiscard.players[0]!.deck.length, discard: withDiscard.players[0]!.discard.length };
    const after = settle(
      runWith(WAVE5_DEPS, withDiscard, use(P1, identity, "27001b.gwen-stacy-action")),
      // option 0: "Shuffle Ticket to the Multiverse into your deck"; then `chooseCards` itself, min 0 max 1 —
      // `firstLegal` alone would pick the minimum (0), so Ticket is named explicitly.
      picking("0", ticket),
      undefined,
      WAVE5_DEPS,
    );
    expect(after.players[0]!.deck.length).toBe(before.deck + 1);
    expect(after.players[0]!.discard.length).toBe(before.discard - 1);
  });

  it("27001b.gwen-stacy-action: choosing to shuffle when Ticket isn't in the discard pile is a legal no-op", () => {
    const state = ghostSpiderVsRhino(4);
    const identity = identityOf(state, P1);
    const before = state.players[0]!.deck.length;
    const after = settle(
      runWith(WAVE5_DEPS, state, use(P1, identity, "27001b.gwen-stacy-action")),
      picking("0"),
      undefined,
      WAVE5_DEPS,
    );
    expect(after.players[0]!.deck.length).toBe(before); // Nothing found to shuffle: `chooseCards` picked 0.
  });
});
