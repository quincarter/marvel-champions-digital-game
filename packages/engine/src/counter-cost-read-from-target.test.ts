/**
 * Hero-pack spec H3.5: a counter cost whose amount is read from the board (`AbilityCost.spendCounters.amount` as a
 * `ValueSpec`), reading a card picked with the cost (`AbilityCost.chooseTarget`). Synthetic cards shaped like 4K Digital
 * Camcorder (`jj` 61009): "Exhaust this card and choose a non-Elite minion. Remove X evidence counters from Alias
 * Investigations, where X is equal to 2 less than that minion's remaining hit points → discard that minion."
 *
 * Sources: RRG 1.8 "Initiating Abilities" (p. 24): the cost is determined (step 3) before it is paid (step 5), and an
 * ability whose cost cannot be paid is not initiated; "Cost" (p. 13): paid in full or not at all; "Victory X" (p. 46)
 * and "When Defeated" (p. 48): a discarded card was not defeated.
 */

import { trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command, CostChoices } from "./commands.js";
import { applyCommand, replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { activeEncounterDeck, mustInstance } from "./query.js";
import type { TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubMinion, stubSupport, stubUpgrade } from "./testing/fixtures.js";
import { TREACHERY } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, playerCardIntoPlay } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const ELITE = trait("Elite");
const PICKED: TargetRef = { kind: "slot", slot: "minion" };
const CAMCORDER_ACTION = stubAbility(
  "camcorder.action",
  def({
    trigger: { kind: "action" },
    cost: {
      exhaustSelf: true,
      chooseTarget: { slot: "minion", query: { categories: ["minion"], withoutTrait: ELITE } },
      spendCounters: {
        counterType: "evidence",
        amount: {
          kind: "sum",
          values: [
            { kind: "remainingHp", of: PICKED },
            { kind: "const", value: -2 },
          ],
        },
        target: { kind: "named", name: "alias" },
        bind: "removed",
      },
    },
    effects: [{ kind: "discardFromPlay", target: PICKED }],
  }),
);
// "When Defeated: deal 1 damage to the villain." A discard is no defeat, so this never resolves here.
const GOON_DEFEATED = stubAbility(
  "goon.when-defeated",
  def({
    trigger: { kind: "whenDefeated" },
    effects: [{ kind: "dealDamage", target: { kind: "villain" }, amount: { kind: "const", value: 1 } }],
  }),
);
// Control: "Action: Remove 2 evidence counters from here →." A fixed amount.
const ALIAS_FIXED = stubAbility(
  "alias.fixed",
  def({ trigger: { kind: "action" }, cost: { spendCounters: { counterType: "evidence", amount: 2 } }, effects: [] }),
);
const CAMCORDER = stubUpgrade({ id: "camcorder", cost: 0, abilities: [CAMCORDER_ACTION.ref] });
const ALIAS = stubSupport({ id: "alias", cost: 0, abilities: [ALIAS_FIXED.ref] });
const GOON = stubMinion({
  id: "goon",
  atk: 1,
  sch: 1,
  hp: 5,
  boostIcons: 0,
  keywords: [{ name: "victory", value: 1 }],
  abilities: [GOON_DEFEATED.ref],
});
const BRUTE = stubMinion({ id: "brute", atk: 1, sch: 1, hp: 6, boostIcons: 0 });
const CHAMP = stubMinion({ id: "champ", atk: 1, sch: 1, hp: 3, boostIcons: 0, traits: [ELITE] });
const deps: EngineDeps = depsOf(CAMCORDER_ACTION, GOON_DEFEATED, ALIAS_FIXED);

interface Table {
  readonly state: GameState;
  readonly camcorder: InstanceId;
  readonly alias: InstanceId;
  readonly minions: Readonly<Record<string, InstanceId>>;
}

/** Alias Investigations with `evidence` counters, the camcorder in play, and the named minions engaged with p1. */
function start(evidence: number, damage: Readonly<Record<string, number>>): Table {
  const cards = [GOON, BRUTE, CHAMP].filter((card) => card.id in damage);
  let state = gameAtFirstTurn({
    cards: [CAMCORDER, ALIAS, ...cards],
    deps,
    encounter: [...copiesOf(TREACHERY.id, 25), ...cards.map((card) => card.id)],
    deck: [CAMCORDER.id, ALIAS.id],
  });
  const camcorder = playerCardIntoPlay(state, CAMCORDER.id);
  const alias = playerCardIntoPlay(camcorder.state, ALIAS.id);
  state = alias.state;
  const patch = (id: InstanceId, change: object) => {
    state = { ...state, instances: { ...state.instances, [id]: { ...mustInstance(state, id), ...change } } };
  };
  patch(alias.id, { counters: evidence > 0 ? { evidence } : {} });
  const minions: Record<string, InstanceId> = {};
  for (const card of cards) {
    const engaged = minionEngagedWith(state, card.id);
    state = engaged.state;
    minions[card.id] = engaged.id;
    patch(engaged.id, { damage: damage[card.id] ?? 0 });
  }
  return { state, camcorder: camcorder.id, alias: alias.id, minions };
}

const use = (table: Table, costChoices?: CostChoices): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: table.camcorder,
  abilityId: CAMCORDER_ACTION.ref.id,
  payment: [],
  ...(costChoices ? { costChoices } : {}),
});
const evidence = (state: GameState, table: Table): number => mustInstance(state, table.alias).counters.evidence ?? 0;
/** The minions the camcorder's action is offered against. */
const offered = (table: Table): readonly InstanceId[] => {
  const legal = legalActions(table.state, P1, deps);
  if (legal.kind !== "turn") throw new Error(`expected a turn, got ${legal.kind}`);
  return legal.legal
    .filter((a) => a.action.kind === "useAbility" && a.action.instanceId === table.camcorder)
    .flatMap((a) => a.targets);
};

describe("H3.5 a counter cost read off the minion chosen with it (4K Digital Camcorder)", () => {
  it("a 5-hit-point minion and 3 counters: 3 are paid and the minion is discarded, with no Victory or When Defeated", () => {
    const table = start(3, { goon: 0 });
    const goon = table.minions.goon!;
    expect(offered(table)).toEqual([goon]);
    const { session } = driveSession(startSession(table.state), deps, [use(table, { minion: [goon] })]);
    const after = session.state;
    expect(evidence(after, table)).toBe(0);
    expect(mustInstance(after, table.camcorder).exhausted).toBe(true);
    expect(activeEncounterDeck(after).discard).toContain(goon);
    expect(after.victoryDisplay).not.toContain(goon);
    expect(mustInstance(after, after.villains[0]!.instanceId).damage).toBe(0);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(after);
  });

  it("a 6-hit-point minion and 3 counters: not offered and refused; with 4 counters it is", () => {
    const short = start(3, { brute: 0 });
    const brute = short.minions.brute!;
    expect(offered(short)).toEqual([]);
    const refused = applyCommand(short.state, use(short, { minion: [brute] }), deps);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error.code).toBe("insufficient_resources");
    expect(mustInstance(short.state, short.camcorder).exhausted).toBe(false);

    const enough = start(4, { brute: 0 });
    expect(offered(enough)).toEqual([enough.minions.brute!]);
    const after = driveSession(startSession(enough.state), deps, [use(enough)]).session.state;
    expect(evidence(after, enough)).toBe(0);
    expect(activeEncounterDeck(after).discard).toContain(enough.minions.brute!);
  });

  it("X reads remaining hit points: the 6-hit-point minion with 3 damage costs 1, and only the payable picks are offered", () => {
    const table = start(1, { goon: 0, brute: 3 });
    expect(offered(table)).toEqual([table.minions.brute!]);
    const after = driveSession(startSession(table.state), deps, [use(table, { minion: [table.minions.brute!] })])
      .session.state;
    expect(evidence(after, table)).toBe(0);
    expect(mustInstance(after, table.minions.goon!).damage).toBe(0);
  });

  it("X below 0 is 0: a minion with 1 hit point left is discarded with no counter to spend", () => {
    const table = start(0, { goon: 4 });
    const after = driveSession(startSession(table.state), deps, [use(table)]).session.state;
    expect(activeEncounterDeck(after).discard).toContain(table.minions.goon!);
    expect(evidence(after, table)).toBe(0);
  });

  it("control: an Elite minion is no candidate, so with only it in play the action is not offered", () => {
    const table = start(5, { champ: 0 });
    expect(offered(table)).toEqual([]);
    const refused = applyCommand(table.state, use(table, { minion: [table.minions.champ!] }), deps);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error.code).toBe("no_valid_target");
  });

  it("control: a fixed counter amount is paid as before", () => {
    const table = start(3, {});
    const command: Command = {
      type: "useAbility",
      playerId: P1,
      cardInstanceId: table.alias,
      abilityId: ALIAS_FIXED.ref.id,
      payment: [],
    };
    const after = driveSession(startSession(table.state), deps, [command]).session.state;
    expect(evidence(after, table)).toBe(1);
  });
});
