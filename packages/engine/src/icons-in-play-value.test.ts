/**
 * docs/phase7-wave7.md §3.77: `ValueSpec iconsInPlay { icons? }`, "for each [crisis], [acceleration], [amplify], and
 * [hazard] in play" (Barely a Scratch, Da Bomb, 'Pool Inspection, Bazooka, Laser Swords: `deadpool` 44017, 44019,
 * 44023, 44052, 44055) and "If the following icons are on 1 or more cards in play" ("I Got This", 44021), over the
 * engine's own icon count.
 *
 * Sources, RRG 1.8: "Acceleration Icon" (p. 5), "Crisis Icon" (p. 13) and "Hazard Icon" (p. 21) count icons "in play";
 * "Amplify Icon" (p. 7), "for each amplify icon in play"; "Acceleration Token" (p. 5), "Acceleration tokens are not
 * considered acceleration icons, and vice versa."
 */

import { flat, type AnyCard, type HeroIdentityCard, type SchemeIcon } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, CardIcon, EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import { amplifyIconsInPlay } from "./modifiers.js";
import { mustInstance } from "./query.js";
import { iconsInPlay } from "./rules.js";
import { resolveValue } from "./select.js";
import type { EffectSpec, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import {
  stubEvent,
  stubIdentity,
  stubMainScheme,
  stubSideScheme,
  stubSupport,
  stubTreachery,
} from "./testing/fixtures.js";
import { newGame } from "./testing/scenario.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  P1,
  playerCardIntoPlay,
  playFree,
} from "./testing/wave3.js";

const icons = (...types: readonly CardIcon[]): ValueSpec => ({ kind: "iconsInPlay", icons: types });
const allIcons: ValueSpec = { kind: "iconsInPlay" };
const constantRules = (rules: NonNullable<Extract<AbilityDefinition["trigger"], { kind: "constant" }>["rules"]>) =>
  ({ trigger: { kind: "constant", rules }, effects: [] }) satisfies AbilityDefinition;

/** A stage printing a crisis icon and a hazard icon. */
const PLAN = stubMainScheme({
  id: "plan",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(1), icons: ["crisis", "hazard"] }],
});
/** A side scheme printing two acceleration icons and an amplify icon. */
const RACKET: AnyCard = {
  ...stubSideScheme({ id: "racket", startingThreat: 3, icons: ["acceleration", "acceleration"], boostIcons: 0 }),
  amplifyIcons: 1,
};
/** A player card printing a hazard icon (the 'Pool allies' shape). */
const SUIT: AnyCard = { ...stubSupport({ id: "suit", cost: 0 }), schemeIcons: ["hazard"] as readonly SchemeIcon[] };
const GRANTER_RULE = stubAbility(
  "granter.constant",
  constantRules([{ kind: "gainsIcon", icon: "crisis", target: { categories: ["sideScheme"] } }]),
);
/** "Each side scheme gains a crisis icon." */
const GRANTER = stubSupport({ id: "granter", cost: 0, abilities: [GRANTER_RULE.ref] });
const LEDGER = stubSupport({ id: "ledger", cost: 0 });
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const TOKEN = event("token", [{ kind: "addAccelerationToken" }]);
const BLANK = event("blank", [
  { kind: "blankTextBox", target: { kind: "each", query: { categories: ["sideScheme"] } }, until: "endOfRound" },
]);
/** "1 … for each [crisis], [acceleration], [amplify], and [hazard] in play", read as the effect resolves. */
const TALLY = event("tally", [
  {
    kind: "addCounters",
    target: { kind: "each", query: { categories: ["support"], name: "ledger" } },
    counterType: "tally",
    amount: allIcons,
  },
]);
const EVENTS = [TOKEN, BLANK, TALLY];

const deps: EngineDeps = depsOf(GRANTER_RULE, ...EVENTS.map((e) => e.ability));

function start(): GameState {
  return gameAtFirstTurn({
    cards: [PLAN, RACKET, SUIT, GRANTER, LEDGER, FILLER, ...EVENTS.map((e) => e.card)],
    deps,
    mainScheme: PLAN,
    encounter: [RACKET.id, ...copiesOf(FILLER.id, 30)],
    deck: [SUIT.id, GRANTER.id, LEDGER.id, ...EVENTS.flatMap((e) => copiesOf(e.card.id, 3))],
  });
}
/** The stage, the side scheme and the player card: 1 crisis, 2 acceleration, 1 amplify, 2 hazard. */
const full = (): GameState =>
  playerCardIntoPlay(encounterCardInVillainArea(start(), RACKET.id, 3).state, SUIT.id).state;

const read = (state: GameState, value: ValueSpec): number =>
  resolveValue(state, value, { selfInstanceId: null, controllerId: P1, event: null, bindings: {}, deps });
/** The engine's own count, the one step one, the hazard deal and boost amplification read. */
const engineCount = (state: GameState): number =>
  iconsInPlay(state, deps, "crisis") +
  iconsInPlay(state, deps, "acceleration") +
  iconsInPlay(state, deps, "hazard") +
  amplifyIconsInPlay(state, deps);

describe("§3.77 the four encounter icons in play as a number", () => {
  it("sums every type when none is listed: the stage alone 2, with the side scheme 5, with the player card 6", () => {
    const state = start();
    expect(read(state, allIcons)).toBe(2);
    const withRacket = encounterCardInVillainArea(state, RACKET.id, 3).state;
    expect(read(withRacket, allIcons)).toBe(5);
    expect(read(full(), allIcons)).toBe(6);
    for (const each of [state, withRacket, full()]) expect(read(each, allIcons)).toBe(engineCount(each));
  });

  it("counts only the listed types, each type once", () => {
    const state = full();
    expect(read(state, icons("crisis"))).toBe(1);
    expect(read(state, icons("acceleration"))).toBe(2);
    expect(read(state, icons("amplify"))).toBe(1);
    expect(read(state, icons("hazard"))).toBe(2);
    expect(read(state, icons("crisis", "hazard"))).toBe(3);
    expect(read(state, icons("crisis", "acceleration", "amplify", "hazard"))).toBe(6);
    expect(read(state, icons("hazard", "hazard"))).toBe(2);
    expect(read(state, icons())).toBe(0);
  });

  it("an acceleration token is not an icon (RRG 1.8 'Acceleration Token', p. 5)", () => {
    const state = playFree(full(), deps, TOKEN.card.id).state;
    expect(state.mainScheme.accelerationTokens).toBe(1);
    expect(read(state, icons("acceleration"))).toBe(2);
    expect(read(state, allIcons)).toBe(6);
  });

  it("a gained icon counts", () => {
    const state = playerCardIntoPlay(full(), GRANTER.id).state;
    expect(read(state, icons("crisis"))).toBe(2);
    expect(read(state, allIcons)).toBe(7);
    expect(read(state, allIcons)).toBe(engineCount(state));
  });

  it("a blanked card shows none, printed or gained", () => {
    const granted = playerCardIntoPlay(full(), GRANTER.id).state;
    const state = playFree(granted, deps, BLANK.card.id).state;
    expect(read(state, icons("acceleration"))).toBe(0);
    expect(read(state, icons("amplify"))).toBe(0);
    expect(read(state, icons("crisis"))).toBe(1);
    expect(read(state, allIcons)).toBe(3);
    expect(read(state, allIcons)).toBe(engineCount(state));
  });

  it("'if [icon] is on 1 or more cards in play' tests one type", () => {
    const has = (icon: CardIcon): ValueSpec => ({
      kind: "conditional",
      if: { kind: "compare", left: icons(icon), op: "atLeast", right: { kind: "const", value: 1 } },
      then: { kind: "const", value: 1 },
      else: { kind: "const", value: 0 },
    });
    const bare = start();
    expect((["crisis", "acceleration", "amplify", "hazard"] as const).map((icon) => read(bare, has(icon)))).toEqual([
      1, 0, 0, 1,
    ]);
    const state = full();
    expect((["crisis", "acceleration", "amplify", "hazard"] as const).map((icon) => read(state, has(icon)))).toEqual([
      1, 1, 1, 1,
    ]);
  });

  it("an effect reads it as it resolves; replay deep-equal", () => {
    const ready = playerCardIntoPlay(full(), LEDGER.id);
    const { state, session } = playFree(ready.state, deps, TALLY.card.id);
    expect(mustInstance(state, ready.id).counters["tally"]).toBe(6);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("an identity face's icon counts only while that face shows (§3.63)", () => {
    const base = stubIdentity({
      id: "winged",
      hp: 30,
      atk: 2,
      thw: 2,
      def: 2,
      rec: 3,
      heroHandSize: 5,
      alterEgoHandSize: 6,
    });
    const winged: HeroIdentityCard = {
      ...base,
      additionalHeroForms: [{ ...base.hero, faceName: "winged (second hero face)", schemeIcons: ["hazard"] }],
    };
    const state = newGame({ identity: winged, deps });
    expect(read(state, allIcons)).toBe(0);
    const up = driveSession(startSession(state), deps, [{ type: "changeForm", playerId: P1, to: { heroForm: 1 } }])
      .session.state;
    expect(read(up, icons("hazard"))).toBe(1);
    expect(read(up, allIcons)).toBe(1);
    expect(read(up, allIcons)).toBe(engineCount(up));
  });
});
