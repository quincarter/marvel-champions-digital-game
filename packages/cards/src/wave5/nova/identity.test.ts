import { describe, expect, it } from "vitest";
import type { GameState, InstanceId, PlayerId } from "@mc/engine";
import { cardId } from "@mc/content";
import {
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  play,
  playerOf,
  run,
  runWith,
  settle,
  toHero,
  use,
  type Picker,
} from "../../testing/harness.js";
import { moveToDiscard } from "../../testing/staging.js";
import { WAVE5_CARDS } from "../cards.js";
import { WAVE5_DEPS } from "../index.js";
import { startWave5Game } from "../testing.js";
import { novaScenarioWithExtras } from "./support.js";

// Real Core data: the Rhino villain phase always attacks a lone player — the same neutral target `qsv/kit.test.ts`
// and Ghost-Spider's own identity test both use to exercise a basic power.
const novaVsRhino = (seed = 1, extraCodes: readonly string[] = []) =>
  startWave5Game(novaScenarioWithExtras("rhino", { seed, extraCodes }));

/** The first hand card that does **not** produce a [wild] resource when spent (Nova's own precon carries three
 * Basic resource cards that do — Connection to the Worldmind 28007, The Power of Aggression 28015, Everyday Hero
 * 28019, each `producesIcons: { wild: 1 }` — so an arbitrary first-hand-card payer can accidentally pay the "if you
 * paid … using a [wild] resource" branch this test isn't exercising). */
function nonWildPayer(state: GameState, player: PlayerId): InstanceId {
  const hand = playerOf(state, player).hand;
  const found = hand.find((id) => {
    const cardId = state.instances[id]?.cardId;
    const card = WAVE5_CARDS.find((c) => c.id === cardId);
    return card && !("producesIcons" in card && card.producesIcons?.wild);
  });
  if (!found) throw new Error(`${player} has no non-wild-producing hand card to pay with`);
  return found;
}

/** Accepts the named optional responses/interrupts (a trigger's option id is `<instance>:<ability>`); picks
 * `want` (if given) at whatever `chooseCards`/target prompt follows. Ghost-Spider's `identity.test.ts`/
 * `events-a.test.ts` own `accepting()` precedent. */
const accepting =
  (wantedAbility: string, want: readonly InstanceId[] = []): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    if (choice.prompt.kind === "chooseCards") return want;
    const hits = choice.options
      .map((o) => o.optionId)
      .filter((id) => id === wantedAbility || id.endsWith(`:${wantedAbility}`));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

describe("Nova (identity, 28001a/b)", () => {
  it("28001a.nova-response: readies Supernova Helmet after Nova uses a basic power", () => {
    // Supernova Helmet (28009) is Nova's own real precon card (quantity 1) — played normally so it attaches to
    // the identity by its default host (it prints no `attachesTo`), the same "an upgrade with no printed host
    // attaches to your own identity" rule any ordinary upgrade play already resolves.
    const hero = run(novaVsRhino(2), toHero(P1));
    const { state: withHelmet, id: helmet } = (() => {
      const given = moveToHand(hero, P1, "28009");
      const [id] = given.ids as [InstanceId];
      const played = run(given.state, play(P1, id, payWith(given.state, P1, 1, [id])));
      return { state: played, id };
    })();
    const identity = identityOf(withHelmet, P1);
    // Exhausted directly (its own Hero Resource ability would normally do this), so Nova's Response has something
    // to ready.
    const exhausted = patchInstance(withHelmet, helmet, { exhausted: true });
    const villain = exhausted.villains[0]!.instanceId;
    const after = settle(
      runWith(WAVE5_DEPS, exhausted, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identity,
        targetInstanceId: villain,
      }),
      accepting("28001a.nova-response"),
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, helmet).exhausted).toBe(false); // Nova's Response readied it.
  });

  it("28001b.sam-alexander-action: finds Supernova Helmet in the discard pile and adds it to hand when paid without a wild resource", () => {
    const state = novaVsRhino(3);
    const { state: withDiscard, id: helmet } = moveToDiscard(state, P1, "28009");
    const identity = identityOf(withDiscard, P1);
    const payer = nonWildPayer(withDiscard, P1);
    const before = { hand: playerOf(withDiscard, P1).hand.length, discard: playerOf(withDiscard, P1).discard.length };
    const after = settle(
      runWith(WAVE5_DEPS, withDiscard, use(P1, identity, "28001b.sam-alexander-action", [{ fromHand: payer }])),
      accepting("28001b.sam-alexander-action", [helmet]),
      undefined,
      WAVE5_DEPS,
    );
    // The card paying the cost left the hand for the discard pile, but the found Helmet left the discard pile for
    // the hand: both zones net 0 (a spent resource card is discarded, same as any other cost payment).
    expect(playerOf(after, P1).hand.length).toBe(before.hand);
    expect(playerOf(after, P1).hand).toContain(helmet);
    expect(playerOf(after, P1).discard.length).toBe(before.discard);
    expect(playerOf(after, P1).discard).not.toContain(helmet);
    expect(inst(after, helmet).attachedTo).toBeNull();
  });

  it("28001b.sam-alexander-action: puts Supernova Helmet into play attached to Nova instead, when paid with a [wild] resource", () => {
    // Wakanda Forever! (Core 01043d) prints a [wild] resource icon — added as an extra purely to fund the cost with
    // a wild resource, legality off, the same test-only relaxation Ghost-Spider's `ghostSpiderScenarioWithExtras`
    // precedent uses for a card outside the real precon.
    const state = novaVsRhino(4, ["01043d"]);
    const identity = identityOf(state, P1);
    const helmet = playerOf(state, P1).deck.find(
      (id) => state.instances[id]?.cardId === cardId("28009") /* Supernova Helmet */,
    );
    if (!helmet) throw new Error("Supernova Helmet not found in Nova's deck");
    const { state: withWild, ids: wildIds } = moveToHand(state, P1, "01043d");
    const [wild] = wildIds as [InstanceId];
    const after = settle(
      runWith(WAVE5_DEPS, withWild, use(P1, identity, "28001b.sam-alexander-action", [{ fromHand: wild }])),
      accepting("28001b.sam-alexander-action", [helmet]),
      undefined,
      WAVE5_DEPS,
    );
    expect(playerOf(after, P1).hand).not.toContain(helmet);
    expect(inst(after, helmet).attachedTo).toBe(identity); // Put into play attached to Nova, not added to hand.
  });

  it("28001b.sam-alexander-action: choosing no card when Supernova Helmet isn't in the deck or discard pile is a legal no-op", () => {
    // Moved to hand (not deck/discard), so `zone(["deck", "discard"], …)` has nothing to find — `chooseCards`
    // `min: 0` lets the player choose none, the same forgiving no-op Ghost-Spider's own Ticket to the Multiverse
    // test (`identity.test.ts`) exercises for a card that isn't where the search looks.
    const state = novaVsRhino(5);
    const { state: withHelmetInHand, ids } = moveToHand(state, P1, "28009");
    const [helmet] = ids as [InstanceId];
    const identity = identityOf(withHelmetInHand, P1);
    const payer = nonWildPayer(withHelmetInHand, P1);
    const before = { hand: playerOf(withHelmetInHand, P1).hand.length };
    const after = settle(
      runWith(WAVE5_DEPS, withHelmetInHand, use(P1, identity, "28001b.sam-alexander-action", [{ fromHand: payer }])),
      accepting("28001b.sam-alexander-action"),
      undefined,
      WAVE5_DEPS,
    );
    // The payer card left the hand for the cost; Supernova Helmet itself stayed put untouched.
    expect(playerOf(after, P1).hand.length).toBe(before.hand - 1);
    expect(playerOf(after, P1).hand).toContain(helmet);
  });
});
