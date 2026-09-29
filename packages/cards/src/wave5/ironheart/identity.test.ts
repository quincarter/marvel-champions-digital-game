import { describe, expect, it } from "vitest";
import type { GameState, InstanceId, PlayerId } from "@mc/engine";
import { handSize, maxHitPoints } from "@mc/engine";
import { cardId } from "@mc/content";
import {
  firstLegal,
  identityOf,
  inst,
  patchInstance,
  payWith,
  playerOf,
  run,
  runWith,
  settle,
  toHero,
  use,
  P1,
} from "../../testing/harness.js";
import { WAVE5_CARDS } from "../cards.js";
import { WAVE5_DEPS } from "../index.js";
import { startWave5Game } from "../testing.js";
import { ironheartScenario } from "./support.js";

const ironheartVsRhino = (seed = 1) => startWave5Game(ironheartScenario("rhino", { seed }));

const IDENTITY_VERSIONS = new Set([cardId("29001a"), cardId("29002a"), cardId("29003a")]);

/** `PlayerState.setAside` also holds the not-yet-in-play nemesis set (Lucia von Bardas et al., §2.1) — filter to
 * just the progressing identity's own set-aside versions. */
function setAsideVersions(state: GameState, player: PlayerId): readonly string[] {
  return playerOf(state, player)
    .setAside.map((id) => inst(state, id).cardId)
    .filter((id) => IDENTITY_VERSIONS.has(id));
}

/** Bypasses the "once per round" form-change limit as test-only state surgery (`progressing-identity.test.ts`'s own
 * precedent) — a test that already used its one change getting to hero form for Level Up! still needs alter-ego
 * form afterward, in the same round, to exercise Child Prodigy. */
function forceForm(state: GameState, player: PlayerId, form: "hero" | "alterEgo"): GameState {
  return {
    ...state,
    players: state.players.map((p) => (p.playerId === player ? { ...p, identity: { ...p.identity, form } } : p)),
  };
}

/** The first hand card that produces a [mental] resource icon (Fly Over, 29005, qty 2 in the real precon) — for
 * "Spend a [mental] resource →" costs. Mirrors Nova's `nonWildPayer` precedent (`wave5/nova/identity.test.ts`). */
function mentalPayer(state: GameState, player: PlayerId): InstanceId {
  const hand = playerOf(state, player).hand;
  const found = hand.find((id) => {
    const cid = state.instances[id]?.cardId;
    const card = WAVE5_CARDS.find((c) => c.id === cid);
    return card && "resourceIcons" in card && card.resourceIcons?.mental;
  });
  if (!found) throw new Error(`${player} has no [mental]-producing hand card to pay with`);
  return found;
}

describe("Ironheart (identity, 29001a-29003a/29001b-29003b)", () => {
  it("setup (29001b.riri-williams-constant): seats Version 1 in play, sets Version 2 and 3 aside", () => {
    // "Begin the game with this card. Set your other identities aside." is data (progressingIdentity), not an
    // ability effect — `createGame` itself does this from `HeroIdentityCard.progressingIdentity.versions`
    // (docs/phase7-wave5.md §1.4/§3.23); the ability id exists only so the printed sentence has a ref
    // (`coveredByEngineRule()`).
    const state = ironheartVsRhino();
    const seat = playerOf(state, P1);
    expect(inst(state, seat.identity.instanceId).cardId).toBe(cardId("29001a"));
    expect(setAsideVersions(state, P1)).toEqual([cardId("29002a"), cardId("29003a")]);
    expect(handSize(state, P1, WAVE5_DEPS)).toBe(6); // alter-ego (Riri Williams) hand size, every version.
  });

  it("29001a.level-up: removing 6 progress counters readies Ironheart and swaps her to Version 2, dial and damage carried", () => {
    const hero = run(ironheartVsRhino(2), toHero(P1));
    const identity = identityOf(hero, P1);
    const readyToLevel = patchInstance(hero, identity, { counters: { progress: 6 }, exhausted: true, damage: 3 });
    const after = settle(
      runWith(WAVE5_DEPS, readyToLevel, use(P1, identity, "29001a.level-up")),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    const seat = playerOf(after, P1);
    expect(seat.identity).toMatchObject({ instanceId: identity, cardId: cardId("29002a"), form: "hero" });
    const afterInst = inst(after, identity);
    expect(afterInst.exhausted).toBe(false); // "ready her"
    expect(afterInst.damage).toBe(3); // the dial's damage persists (RRG 1.8 "Swap", p. 42)
    expect(afterInst.counters.progress ?? 0).toBe(0); // the cost removed all 6
    expect(afterInst.statuses.tough).toBe(0); // Version 1's Level Up! prints no tough (unlike Version 2's)
    expect(maxHitPoints(after, identity)).toBe(10); // both versions print 10 hp; the dial's max is unchanged
    expect(handSize(after, P1, WAVE5_DEPS)).toBe(5); // Version 2's hero-face hand size (3 + 2)
    expect(setAsideVersions(after, P1)).toEqual([cardId("29001a"), cardId("29003a")]);
  });

  it("29001a.level-up: fewer than 6 progress counters is not a legal cost", () => {
    const hero = run(ironheartVsRhino(3), toHero(P1));
    const identity = identityOf(hero, P1);
    const short = patchInstance(hero, identity, { counters: { progress: 5 } });
    expect(() => runWith(WAVE5_DEPS, short, use(P1, identity, "29001a.level-up"))).toThrow();
  });

  it("29002a.level-up: removing 6 progress counters readies Ironheart, gives her tough, and swaps her to Version 3", () => {
    // First actually level Ironheart up to Version 2 through her own Version 1 ability (already asserted above),
    // then exercise Version 2's own Level Up!.
    const hero = run(ironheartVsRhino(4), toHero(P1));
    const identity = identityOf(hero, P1);
    const toV2 = settle(
      runWith(
        WAVE5_DEPS,
        patchInstance(hero, identity, { counters: { progress: 6 } }),
        use(P1, identity, "29001a.level-up"),
      ),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    const readyToLevelAgain = patchInstance(toV2, identity, { counters: { progress: 6 }, exhausted: true });
    const after = settle(
      runWith(WAVE5_DEPS, readyToLevelAgain, use(P1, identity, "29002a.level-up")),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    const seat = playerOf(after, P1);
    expect(seat.identity).toMatchObject({ instanceId: identity, cardId: cardId("29003a"), form: "hero" });
    const afterInst = inst(after, identity);
    expect(afterInst.exhausted).toBe(false); // "ready her"
    expect(afterInst.statuses.tough).toBe(1); // "give her a tough status card"
    expect(afterInst.counters.progress ?? 0).toBe(0);
    expect(handSize(after, P1, WAVE5_DEPS)).toBe(6); // Version 3's hero-face hand size (3 + 3)
    expect(setAsideVersions(after, P1)).toEqual([cardId("29001a"), cardId("29002a")]);
  });

  it("29003a.maximum-efficiency: removing 1 progress counter deals 2 damage to an enemy", () => {
    // Level up twice (Version 1 -> 2 -> 3) so Maximum Efficiency (printed only on Version 3) is available.
    const hero = run(ironheartVsRhino(5), toHero(P1));
    const identity = identityOf(hero, P1);
    const toV2 = settle(
      runWith(
        WAVE5_DEPS,
        patchInstance(hero, identity, { counters: { progress: 6 } }),
        use(P1, identity, "29001a.level-up"),
      ),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    const toV3 = settle(
      runWith(
        WAVE5_DEPS,
        patchInstance(toV2, identity, { counters: { progress: 6 } }),
        use(P1, identity, "29002a.level-up"),
      ),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    const readyForMax = patchInstance(toV3, identity, { counters: { progress: 1 } });
    const villain = readyForMax.villains[0]!.instanceId;
    const damageBefore = inst(readyForMax, villain).damage;
    const after = settle(
      runWith(WAVE5_DEPS, readyForMax, use(P1, identity, "29003a.maximum-efficiency")),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, villain).damage).toBe(damageBefore + 2);
    expect(inst(after, identity).counters.progress ?? 0).toBe(0); // the cost removed the 1 progress counter
  });

  it("29003a.maximum-efficiency: no progress counters on Ironheart is not a legal cost", () => {
    const hero = run(ironheartVsRhino(6), toHero(P1));
    const identity = identityOf(hero, P1);
    // Force Ironheart onto Version 3 directly (the ability only exists on that face) without paying its own cost,
    // purely to check Maximum Efficiency's own cost legality in isolation.
    const forcedV3: GameState = {
      ...hero,
      instances: { ...hero.instances, [identity]: { ...inst(hero, identity), cardId: cardId("29003a") } },
      players: hero.players.map((p) =>
        p.playerId === P1 ? { ...p, identity: { ...p.identity, cardId: cardId("29003a") } } : p,
      ),
    };
    expect(() => runWith(WAVE5_DEPS, forcedV3, use(P1, identity, "29003a.maximum-efficiency"))).toThrow();
  });

  it("29001b.child-prodigy: spending a [mental] resource places 1 progress counter on Riri Williams (limit once per round)", () => {
    const state = ironheartVsRhino(7);
    const identity = identityOf(state, P1);
    const payer = mentalPayer(state, P1);
    const before = inst(state, identity).counters.progress ?? 0;
    const after = runWith(WAVE5_DEPS, state, use(P1, identity, "29001b.child-prodigy", [{ fromHand: payer }]));
    expect(inst(after, identity).counters.progress ?? 0).toBe(before + 1);
    // Limit once per round: a second use this round, even with another [mental] payer, is refused.
    const secondPayer = mentalPayer(after, P1);
    expect(() =>
      runWith(WAVE5_DEPS, after, use(P1, identity, "29001b.child-prodigy", [{ fromHand: secondPayer }])),
    ).toThrow();
  });

  it("29002b.child-prodigy: pays with a [mental] resource (branch 0) or 2 resources of any type (branch 1), either way placing 1 progress counter", () => {
    const hero = run(ironheartVsRhino(8), toHero(P1));
    const identity = identityOf(hero, P1);
    const toV2 = settle(
      runWith(
        WAVE5_DEPS,
        patchInstance(hero, identity, { counters: { progress: 6 } }),
        use(P1, identity, "29001a.level-up"),
      ),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    // Version 2's Child Prodigy is an Alter-Ego Action: this round already spent its one form change getting to
    // hero form for Level Up!, so getting back to alter-ego form is test-only state surgery (`forceForm`).
    const alterEgo = forceForm(toV2, P1, "alterEgo");
    const mentalPayerId = mentalPayer(alterEgo, P1);
    const branchMental = runWith(
      WAVE5_DEPS,
      alterEgo,
      use(P1, identity, "29002b.child-prodigy", [{ fromHand: mentalPayerId }], undefined, { branch: 0 }),
    );
    expect(inst(branchMental, identity).counters.progress ?? 0).toBe(1);

    // A fresh Version 2 seat (same seed's opening hand), paying with 2 generic resources instead (branch 1).
    const anyTwo = payWith(alterEgo, P1, 2);
    const branchGeneric = runWith(
      WAVE5_DEPS,
      alterEgo,
      use(
        P1,
        identity,
        "29002b.child-prodigy",
        anyTwo.map((fromHand) => ({ fromHand })),
        undefined,
        { branch: 1 },
      ),
    );
    expect(inst(branchGeneric, identity).counters.progress ?? 0).toBe(1);
  });

  it("29003b.child-prodigy: spending 1 resource of any type places 1 progress counter on Riri Williams (limit once per round)", () => {
    const hero = run(ironheartVsRhino(9), toHero(P1));
    const identity = identityOf(hero, P1);
    const toV2 = settle(
      runWith(
        WAVE5_DEPS,
        patchInstance(hero, identity, { counters: { progress: 6 } }),
        use(P1, identity, "29001a.level-up"),
      ),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    const toV3 = settle(
      runWith(
        WAVE5_DEPS,
        patchInstance(toV2, identity, { counters: { progress: 6 } }),
        use(P1, identity, "29002a.level-up"),
      ),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    // This round already spent its one form change getting to hero form for the two Level Up!s (forceForm again).
    const alterEgo = forceForm(toV3, P1, "alterEgo");
    const payer = payWith(alterEgo, P1, 1);
    const after = runWith(
      WAVE5_DEPS,
      alterEgo,
      use(
        P1,
        identity,
        "29003b.child-prodigy",
        payer.map((fromHand) => ({ fromHand })),
      ),
    );
    expect(inst(after, identity).counters.progress ?? 0).toBe(1);
    const secondPayer = payWith(after, P1, 1);
    expect(() =>
      runWith(
        WAVE5_DEPS,
        after,
        use(
          P1,
          identity,
          "29003b.child-prodigy",
          secondPayer.map((fromHand) => ({ fromHand })),
        ),
      ),
    ).toThrow(); // limit once per round
  });
});
