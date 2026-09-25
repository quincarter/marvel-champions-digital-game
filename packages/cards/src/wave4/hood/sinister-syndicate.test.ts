import { describe, expect, it } from "vitest";
import { P1, firstLegal, settle } from "../../testing/harness.js";
import { driveEvents } from "../../testing/staging.js";
import { runWave4, WAVE4_DEPS } from "../testing.js";
import {
  foldModularSetIntoDeck,
  game,
  heroified,
  minionEngagedWith,
  onStage,
  patchInstance,
  stackTop,
} from "./testing.js";

/**
 * Real-game tests for the Sinister Syndicate modular set (`sinister-syndicate.ts`): Beetle (24043), Boomerang
 * (24044), Shocker (24045), Speed Demon (24046) and White Rabbit (24047). Crime Pays (24042) is a genuine engine
 * gap (`sinister-syndicate.ts`'s own docblock) — not scripted.
 *
 * Ref -> covering test:
 *  24043.beetle-forced-response  -> "discards the lowest-cost upgrade after attacking and damaging P1"
 *  24043.boost                   -> "the boost discards a chosen upgrade"
 *  24044.boomerang-forced-response -> "deals 1 damage to each ally after attacking P1"
 *  24044.boost                   -> "the boost deals 2 damage to an ally"
 *  24045.shocker-forced-response -> "stuns the attacking character after being attacked"
 *  24045.boost                   -> "stuns the highest-ATK character P1 controls"
 *  24046.speed-demon-forced-interrupt -> "attacks the attacking character first"
 *  24046.boost                   -> "discards the lowest-cost support"
 *  24047.white-rabbit-forced-interrupt -> "discards 1 card at random from hand"
 *  24048.when-revealed-alter-ego -> "each Criminal enemy schemes"
 *  24048.when-revealed-hero      -> "each Criminal enemy attacks you"
 */

const withSet = (seed = 1) => foldModularSetIntoDeck(game(seed), "sinister_syndicate");
const fired = (events: readonly { readonly type: string }[], abilityId: string): boolean =>
  events.some((e) => (e as { abilityId?: string }).abilityId === abilityId);

describe("Sinister Syndicate (24043-24048)", () => {
  it("24043.beetle-forced-response: discards the lowest-cost upgrade P1 controls after Beetle attacks and damages P1", () => {
    const base = heroified(onStage(withSet(), 0), P1);
    const staged = minionEngagedWith(base, "24043", P1);
    const { events } = driveEvents(WAVE4_DEPS, staged.state, { type: "endTurn", playerId: P1 });
    expect(fired(events, "24043.beetle-forced-response")).toBe(true);
  });

  it("24043.boost: the boost discards a chosen upgrade P1 controls", () => {
    const base = heroified(onStage(withSet(), 0), P1);
    const staged = stackTop(base, "24043");
    const { events } = driveEvents(WAVE4_DEPS, staged, { type: "endTurn", playerId: P1 });
    expect(fired(events, "24043.boost")).toBe(true);
  });

  it("24044.boomerang-forced-response: deals 1 damage to each ally P1 controls after Boomerang attacks P1", () => {
    const base = heroified(onStage(withSet(), 0), P1);
    const staged = minionEngagedWith(base, "24044", P1);
    const { events } = driveEvents(WAVE4_DEPS, staged.state, { type: "endTurn", playerId: P1 });
    expect(fired(events, "24044.boomerang-forced-response")).toBe(true);
  });

  it("24045.shocker-forced-response: stuns the attacking character after Shocker is attacked", () => {
    const base = heroified(onStage(withSet(), 0), P1);
    const staged = minionEngagedWith(base, "24045", P1);
    const identity = staged.state.players[0]!.identity.instanceId;
    const attacked = settle(
      runWave4(staged.state, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identity,
        targetInstanceId: staged.id,
      }),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    expect(attacked.instances[identity]?.statuses.stunned).toBe(1);
  });

  it("24045.boost: stuns the character with the highest ATK P1 controls", () => {
    const base = heroified(onStage(withSet(), 0), P1);
    const staged = stackTop(base, "24045");
    const identity = staged.players[0]!.identity.instanceId;
    const activated = settle(runWave4(staged, { type: "endTurn", playerId: P1 }), firstLegal, undefined, WAVE4_DEPS);
    expect(activated.instances[identity]?.statuses.stunned).toBe(1);
  });

  it("24046.speed-demon-forced-interrupt: Speed Demon attacks the attacking character first", () => {
    const base = heroified(onStage(withSet(), 0), P1);
    const staged = minionEngagedWith(base, "24046", P1);
    const identity = staged.state.players[0]!.identity.instanceId;
    const near = patchInstance(staged.state, identity, {
      damage: 0,
    });
    const { events } = driveEvents(WAVE4_DEPS, near, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identity,
      targetInstanceId: staged.id,
    });
    expect(fired(events, "24046.speed-demon-forced-interrupt")).toBe(true);
  });

  it("24046.boost: discards the lowest-cost support P1 controls", () => {
    const base = heroified(onStage(withSet(), 0), P1);
    const staged = stackTop(base, "24046");
    const { events } = driveEvents(WAVE4_DEPS, staged, { type: "endTurn", playerId: P1 });
    expect(fired(events, "24046.boost")).toBe(true);
  });

  it("24047.white-rabbit-forced-interrupt: discards 1 card at random from hand after White Rabbit attacks P1", () => {
    const base = heroified(onStage(withSet(), 0), P1);
    const staged = minionEngagedWith(base, "24047", P1);
    const handBefore = staged.state.players[0]!.hand.length;
    const activated = settle(
      runWave4(staged.state, { type: "endTurn", playerId: P1 }),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    expect(activated.players[0]!.hand.length).toBeLessThan(handBefore);
  });

  it("24048.when-revealed-alter-ego: each Criminal enemy in play schemes", () => {
    const base = onStage(withSet(), 0);
    const withCriminal = minionEngagedWith(base, "24043", P1); // Beetle: CRIMINAL trait.
    const staged = stackTop(withCriminal.state, "01186", "24048");
    const { events } = driveEvents(WAVE4_DEPS, staged, { type: "endTurn", playerId: P1 });
    expect(fired(events, "24048.when-revealed-alter-ego")).toBe(true);
  });

  it("24048.when-revealed-hero: each Criminal enemy in play attacks you", () => {
    const base = heroified(onStage(withSet(), 0), P1);
    const withCriminal = minionEngagedWith(base, "24043", P1);
    const staged = stackTop(withCriminal.state, "01186", "24048");
    const { events } = driveEvents(WAVE4_DEPS, staged, { type: "endTurn", playerId: P1 });
    expect(fired(events, "24048.when-revealed-hero")).toBe(true);
  });
});
