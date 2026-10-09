/**
 * `dividedBasicPowerValue` and `setBasicPowerStat` (`actions.ts`), by name (code review, Piece 10b).
 *
 * `dividedBasicPowerValue`: what a character has to divide when it divides its basic power (`RuleSpec
 * divideBasicPower`, docs/phase7-wave2.md §3.7) is its stat as it reads during that use, so "+1 ATK while making a
 * basic attack" counts for a divided attack as "+1 THW while making a basic thwart against this scheme" counts for a
 * divided thwart. Before, only a thwart was staged, and a divided attack read its ATK as if no attack were being made.
 *
 * Sources: RRG 1.8 "Modifiers" (p. 29: a value is recalculated with every active modifier); FAQ "Wasp (#1C)" (p. 61:
 * "Wasp's second ability allows her basic attack to simultaneously damage each enemy that Wasp chooses": the divided
 * attack is her basic attack); "Basic Power" (p. 10).
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import { dividedBasicPowerValue, setBasicPowerStat } from "./actions.js";
import type { Command } from "./commands.js";
import { createCtx } from "./ctx.js";
import { applyCommand } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { characterProfile, mustInstance, mustPlayer } from "./query.js";
import { pushEvent } from "./resolve/frames.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import { stubAlly, stubMinion, stubSideScheme } from "./testing/fixtures.js";
import { TREACHERY } from "./testing/scenario.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  minionEngagedWith,
  P1,
  playerCardIntoPlay,
} from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const SELF = { self: true } as const;

/** "This character may divide its basic attack among any number of enemies, and its basic thwart among schemes." */
const SPLIT = stubAbility(
  "striker.split",
  def({
    trigger: {
      kind: "constant",
      rules: [
        { kind: "divideBasicPower", power: "attack", target: SELF },
        { kind: "divideBasicPower", power: "thwart", target: SELF },
      ],
    },
    effects: [],
  }),
);
/** "This character gets +1 ATK while making a basic attack" and "+1 THW while making a basic thwart against 'marked'." */
const SURGE = stubAbility(
  "striker.surge",
  def({
    trigger: {
      kind: "constant",
      modifiers: [
        { stat: "atk", amount: 1, target: SELF, while: { kind: "attackInProgress", basic: true, attacker: SELF } },
        {
          stat: "thw",
          amount: 1,
          target: SELF,
          while: { kind: "thwartInProgress", basic: true, thwarter: SELF, scheme: { name: "marked" } },
        },
      ],
    },
    effects: [],
  }),
);
const STRIKER = stubAlly({ id: "striker", cost: 0, atk: 2, thw: 2, hp: 5, abilities: [SPLIT.ref, SURGE.ref] });
const THUG = stubMinion({ id: "thug", atk: 1, sch: 1, hp: 10 });
const MARKED = stubSideScheme({ id: "marked", startingThreat: 6 });
const PLAIN = stubSideScheme({ id: "plain", startingThreat: 6 });
const deps: EngineDeps = depsOf(SPLIT, SURGE);

interface Table {
  readonly state: GameState;
  readonly striker: InstanceId;
  readonly villain: InstanceId;
  readonly thug: InstanceId;
  readonly marked: InstanceId;
  readonly plain: InstanceId;
}
function table(): Table {
  const base = gameAtFirstTurn({
    cards: [STRIKER, THUG, MARKED, PLAIN],
    deps,
    deck: [STRIKER.id],
    encounter: [THUG.id, MARKED.id, PLAIN.id, ...copiesOf(TREACHERY.id, 26)],
  });
  const striker = playerCardIntoPlay(base, STRIKER.id);
  const thug = minionEngagedWith(striker.state, THUG.id);
  const marked = encounterCardInVillainArea(thug.state, MARKED.id, 6);
  const plain = encounterCardInVillainArea(marked.state, PLAIN.id, 6);
  return {
    state: plain.state,
    striker: striker.id,
    villain: plain.state.villains[0]!.instanceId,
    thug: thug.id,
    marked: marked.id,
    plain: plain.id,
  };
}
const damage = (state: GameState, id: InstanceId): number => mustInstance(state, id).damage;
const threat = (state: GameState, id: InstanceId): number => mustInstance(state, id).threat;

describe("dividedBasicPowerValue", () => {
  it("a divided basic attack reads '+1 ATK while making a basic attack': ATK 2 + 1 is what there is to divide", () => {
    const t = table();
    // Outside an attack the bonus is not there.
    expect(characterProfile(t.state, t.striker, deps)?.atk).toBe(2);
    expect(dividedBasicPowerValue(t.state, deps, P1, t.striker, "attack", "atk", [t.villain, t.thug])).toBe(3);
    // Reading it staged nothing in the game it was asked about.
    expect(t.state.stack).toEqual([]);

    const attack = (shares: readonly [number, number]): Command => ({
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: t.striker,
      targetInstanceId: t.villain,
      divide: [
        { targetInstanceId: t.villain, amount: shares[0] },
        { targetInstanceId: t.thug, amount: shares[1] },
      ],
    });
    const after = runCommands(t.state, deps, attack([2, 1])).state;
    expect([damage(after, t.villain), damage(after, t.thug)]).toEqual([2, 1]);
    // Shares that total the ATK read outside the attack are short of it, and refused.
    expect(applyCommand(t.state, attack([1, 1]), deps).ok).toBe(false);
    // The undivided attack deals the same 3: the two read the same ATK.
    const whole = runCommands(t.state, deps, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: t.striker,
      targetInstanceId: t.thug,
    }).state;
    expect(damage(whole, t.thug)).toBe(3);
  });

  it("a divided basic thwart reads '+1 THW while making a basic thwart against this scheme' when it is any of its schemes", () => {
    const t = table();
    const main = t.state.mainScheme.instanceId;
    expect(characterProfile(t.state, t.striker, deps)?.thw).toBe(2);
    expect(dividedBasicPowerValue(t.state, deps, P1, t.striker, "thwart", "thw", [t.plain, t.marked])).toBe(3);
    expect(dividedBasicPowerValue(t.state, deps, P1, t.striker, "thwart", "thw", [t.plain, main])).toBe(2);
    // A thwart does not turn the attack's bonus on, nor an attack the thwart's.
    expect(dividedBasicPowerValue(t.state, deps, P1, t.striker, "thwart", "atk", [t.plain, main])).toBe(2);
    expect(dividedBasicPowerValue(t.state, deps, P1, t.striker, "attack", "thw", [t.villain, t.thug])).toBe(2);

    const after = runCommands(t.state, deps, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: t.striker,
      schemeInstanceId: t.plain,
      divide: [
        { targetInstanceId: t.plain, amount: 1 },
        { targetInstanceId: t.marked, amount: 2 },
      ],
    }).state;
    expect([threat(after, t.plain), threat(after, t.marked)]).toEqual([5, 4]);
  });

  it("with no target it is the stat as it reads now", () => {
    const t = table();
    expect(dividedBasicPowerValue(t.state, deps, P1, t.striker, "attack", "atk", [])).toBe(2);
  });
});

describe("setBasicPowerStat", () => {
  const statsOf = (state: GameState) =>
    state.stack.flatMap((frame) =>
      frame.kind === "event" && (frame.event.kind === "basicPowerUsing" || frame.event.kind === "basicPowerUsed")
        ? [`${frame.event.kind}:${frame.event.characterInstanceId}:${frame.event.power}:${frame.event.stat}`]
        : [],
    );

  it("rewrites the stat on this use's announcements still on the stack, and on no other's", () => {
    const t = table();
    const hero = mustPlayer(t.state, P1).identity.instanceId;
    const ctx = createCtx(t.state, deps);
    const announce = (kind: "basicPowerUsing" | "basicPowerUsed", id: InstanceId, power: "attack" | "thwart") =>
      pushEvent(ctx, {
        kind,
        characterInstanceId: id,
        power,
        stat: power === "attack" ? "atk" : "thw",
        playerId: P1,
      });
    announce("basicPowerUsed", hero, "attack");
    announce("basicPowerUsed", t.striker, "attack");
    announce("basicPowerUsing", t.striker, "thwart");
    announce("basicPowerUsing", t.striker, "attack");
    const before = statsOf(ctx.state);

    // "Uses their THW instead of their ATK": both of the striker's attack announcements, nothing else.
    setBasicPowerStat(ctx, t.striker, "attack", "thw");
    expect(statsOf(ctx.state)).toEqual(
      before.map((line) => (line.endsWith(`${t.striker}:attack:atk`) ? line.replace(/atk$/, "thw") : line)),
    );
    expect(statsOf(ctx.state).filter((line) => line.endsWith(":thw") && line.includes(":attack:"))).toHaveLength(2);

    // No character named: whoever is using that power, the nearest announcement of each kind.
    setBasicPowerStat(ctx, null, "thwart", "atk");
    expect(statsOf(ctx.state).filter((line) => line.includes(":thwart:"))).toEqual([
      `basicPowerUsing:${t.striker}:thwart:atk`,
    ]);
    // The hero's own announcement was never touched.
    expect(statsOf(ctx.state)).toContain(`basicPowerUsed:${hero}:attack:atk`);
  });

  it("does nothing when no such announcement is on the stack, or the stat is already that one", () => {
    const t = table();
    const ctx = createCtx(t.state, deps);
    setBasicPowerStat(ctx, t.striker, "attack", "thw");
    expect(ctx.state).toBe(t.state);
    pushEvent(ctx, {
      kind: "basicPowerUsing",
      characterInstanceId: t.striker,
      power: "attack",
      stat: "atk",
      playerId: P1,
    });
    const staged = ctx.state;
    setBasicPowerStat(ctx, t.striker, "attack", "atk");
    expect(ctx.state).toBe(staged);
  });
});
