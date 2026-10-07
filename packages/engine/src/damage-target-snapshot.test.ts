/**
 * docs/phase7-wave7.md §3.79 (Involuntary Procedures 44034, "after Deadpool takes damage"): a `dealDamage` event carries
 * its target as it took the damage (`TargetSnapshot`, `targetAsDamaged`), and an "after" pattern's top-level name
 * clauses (`TargetQuery.name`, `titled`) are matched against it. Synthetic cards: an identity whose hero face replaces
 * its defeat with "1 remaining hit point, change to alter-ego form", and a support that counts damage by name.
 *
 * Sources: RRG 1.8 "Identity" (p. 23): "If a card refers to a hero or alter-ego by title, it refers only to the
 * identity with that title, and not to the other side of the card." "Response" (p. 38): a response resolves after its
 * triggering condition, which here is damage the hero face took. The family of `cardLeavesPlay.traits`.
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { TargetQuery } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubIdentity, stubSupport } from "./testing/fixtures.js";
import { DEFAULT_DECK, giveCard, newGame, runWith, settle } from "./testing/scenario.js";

const p1 = playerId("p1");
const you = { kind: "controller" } as const;
const def = (d: AbilityDefinition) => d;
const mine = { kind: "identityOf", player: you } as const;

/** "Forced Interrupt: When you would be defeated, instead set your hit points to 1 and change to alter-ego form." */
const REGROW = stubAbility(
  "mender.regrow",
  def({
    trigger: {
      kind: "interrupt",
      forced: true,
      on: { on: "characterDefeated", targetIs: { categories: ["identity"], controller: "you" } },
      while: { kind: "form", player: you, form: "hero" },
    },
    effects: [
      {
        kind: "replaceTriggeringEvent",
        with: [
          { kind: "setRemainingHitPoints", target: mine, amount: { kind: "const", value: 1 } },
          { kind: "changeForm", player: you, to: "alterEgo" },
        ],
      },
    ],
  }),
);
const MENDER = stubIdentity({
  id: "mender",
  hp: 9,
  atk: 2,
  thw: 2,
  def: 2,
  rec: 3,
  heroHandSize: 5,
  alterEgoHandSize: 6,
  heroAbilities: [REGROW.ref],
});
/** The status cards the snapshot also carries (`attack-target-status-snapshot.test.ts`): none held here. */
const NONE = { stunned: 0, confused: 0, tough: 0 };
const HERO_NAME = "mender (hero)";
const ALTER_EGO_NAME = "mender (alter-ego)";

/** "Forced Response: After <name> takes damage, place 1 counter here.", one per way of naming. */
const counting = (id: string, counter: string, targetIs: TargetQuery) =>
  stubAbility(
    id,
    def({
      trigger: { kind: "response", forced: true, on: { on: "dealDamage", targetIs, requireResults: { amount: 1 } } },
      effects: [
        { kind: "addCounters", target: { kind: "self" }, counterType: counter, amount: { kind: "const", value: 1 } },
      ],
    }),
  );
const BY_TITLE = counting("ledger.titled", "titled", { categories: ["identity"], titled: { names: [HERO_NAME] } });
const BY_NAME = counting("ledger.named", "named", { name: HERO_NAME });
const BY_OTHER = counting("ledger.other", "other", { categories: ["identity"], titled: { names: [ALTER_EGO_NAME] } });
const LEDGER = stubSupport({ id: "ledger", cost: 0, abilities: [BY_TITLE.ref, BY_NAME.ref, BY_OTHER.ref] });

const blast = (amount: number) => {
  const ability = stubAbility(
    `blast-${amount}.action`,
    def({
      trigger: { kind: "action" },
      effects: [{ kind: "dealDamage", target: mine, amount: { kind: "const", value: amount } }],
    }),
  );
  return { ability, card: stubEvent({ id: `blast-${amount}`, cost: 0, abilities: [ability.ref] }) };
};
const BLAST_4 = blast(4);
const BLAST_9 = blast(9);
/** "Deal 9 indirect damage to yourself.": the simultaneous route (`damageGroup`). */
const SHRAPNEL_ACTION = stubAbility(
  "shrapnel.action",
  def({
    trigger: { kind: "action" },
    effects: [{ kind: "dealIndirectDamage", to: you, amount: { kind: "const", value: 9 } }],
  }),
);
const SHRAPNEL = stubEvent({ id: "shrapnel", cost: 0, abilities: [SHRAPNEL_ACTION.ref] });

const deps: EngineDeps = depsOf(REGROW, BY_TITLE, BY_NAME, BY_OTHER, BLAST_4.ability, BLAST_9.ability, SHRAPNEL_ACTION);

const play = (id: InstanceId): Command => ({
  type: "playCard",
  playerId: p1,
  cardInstanceId: id,
  payment: [],
  attachToInstanceId: null,
});

/** p1 in `form` with the Ledger in play. */
function table(form: "hero" | "alterEgo"): { state: GameState; ledger: InstanceId } {
  const start = newGame({
    identity: MENDER,
    extraCards: [LEDGER, BLAST_4.card, BLAST_9.card, SHRAPNEL],
    deck: [...DEFAULT_DECK, LEDGER.id, BLAST_4.card.id, BLAST_4.card.id, BLAST_9.card.id, SHRAPNEL.id],
    deps,
  });
  const formed =
    form === "hero" ? settle(runWith(deps, start, { type: "changeForm", playerId: p1 }), undefined, deps) : start;
  const ledger = giveCard(formed, p1, LEDGER.id);
  return { state: settle(runWith(deps, ledger.state, play(ledger.id)), undefined, deps), ledger: ledger.id };
}

function playing(state: GameState, card: string) {
  const given = giveCard(state, p1, card);
  const { session, events } = driveSession(startSession(given.state), deps, [play(given.id)]);
  return { session, state: session.state, events };
}
const counters = (state: GameState, id: InstanceId): Record<string, number> => ({
  titled: mustInstance(state, id).counters?.titled ?? 0,
  named: mustInstance(state, id).counters?.named ?? 0,
  other: mustInstance(state, id).counters?.other ?? 0,
});
const identity = (state: GameState) => mustPlayer(state, p1).identity;
const resolvedDamage = (events: readonly GameEvent[]) =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "dealDamage" ? [e.event] : [],
  );

describe("a damage event carries its target as it took the damage", () => {
  it("non-lethal damage to the hero face: both name clauses match, the alter-ego's does not", () => {
    const t = table("hero");
    const after = playing(t.state, BLAST_4.card.id);
    expect(identity(after.state).form).toBe("hero");
    expect(mustInstance(after.state, identity(after.state).instanceId).damage).toBe(4);
    expect(counters(after.state, t.ledger)).toEqual({ titled: 1, named: 1, other: 0 });
  });

  it("lethal damage the hero face replaces by turning to the alter-ego is still the hero taking damage", () => {
    const t = table("hero");
    const after = playing(t.state, BLAST_9.card.id);
    expect(identity(after.state).form).toBe("alterEgo");
    expect(mustInstance(after.state, identity(after.state).instanceId).damage).toBe(8);
    // Read after the replacement, when the card shows its alter-ego side: the event says who took it.
    expect(counters(after.state, t.ledger)).toEqual({ titled: 1, named: 1, other: 0 });
    const [damage] = resolvedDamage(after.events);
    expect(damage?.targetAsDamaged).toEqual({ name: HERO_NAME, titles: [HERO_NAME], statuses: NONE });
    const replayed = replay(after.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(after.state);
  });

  it("damage the alter-ego face takes is the alter-ego's: only its own name matches", () => {
    const t = table("alterEgo");
    const after = playing(t.state, BLAST_4.card.id);
    expect(counters(after.state, t.ledger)).toEqual({ titled: 0, named: 0, other: 1 });
    expect(resolvedDamage(after.events)[0]?.targetAsDamaged).toEqual({
      name: ALTER_EGO_NAME,
      titles: [ALTER_EGO_NAME],
      statuses: NONE,
    });
  });

  it("after the turn to the alter-ego, the next damage is the alter-ego's", () => {
    const t = table("hero");
    const turned = playing(t.state, BLAST_9.card.id).state;
    const healed: GameState = {
      ...turned,
      instances: {
        ...turned.instances,
        [identity(turned).instanceId]: { ...mustInstance(turned, identity(turned).instanceId), damage: 0 },
      },
    };
    const after = playing(healed, BLAST_4.card.id);
    expect(counters(after.state, t.ledger)).toEqual({ titled: 1, named: 1, other: 1 });
  });

  it("simultaneous (indirect) damage carries it too: lethal, replaced, and the hero took it", () => {
    const t = table("hero");
    const after = playing(t.state, SHRAPNEL.id);
    expect(identity(after.state).form).toBe("alterEgo");
    expect(counters(after.state, t.ledger)).toEqual({ titled: 1, named: 1, other: 0 });
  });
});
