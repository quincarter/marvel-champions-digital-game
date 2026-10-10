/**
 * docs/phase7-wave9.md §3.9: `EffectSpec enemyScheme.divert { amount, to, if }`: part of one scheme activation's threat
 * placed on a card instead of on the main scheme, read at the activation's place-threat step. Proven with a synthetic
 * upgrade shaped like "Forced Interrupt (Hero): When an enemy would attack you, it schemes instead. Place 1 threat from
 * that activation here instead of on the main scheme if there is 5 or less threat on this card."
 *
 * Sources: RRG 1.8 "Scheme (Enemy Activation)" (p. 39): step 2 gives the boost card, step 3 places SCH plus the boost
 * icons on the main scheme. "'Would'" (p. 48): the replaced attack never happened, so no boost card was dealt for it
 * and the scheme deals its own. "Stunned" / "Confused": the status card is discarded instead of the activation. MC50
 * p. 22: the upgrade "prevents the threat it places on itself from being placed on the main scheme", and "status cards
 * take priority over all other effects". "Crisis Icon" (p. 14) and "Acceleration Icon" (p. 5) concern removing threat
 * from the main scheme and step one of the villain phase, neither of which is an activation's placement.
 */

import { flat, type AnyCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "./abilities.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { activeVillain, mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, Predicate, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import {
  stubMainScheme,
  stubSideScheme,
  stubSupport,
  stubTreachery,
  stubUpgrade,
  stubVillain,
} from "./testing/fixtures.js";
import { copiesOf, encounterCardInVillainArea, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const SELF: TargetRef = { kind: "self" };
const n = (value: number): ValueSpec => ({ kind: "const", value });
const threatHereAtMost = (max: number): Predicate =>
  ({ kind: "compare", left: { kind: "threat", of: SELF }, op: "atMost", right: n(max) }) as never;

/** "When an enemy would attack you, it schemes instead", with the divert under test. */
const wouldAttack = (id: string, divert: Extract<EffectSpec, { kind: "enemyScheme" }>["divert"]) =>
  stubAbility(
    id,
    def({
      trigger: {
        kind: "interrupt",
        forced: true,
        would: true,
        form: "hero",
        on: { on: "enemyAttack", targetIs: { categories: ["identity"], controller: "you" } },
      },
      effects: [
        {
          kind: "replaceTriggeringEvent",
          with: [{ kind: "enemyScheme", enemies: { kind: "eventSource" }, ...(divert ? { divert } : {}) }],
        },
      ],
    }),
  );
/** The printed card: 1 threat, while this card holds 5 or less. */
const STEALTH_ABILITY = wouldAttack("stealth.would", { amount: 1, to: SELF, if: threatHereAtMost(5) });
const STEALTH = stubUpgrade({ id: "stealth", cost: 0, abilities: [STEALTH_ABILITY.ref] });
/** The same with no condition and more than any activation here places: "place 5 threat from that activation here". */
const SPONGE_ABILITY = wouldAttack("sponge.would", { amount: n(5), to: SELF });
const SPONGE = stubUpgrade({ id: "sponge", cost: 0, abilities: [SPONGE_ABILITY.ref] });
/** An upgrade with no text: the attack is not replaced. */
const PLAIN = stubUpgrade({ id: "plain", cost: 0 });

/** "Response: After the villain schemes, …": records what the activation reports, as counters on this card. */
const WATCH_ABILITY = stubAbility(
  "watch.after-scheme",
  def({
    trigger: {
      kind: "response",
      forced: true,
      on: { on: "enemyScheme", sourceIs: { categories: ["villain"] } },
    },
    effects: [
      { kind: "addCounters", target: SELF, counterType: "schemes", amount: n(1) },
      {
        kind: "addCounters",
        target: SELF,
        counterType: "placed",
        amount: { kind: "eventResult", key: "threatPlaced" },
      },
      {
        kind: "addCounters",
        target: SELF,
        counterType: "diverted",
        amount: { kind: "eventResult", key: "threatDiverted" },
      },
    ],
  }),
);
const WATCH = stubSupport({ id: "watch", cost: 0, abilities: [WATCH_ABILITY.ref] });

/** "When [this villain] schemes, place the threat on [the side scheme] instead of the main scheme." */
const ELSEWHERE_ABILITY = stubAbility(
  "elsewhere.constant",
  def({
    trigger: {
      kind: "constant",
      rules: [{ kind: "schemeThreatDestination", enemy: { categories: ["villain"] }, scheme: SELF }],
    },
    effects: [],
  }),
);
const ELSEWHERE = stubSideScheme({
  id: "elsewhere",
  startingThreat: 0,
  boostIcons: 0,
  abilities: [ELSEWHERE_ABILITY.ref],
});
const CRISIS = stubSideScheme({ id: "crisis", startingThreat: 3, boostIcons: 0, icons: ["crisis"] });

const villain = (id: string, sch: number, dashedSch = false) =>
  stubVillain({ id, stages: [{ hp: flat(30), atk: 3, sch, ...(dashedSch ? { dashedStats: ["sch" as const] } : {}) }] });
const SCH2 = villain("sch2", 2);
const SCH0 = villain("sch0", 0);
const mainScheme = (id: string, acceleration: number) =>
  stubMainScheme({
    id,
    stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(acceleration) }],
  });
const CALM = mainScheme("calm", 0);
const RISING = mainScheme("rising", 1);
/** Every encounter card: a treachery with nothing on it but its boost icons. */
const ONE_ICON = stubTreachery({ id: "one-icon", boostIcons: 1 });
const NO_ICON = stubTreachery({ id: "no-icon", boostIcons: 0 });

const deps = depsOf(STEALTH_ABILITY, SPONGE_ABILITY, WATCH_ABILITY, ELSEWHERE_ABILITY);

interface Setup {
  readonly upgrade?: AnyCard;
  /** Threat on the upgrade before the villain phase. */
  readonly holding?: number;
  readonly villain?: ReturnType<typeof villain>;
  readonly mainScheme?: ReturnType<typeof mainScheme>;
  readonly boost?: typeof ONE_ICON;
  readonly status?: "stunned" | "confused";
  readonly sideScheme?: typeof CRISIS;
  readonly form?: "hero" | "alterEgo";
}

/** p1 with the upgrade and the watcher in play; ends the turn, so the villain phase runs through to p1's next turn. */
function villainPhase(setup: Setup = {}) {
  const upgradeCard = setup.upgrade ?? STEALTH;
  const boost = setup.boost ?? ONE_ICON;
  let state: GameState = gameAtFirstTurn({
    cards: [STEALTH, SPONGE, PLAIN, WATCH, ONE_ICON, NO_ICON, CRISIS, ELSEWHERE],
    deps,
    villain: setup.villain ?? SCH2,
    mainScheme: setup.mainScheme ?? CALM,
    deck: [STEALTH.id, SPONGE.id, PLAIN.id, WATCH.id],
    encounter: [...(setup.sideScheme ? [setup.sideScheme.id] : []), ...copiesOf(boost.id, 20)],
  });
  const upgrade = playerCardIntoPlay(state, upgradeCard.id);
  const watch = playerCardIntoPlay(upgrade.state, WATCH.id);
  state = watch.state;
  let side: InstanceId | null = null;
  if (setup.sideScheme) {
    const put = encounterCardInVillainArea(state, setup.sideScheme.id, setup.sideScheme === CRISIS ? 3 : 0);
    state = put.state;
    side = put.id;
  }
  const boss = activeVillain(state).instanceId;
  const form = setup.form ?? "hero";
  state = {
    ...state,
    players: state.players.map((p) => (p.playerId === P1 ? { ...p, identity: { ...p.identity, form } } : p)),
    instances: {
      ...state.instances,
      [upgrade.id]: { ...mustInstance(state, upgrade.id), threat: setup.holding ?? 0 },
      ...(setup.status
        ? {
            [boss]: {
              ...mustInstance(state, boss),
              statuses: { ...mustInstance(state, boss).statuses, [setup.status]: 1 },
            },
          }
        : {}),
    },
  };
  const main = state.mainScheme.instanceId;
  const run = runCommands(state, deps, { type: "endTurn", playerId: P1 });
  const threat = (id: InstanceId): number => mustInstance(run.state, id).threat;
  return {
    ...run,
    boss,
    upgrade: upgrade.id,
    main,
    side,
    onMain: threat(main),
    onUpgrade: threat(upgrade.id),
    onSide: side ? threat(side) : 0,
    watched: mustInstance(run.state, watch.id).counters,
    heroDamage: mustInstance(run.state, mustPlayer(run.state, P1).identity.instanceId).damage,
  };
}

const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const placements = (events: readonly GameEvent[]) =>
  of(events, "threatPlaced").map((e) => ({ on: e.schemeInstanceId, amount: e.amount, by: e.sourceInstanceId }));
const statusDiscards = (events: readonly GameEvent[]) =>
  of(events, "statusRemoved").map((e) => ({ status: e.status, reason: e.reason }));

describe("§3.9 `enemyScheme.divert`: one threat of the activation placed on a card instead of the main scheme", () => {
  it("SCH 2 and a 1-icon boost card, the card at 5: 2 on the main scheme, 1 on the card (6), and no attack", () => {
    const t = villainPhase({ holding: 5 });
    expect(t.onMain).toBe(2);
    expect(t.onUpgrade).toBe(6);
    expect(t.heroDamage).toBe(0);
    expect(of(t.events, "attackResolved")).toEqual([]);
    expect(of(t.events, "schemeResolved")).toEqual([
      {
        type: "schemeResolved",
        enemyInstanceId: t.boss,
        schemeInstanceId: t.main,
        baseSch: 2,
        boostIcons: 1,
        threatBonus: 0,
        threatPlaced: 2,
        diverted: { toInstanceId: t.upgrade, amount: 1 },
      },
    ]);
    // The diverted part lands first, then the rest; both are the villain's placement.
    expect(placements(t.events)).toEqual([
      { on: t.upgrade, amount: 1, by: t.boss },
      { on: t.main, amount: 2, by: t.boss },
    ]);
    const replayed = replay(t.session.log, deps);
    expect(replayed.ok && replayed.state).toEqual(t.session.state);
  });

  it("the replaced attack deals no boost card: the scheme's own is the only one of the villain phase", () => {
    const t = villainPhase({ holding: 5 });
    const dealt = of(t.events, "boostCardDealt");
    expect(dealt).toHaveLength(1);
    expect(dealt[0]?.enemyInstanceId).toBe(t.boss);
    expect(of(t.events, "boostCardFlipped")).toHaveLength(1);
    // That card was dealt after the attack was replaced, inside the scheme.
    const types = t.events.map((e) => e.type);
    expect(types.indexOf("boostCardDealt")).toBeGreaterThan(
      t.events.findIndex((e) => e.type === "abilityResolved" && e.abilityId === STEALTH_ABILITY.ref.id),
    );
    // With no replacement the attack deals exactly one as well, so the replacement never costs or adds a card.
    const plain = villainPhase({ upgrade: PLAIN });
    expect(of(plain.events, "attackResolved")).toHaveLength(1);
    expect(of(plain.events, "boostCardDealt")).toHaveLength(1);
  });

  it("the `if` is false (the card holds 6): all 3 go on the main scheme, the card stays at 6", () => {
    const t = villainPhase({ holding: 6 });
    expect(t.onMain).toBe(3);
    expect(t.onUpgrade).toBe(6);
    expect(of(t.events, "schemeResolved")[0]).toMatchObject({ threatPlaced: 3 });
    expect(of(t.events, "schemeResolved")[0]).not.toHaveProperty("diverted");
    expect(placements(t.events)).toEqual([{ on: t.main, amount: 3, by: t.boss }]);
  });

  it("the `if` is read at the place-threat step: at 5 it holds, and the same card one activation later (6) does not", () => {
    const first = villainPhase({ holding: 5 });
    const second = runCommands(first.state, deps, { type: "endTurn", playerId: P1 });
    expect(mustInstance(second.state, first.upgrade).threat).toBe(6);
    expect(mustInstance(second.state, first.main).threat).toBe(2 + 3);
  });

  it("diverted in part: an amount of 5 takes all 3 of a 3-threat activation and leaves the main scheme none", () => {
    const t = villainPhase({ upgrade: SPONGE });
    expect(t.onUpgrade).toBe(3);
    expect(t.onMain).toBe(0);
    expect(of(t.events, "schemeResolved")[0]).toMatchObject({
      threatPlaced: 0,
      diverted: { toInstanceId: t.upgrade, amount: 3 },
    });
    expect(placements(t.events)).toEqual([{ on: t.upgrade, amount: 3, by: t.boss }]);
  });

  it("an activation that places none diverts none: SCH 0 with a 0-icon boost card", () => {
    const t = villainPhase({ villain: SCH0, boost: NO_ICON, holding: 2 });
    expect(t.onMain).toBe(0);
    expect(t.onUpgrade).toBe(2);
    expect(of(t.events, "schemeResolved")[0]).toMatchObject({ baseSch: 0, boostIcons: 0, threatPlaced: 0 });
    expect(of(t.events, "schemeResolved")[0]).not.toHaveProperty("diverted");
    expect(placements(t.events)).toEqual([]);
    expect(t.heroDamage).toBe(0);
  });

  it("SCH 0 with a 1-icon boost card: the one threat the boost adds is the one diverted", () => {
    const t = villainPhase({ villain: SCH0, holding: 0 });
    expect(t.onMain).toBe(0);
    expect(t.onUpgrade).toBe(1);
  });

  it("'after the villain schemes' answers the scheme: `threatPlaced` 3 for the activation, `threatDiverted` 1", () => {
    const t = villainPhase({ holding: 5 });
    expect(t.watched).toMatchObject({ schemes: 1, placed: 3, diverted: 1 });
    const whole = villainPhase({ holding: 6 });
    expect(whole.watched.schemes).toBe(1);
    expect(whole.watched.placed).toBe(3);
    expect(whole.watched.diverted ?? 0).toBe(0);
  });

  it("acceleration is step one's, not the activation's: it all goes on the main scheme, then the scheme diverts 1", () => {
    const t = villainPhase({ mainScheme: RISING, holding: 0 });
    expect(t.onUpgrade).toBe(1);
    expect(t.onMain).toBe(1 + 2);
    expect(placements(t.events)).toEqual([
      { on: t.main, amount: 1, by: null },
      { on: t.upgrade, amount: 1, by: t.boss },
      { on: t.main, amount: 2, by: t.boss },
    ]);
  });

  it("a crisis icon in play changes nothing: placing is not removing", () => {
    const t = villainPhase({ sideScheme: CRISIS, holding: 5 });
    expect(t.onMain).toBe(2);
    expect(t.onUpgrade).toBe(6);
    expect(t.onSide).toBe(3);
  });

  it("threat a rule sends to a side scheme is not diverted: all 3 land there", () => {
    const t = villainPhase({ sideScheme: ELSEWHERE, holding: 0 });
    expect(t.onSide).toBe(3);
    expect(t.onUpgrade).toBe(0);
    expect(t.onMain).toBe(0);
    expect(of(t.events, "schemeResolved")[0]).toMatchObject({ schemeInstanceId: t.side, threatPlaced: 3 });
    expect(of(t.events, "schemeResolved")[0]).not.toHaveProperty("diverted");
  });

  it("a confused villain: the scheme the attack became is cancelled by the status, so no threat and no attack", () => {
    const t = villainPhase({ status: "confused", holding: 5 });
    expect(mustInstance(t.state, t.boss).statuses.confused).toBe(0);
    expect(statusDiscards(t.events)).toEqual([{ status: "confused", reason: "cancelledSchemeOrThwart" }]);
    expect(t.onMain).toBe(0);
    expect(t.onUpgrade).toBe(5);
    expect(t.heroDamage).toBe(0);
    expect(of(t.events, "schemeResolved")).toEqual([]);
    expect(of(t.events, "boostCardDealt")).toEqual([]);
    expect(t.watched.schemes ?? 0).toBe(0);
  });

  it("a stunned villain: the stun is discarded first, the interrupt never triggers, nothing schemes", () => {
    const t = villainPhase({ status: "stunned", holding: 5 });
    expect(mustInstance(t.state, t.boss).statuses.stunned).toBe(0);
    expect(statusDiscards(t.events)).toEqual([{ status: "stunned", reason: "cancelledAttack" }]);
    expect(t.events.some((e) => e.type === "abilityResolved" && e.abilityId === STEALTH_ABILITY.ref.id)).toBe(false);
    expect(t.onMain).toBe(0);
    expect(t.onUpgrade).toBe(5);
    expect(of(t.events, "schemeResolved")).toEqual([]);
  });

  it("alter-ego form: the villain schemes on its own and nothing is diverted (the divert belongs to the replacement)", () => {
    const t = villainPhase({ form: "alterEgo", holding: 0 });
    expect(t.onMain).toBe(3);
    expect(t.onUpgrade).toBe(0);
  });
});
