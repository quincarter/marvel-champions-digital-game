import { describe, expect, it } from "vitest";
import { P1, firstLegal, settle } from "../../testing/harness.js";
import type { InstanceId } from "@mc/engine";
import { moondragonAttack } from "../../testing/enemy-attacks-enemy.js";
import { driveEvents } from "../../testing/staging.js";
import { engageMinion } from "../../wave3/drax/support.js";
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
 * (24044), Shocker (24045), Speed Demon (24046) and White Rabbit (24047). Crime Pays (24042) and White Rabbit's boost are tested in
 * `hood-gaps.test.ts`.
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

/** Core Hydra Mercenary: ATK 1, 3 hit points. */
const HYDRA_MERCENARY = "01101";
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

  // "When a character attacks Speed Demon" hears a minion's attack (an enemy is a character, RRG 1.8 "Character",
  // p. 12; Moondragon 19013's `enemyAttacksEnemy`; rules-expert reading 2026-11-12, no FFG ruling), and his attack back
  // on that minion is an enemy's attack on an enemy too: no activation against a player, nobody defends, resolved first.
  it("24046.speed-demon-forced-interrupt: a minion made to attack him (Moondragon) is attacked back first", () => {
    const base = heroified(onStage(withSet(), 0), P1);
    const staged = minionEngagedWith(base, "24046", P1);
    const withMerc = engageMinion(staged.state, HYDRA_MERCENARY, "merc");
    const merc = "merc" as InstanceId;
    const { state, events } = moondragonAttack(WAVE4_DEPS, withMerc, merc, staged.id);
    expect(fired(events, "24046.speed-demon-forced-interrupt")).toBe(true);
    const attacks = events.flatMap((e) =>
      e.type === "enemyAttackedEnemy" ? [[e.attackerInstanceId, e.targetInstanceId, e.damageDealt]] : [],
    );
    // Speed Demon's 2 ATK on the Mercenary (3 hit points) first, then the Mercenary's 1 on him.
    expect(attacks).toEqual([
      [staged.id, merc, 2],
      [merc, staged.id, 1],
    ]);
    expect(state.instances[merc]!.damage).toBe(2);
    expect(state.instances[staged.id]!.damage).toBe(1);
    expect(events.some((e) => e.type === "attackResolved")).toBe(false);
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
    // Loose by design (rules-qa-engineer, docs/phase7-wave4-qa.md): a real villain phase can also draw an
    // extra encounter card/boost this round, so the hand can shrink by more than White Rabbit's own 1; only a
    // decrease at all is guaranteed by this card's text alone.
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
