/**
 * An attachment whose own cost discards it still reads "attached character"/"attached scheme" as the card it was
 * attached to when the ability was initiated (`SELF_HOST`, `select.ts`). Before this, `host` resolved to nothing and
 * `hostOfSelf: false`/`excluding: host` filtered out nothing once the cost had discarded the card: Overwatch
 * (`spiderham` 30019), "discard this card → remove an equal amount of threat from a different scheme", still offered
 * the attached scheme as "a different scheme".
 *
 * Sources: RRG 1.8 "Initiating Abilities" (p. 24): the cost is paid (step 5) before the ability resolves (step 6), and
 * an ability still resolves after its cost removes its own card from play; "Attachments" (p. 9): an attachment's
 * "attached" refers to the card it is attached to.
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, type GameSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import { resolveRef, SELF_HOST, type EffectContext } from "./select.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { stubAlly, stubUpgrade } from "./testing/fixtures.js";
import { defaultPick } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const mark = (target: TargetRef, counterType: string): EffectSpec => ({
  kind: "addCounters",
  target,
  counterType,
  amount: { kind: "const", value: 1 },
});

/** "Action: Discard this card → place a mark on attached ally, and a note on each ally it is not attached to." */
const TAG_ACTION = stubAbility("tag.action", {
  trigger: { kind: "action" },
  cost: { discardSelf: true },
  effects: [
    mark({ kind: "host" }, "mark"),
    mark({ kind: "each", query: { categories: ["ally"], hostOfSelf: false } }, "note"),
  ],
} satisfies AbilityDefinition);
/**
 * "Response: After attached ally thwarts, discard this card → place a mark on attached ally, and a note on each other
 * ally." Overwatch's shape: an optional trigger whose cost discards the card, then `excluding: host`.
 */
const TAG_RESPONSE = stubAbility("tag.response", {
  trigger: { kind: "response", forced: false, on: { on: "thwart", sourceIs: { hostOfSelf: true } } },
  cost: { discardSelf: true },
  effects: [
    mark({ kind: "host" }, "mark"),
    mark({ kind: "each", query: { categories: ["ally"], excluding: { kind: "host" } } }, "note"),
  ],
} satisfies AbilityDefinition);
/** The same action, paid by exhausting instead: the card stays attached, and `host` reads it live. */
const PIN_ACTION = stubAbility("pin.action", {
  trigger: { kind: "action" },
  cost: { exhaustSelf: true },
  effects: [mark({ kind: "host" }, "mark")],
} satisfies AbilityDefinition);

const TAG = stubUpgrade({ id: "tag", cost: 0, abilities: [TAG_ACTION.ref, TAG_RESPONSE.ref] });
const PIN = stubUpgrade({ id: "pin", cost: 0, abilities: [PIN_ACTION.ref] });
const CARRIER = stubAlly({ id: "carrier", cost: 0, atk: 1, thw: 1, hp: 4 });
const BYSTANDER = stubAlly({ id: "bystander", cost: 0, atk: 1, thw: 1, hp: 4 });

const deps: EngineDeps = depsOf(TAG_ACTION, TAG_RESPONSE, PIN_ACTION);
const CARDS = [TAG, PIN, CARRIER, BYSTANDER];
const DECK: readonly CardId[] = CARDS.map((card) => card.id);

/** Attaches `upgrade` (already in play) to `host` (surgery): an attachment is in play through its host, not the play area. */
function attach(state: GameState, upgrade: InstanceId, host: InstanceId): GameState {
  return {
    ...state,
    players: state.players.map((p) => ({ ...p, playArea: p.playArea.filter((id) => id !== upgrade) })),
    instances: {
      ...state.instances,
      [host]: { ...mustInstance(state, host), attachments: [...mustInstance(state, host).attachments, upgrade] },
      [upgrade]: { ...mustInstance(state, upgrade), attachedTo: host },
    },
  };
}

interface Table {
  readonly state: GameState;
  readonly carrier: InstanceId;
  readonly bystander: InstanceId;
  readonly tag: InstanceId;
  readonly pin: InstanceId;
}

/** Carrier carries Tag and Pin; Bystander carries nothing; the main scheme has 5 threat. */
function table(): Table {
  let state = gameAtFirstTurn({ cards: CARDS, deps, deck: DECK });
  const put = (card: CardId): InstanceId => {
    const placed = playerCardIntoPlay(state, card);
    state = placed.state;
    return placed.id;
  };
  const carrier = put(CARRIER.id);
  const bystander = put(BYSTANDER.id);
  const tag = put(TAG.id);
  const pin = put(PIN.id);
  state = attach(attach(state, tag, carrier), pin, carrier);
  const main = state.mainScheme.instanceId;
  state = { ...state, instances: { ...state.instances, [main]: { ...mustInstance(state, main), threat: 5 } } };
  return { state, carrier, bystander, tag, pin };
}

const accepting =
  (abilityId: string) =>
  (state: GameState): readonly string[] => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "chooseTriggers") {
      return choice.options.filter((o) => o.optionId.endsWith(`:${abilityId}`)).map((o) => o.optionId);
    }
    return defaultPick(state);
  };

const use = (card: InstanceId, abilityId: string): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: card,
  abilityId: abilityId as never,
  payment: [],
});

const counter = (state: GameState, id: InstanceId, type: string): number => mustInstance(state, id).counters[type] ?? 0;

const expectReplay = (session: GameSession): void => {
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
};

describe("an attachment's host, once its own cost has discarded it", () => {
  it("an action (discard this card →): `host` is the card it was attached to, `hostOfSelf: false` excludes it", () => {
    const t = table();
    const { state, session } = runCommandsPicking(t.state, deps, defaultPick, use(t.tag, TAG_ACTION.ref.id));
    expect(mustPlayer(state, P1).discard).toContain(t.tag);
    expect(mustInstance(state, t.tag).attachedTo).toBeNull();
    expect(counter(state, t.carrier, "mark")).toBe(1);
    expect(counter(state, t.carrier, "note")).toBe(0);
    expect(counter(state, t.bystander, "note")).toBe(1);
    expect(counter(state, t.bystander, "mark")).toBe(0);
    expectReplay(session);
  });

  it("an optional response (discard this card →): `host` and `excluding: host` read the card it was attached to", () => {
    const t = table();
    const { state, session } = runCommandsPicking(t.state, deps, accepting(TAG_RESPONSE.ref.id), {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: t.carrier,
      schemeInstanceId: t.state.mainScheme.instanceId,
    });
    expect(mustPlayer(state, P1).discard).toContain(t.tag);
    expect(counter(state, t.carrier, "mark")).toBe(1);
    expect(counter(state, t.carrier, "note")).toBe(0);
    expect(counter(state, t.bystander, "note")).toBe(1);
    expectReplay(session);
  });

  it("declining the response leaves it attached and marks nothing", () => {
    const t = table();
    const { state } = runCommandsPicking(t.state, deps, defaultPick, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: t.carrier,
      schemeInstanceId: t.state.mainScheme.instanceId,
    });
    expect(mustInstance(state, t.tag).attachedTo).toBe(t.carrier);
    expect(counter(state, t.carrier, "mark")).toBe(0);
    expect(counter(state, t.bystander, "note")).toBe(0);
  });

  it("a card still attached reads its host live (exhaust cost)", () => {
    const t = table();
    const { state } = runCommandsPicking(t.state, deps, defaultPick, use(t.pin, PIN_ACTION.ref.id));
    expect(mustInstance(state, t.pin).exhausted).toBe(true);
    expect(counter(state, t.carrier, "mark")).toBe(1);
  });

  it("the live host wins over the recorded one while the card is attached; the recorded one only once it is not", () => {
    const t = table();
    const recorded: EffectContext = {
      selfInstanceId: t.tag,
      controllerId: P1,
      event: null,
      bindings: { [SELF_HOST]: [t.bystander] },
      deps,
    };
    expect(resolveRef(t.state, { kind: "host" }, recorded)).toEqual([t.carrier]);
    const detached: GameState = {
      ...t.state,
      instances: { ...t.state.instances, [t.tag]: { ...mustInstance(t.state, t.tag), attachedTo: null } },
    };
    expect(resolveRef(detached, { kind: "host" }, recorded)).toEqual([t.bystander]);
    expect(resolveRef(detached, { kind: "host" }, { ...recorded, bindings: {} })).toEqual([]);
  });
});
