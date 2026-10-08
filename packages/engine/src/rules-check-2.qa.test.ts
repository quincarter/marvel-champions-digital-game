/**
 * docs/phase7-wave8-rules-check-2.md, entry G2 (Generation X 47016): the +1 THW on a divided basic thwart.
 *
 * Card text: "Each X-Men character gets +1 THW while making a basic thwart against this scheme." RRG 1.8 "Modifiers"
 * (p. 29): a value is recalculated from its base and every active modifier; RRG 1.8 "Assault" (p. 8) and the owner's
 * Q3 (docs/phase7-wave8.md section 4.1): a divided basic thwart is ONE basic thwart. A character who divides a basic
 * thwart between this scheme and another is making a basic thwart against this scheme, so the +1 applies.
 *
 * Synthetic cards only. "Your identity gets +1 THW while making a basic thwart against the side scheme named
 * 'target'" is the shape of 47016's constant (`thwartInProgress { basic, scheme }`); the hero may divide a basic
 * thwart (Wasp's shape). The hero has THW 2.
 *
 * Today the shares of a divided thwart must total the THW read OUTSIDE any thwart (2), so the +1 can neither be
 * divided nor is it removed: it is lost. The companion test records that; the `it.fails` test is what the card says.
 * No X-Men character can divide a basic thwart in the shipped pool (only Wasp and Bombshell can), so no shipped
 * game shows it yet.
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubIdentity, stubSideScheme, stubSupport } from "./testing/fixtures.js";
import { defaultPick, HERO, runWith } from "./testing/scenario.js";
import { encounterCardInVillainArea, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const yourIdentity = { categories: ["identity"], controller: "you" } as const;

const BRAWLER = stubIdentity({
  id: HERO.id,
  hp: 10,
  atk: 3,
  thw: 2,
  def: 2,
  rec: 3,
  heroHandSize: 5,
  alterEgoHandSize: 6,
});
const TARGET = stubSideScheme({ id: "target", startingThreat: 9 });
const OTHER = stubSideScheme({ id: "other", startingThreat: 9 });

/** "Your identity gets +1 THW while making a basic thwart against 'target'." (Generation X's constant, as a support.) */
const GEN_X = stubAbility(
  "gen-x.constant",
  def({
    trigger: {
      kind: "constant",
      modifiers: [
        {
          stat: "thw",
          amount: 1,
          target: yourIdentity,
          while: { kind: "thwartInProgress", basic: true, scheme: { name: "target" } },
        },
      ],
    },
    effects: [],
  }),
);
const GEN_X_SUPPORT = stubSupport({ id: "gen-x-support", cost: 0, abilities: [GEN_X.ref] });
/** "Your identity may divide its basic thwart among any number of schemes." */
const SPLIT = stubAbility(
  "split.constant",
  def({
    trigger: { kind: "constant", rules: [{ kind: "divideBasicPower", power: "thwart", target: yourIdentity }] },
    effects: [],
  }),
);
const SPLIT_SUPPORT = stubSupport({ id: "split-support", cost: 0, abilities: [SPLIT.ref] });

const deps: EngineDeps = depsOf(GEN_X, SPLIT);

function board() {
  let state = gameAtFirstTurn({
    cards: [BRAWLER, TARGET, OTHER, GEN_X_SUPPORT, SPLIT_SUPPORT],
    deps,
    deck: [GEN_X_SUPPORT.id, SPLIT_SUPPORT.id],
    encounter: [TARGET.id, OTHER.id],
  });
  if (mustPlayer(state, P1).identity.form !== "hero")
    state = runWith(deps, state, { type: "changeForm", playerId: P1 });
  state = playerCardIntoPlay(state, GEN_X_SUPPORT.id).state;
  state = playerCardIntoPlay(state, SPLIT_SUPPORT.id).state;
  const target = encounterCardInVillainArea(state, TARGET.id, 9);
  const other = encounterCardInVillainArea(target.state, OTHER.id, 9);
  return {
    state: other.state,
    hero: mustPlayer(other.state, P1).identity.instanceId,
    target: target.id,
    other: other.id,
  };
}

type Share = readonly [scheme: InstanceId, amount: number];
const thwart = (hero: InstanceId, scheme: InstanceId, ...shares: readonly Share[]): Command => ({
  type: "basicThwart",
  playerId: P1,
  thwarterInstanceId: hero,
  schemeInstanceId: scheme,
  ...(shares.length > 0 ? { divide: shares.map(([targetInstanceId, amount]) => ({ targetInstanceId, amount })) } : {}),
});
const threat = (state: GameState, id: InstanceId) => mustInstance(state, id).threat;
const refusal = (state: GameState, command: Command): string | null => {
  const result = applyCommand(state, command, deps);
  return result.ok ? null : result.error.message;
};
const run = (state: GameState, ...commands: readonly Command[]) =>
  driveSession(startSession(state), deps, commands, defaultPick).session.state;

describe("G2: Generation X's +1 THW on a divided basic thwart (47016)", () => {
  it("control: an undivided basic thwart against the scheme removes THW 2 + 1", () => {
    const b = board();
    const after = run(b.state, thwart(b.hero, b.target));
    expect(threat(after, b.target)).toBe(9 - 3);
  });

  it("control: an undivided basic thwart against another scheme removes just THW 2", () => {
    const b = board();
    const after = run(b.state, thwart(b.hero, b.other));
    expect(threat(after, b.other)).toBe(9 - 2);
  });

  // Today: the shares must total 2 (the THW read with no thwart on the stack), and the scheme's share is not raised.
  it("today: a thwart divided between the scheme and another totals 2; the +1 is lost", () => {
    const b = board();
    expect(refusal(b.state, thwart(b.hero, b.target, [b.target, 2], [b.other, 1]))).toBe("the shares must total 2");
    const after = run(b.state, thwart(b.hero, b.target, [b.target, 1], [b.other, 1]));
    expect([threat(after, b.target), threat(after, b.other)]).toEqual([8, 8]);
  });

  // Expected (card text; one divided thwart is one basic thwart): the hero is making a basic thwart against Generation X,
  // so she has THW 3 to divide, and a division of 2 and 1 is legal.
  it.fails("expected: the same thwart divided 2 and 1 is legal, because THW is 3 while thwarting it", () => {
    const b = board();
    expect(refusal(b.state, thwart(b.hero, b.target, [b.target, 2], [b.other, 1]))).toBeNull();
    const after = run(b.state, thwart(b.hero, b.target, [b.target, 2], [b.other, 1]));
    expect([threat(after, b.target), threat(after, b.other)]).toEqual([7, 8]);
  });
});
