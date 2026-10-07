/**
 * `legalActions` and an Action a player may trigger on a card they do not control. RRG 1.8 "Action" (p. 6): "Players
 * can only trigger action abilities on cards they control or on encounter cards", during their own turn or by request
 * during another player's; text naming who may trigger an ability (`triggerableBy`, docs/phase7-wave6.md §3.11: "Any
 * player may trigger this ability", "Any player can do this") replaces the controller rule. The listing reads the same
 * `triggeringPlayers` the `useAbility` command does and every entry is probed through the command, so a listed entry
 * is an accepted command and the two cannot drift.
 *
 * Synthetic cards: the Stash is shaped like Plot Convenience (`deadpool` 44050: a support, "Action: Exhaust … Any
 * player may trigger this ability"), the Cache like its "attach 1 aspect card from your hand" condition (read against
 * the triggering player's hand), the Hush like The Merc with the Mouth (44032: "Other players cannot resolve player
 * card abilities during your turn"), the Beacon like a campaign environment ("Any player can do this").
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps, RuleSpec } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, startSession } from "./engine.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustInstance, mustPlayer } from "./query.js";
import { activeAbilityRefs, cardsInPlay } from "./select.js";
import type { PlayerRef, Predicate } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAttachment, stubEnvironment, stubEvent, stubSupport } from "./testing/fixtures.js";
import { giveCard, TREACHERY } from "./testing/scenario.js";
import { copiesOf, encounterCardInVillainArea, gameAtFirstTurn, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const def = (d: AbilityDefinition) => d;
const you: PlayerRef = { kind: "controller" };
const others: PlayerRef = { kind: "others", of: you };
const anyPlayer: PlayerRef = { kind: "each" };
const self = { kind: "self" } as const;
const one = { kind: "const", value: 1 } as const;
const mark = (type: string) => ({ kind: "addCounters", target: self, counterType: type, amount: one }) as const;

/** "Action: Exhaust this card → … Any player may trigger this ability." */
const STASH_ACTION = stubAbility(
  "stash.action",
  def({ trigger: { kind: "action", triggerableBy: anyPlayer }, cost: { exhaustSelf: true }, effects: [mark("used")] }),
);
const STASH = stubSupport({ id: "stash", cost: 0, abilities: [STASH_ACTION.ref] });

/** The same for any player, usable only while the triggering player ("you") holds an event. */
const HOLDS_AN_EVENT: Predicate = {
  kind: "compare",
  left: { kind: "handCount", player: you, filter: { categories: ["event"] } },
  op: "atLeast",
  right: one,
};
const CACHE_ACTION = stubAbility(
  "cache.action",
  def({
    trigger: { kind: "action", triggerableBy: anyPlayer, while: HOLDS_AN_EVENT },
    cost: { exhaustSelf: true },
    effects: [mark("used")],
  }),
);
const CACHE = stubSupport({ id: "cache", cost: 0, abilities: [CACHE_ACTION.ref] });
/** The only event in either deck; it is played from a response window, so it is never an Action of its own. */
const TOKEN_RESPONSE = stubAbility(
  "token.response",
  def({ trigger: { kind: "response", forced: false, on: { on: "defended" } }, effects: [] }),
);
const TOKEN = stubEvent({ id: "token", cost: 0, abilities: [TOKEN_RESPONSE.ref] });

/** A player card's Action with nobody named: its controller's alone. */
const OWN_ACTION = stubAbility("own.action", def({ trigger: { kind: "action" }, effects: [mark("used")] }));
const OWN = stubSupport({ id: "own", cost: 0, abilities: [OWN_ACTION.ref] });

/** "Other players cannot resolve player card abilities during your turn", attached to a player's identity. */
const BAN: readonly RuleSpec[] = [
  {
    kind: "cannotResolveTriggeredAbilities",
    on: {},
    player: others,
    playerCards: true,
    while: { kind: "turnOf", player: you },
  },
];
const HUSH_RULE = stubAbility("hush.constant", def({ trigger: { kind: "constant", rules: BAN }, effects: [] }));
const HUSH = stubAttachment({ id: "hush", attachesTo: { kind: "yourIdentity" }, abilities: [HUSH_RULE.ref] });

/** "Action: … (Limit once per round per player.) Any player can do this." on an encounter environment. */
const BEACON_ACTION = stubAbility(
  "beacon.action",
  def({
    trigger: { kind: "action", triggerableBy: anyPlayer },
    limit: { count: 1, period: "round", per: "player" },
    effects: [mark("used")],
  }),
);
const BEACON = stubEnvironment({ id: "beacon", abilities: [BEACON_ACTION.ref] });

/** "Action: Spend 1 resource → discard this card." on an encounter attachment, and the same naming any player. */
const SHACKLE_ACTION = stubAbility(
  "shackle.action",
  def({ trigger: { kind: "action" }, cost: { resources: 1 }, effects: [{ kind: "discardFromPlay", target: self }] }),
);
const SHACKLE = stubAttachment({ id: "shackle", abilities: [SHACKLE_ACTION.ref] });
const LATCH_ACTION = stubAbility(
  "latch.action",
  def({
    trigger: { kind: "action", triggerableBy: anyPlayer },
    cost: { resources: 1 },
    effects: [{ kind: "discardFromPlay", target: self }],
  }),
);
const LATCH = stubAttachment({ id: "latch", abilities: [LATCH_ACTION.ref] });

const ABILITIES = [
  STASH_ACTION,
  CACHE_ACTION,
  TOKEN_RESPONSE,
  OWN_ACTION,
  HUSH_RULE,
  BEACON_ACTION,
  SHACKLE_ACTION,
  LATCH_ACTION,
];
const deps: EngineDeps = depsOf(...ABILITIES);

/** Two seats at p1's first turn, both in alter-ego form. */
const start = (): GameState =>
  gameAtFirstTurn({
    deps,
    players: 2,
    cards: [STASH, CACHE, TOKEN, OWN, HUSH, BEACON, SHACKLE, LATCH],
    deck: [STASH.id, CACHE.id, OWN.id, TOKEN.id],
    encounter: [...copiesOf(TREACHERY.id, 28), HUSH.id, BEACON.id, SHACKLE.id, LATCH.id],
  });

/** An encounter card out of the encounter deck and attached to `host` (surgery). */
function attachedTo(state: GameState, card: { readonly id: typeof HUSH.id }, host: InstanceId) {
  const placed = encounterCardInVillainArea(state, card.id);
  return {
    id: placed.id,
    state: {
      ...placed.state,
      villainArea: placed.state.villainArea.filter((id) => id !== placed.id),
      instances: {
        ...placed.state.instances,
        [placed.id]: { ...mustInstance(placed.state, placed.id), attachedTo: host },
        [host]: {
          ...mustInstance(placed.state, host),
          attachments: [...mustInstance(placed.state, host).attachments, placed.id],
        },
      },
    } satisfies GameState,
  };
}

const identityOf = (state: GameState, player: PlayerId): InstanceId => mustPlayer(state, player).identity.instanceId;
const endTurn = (playerId: PlayerId): Command => ({ type: "endTurn", playerId });
const use = (playerId: PlayerId, cardInstanceId: InstanceId, ability: StubAbility): Command => ({
  type: "useAbility",
  playerId,
  cardInstanceId,
  abilityId: ability.ref.id,
  payment: [],
});
const after = (state: GameState, ...commands: Command[]): GameState =>
  driveSession(startSession(state), deps, commands).session.state;
const activePlayer = (state: GameState): PlayerId | null =>
  state.step.phase === "player" && state.step.kind === "turn" ? state.step.activePlayerId : null;

/** How `player`'s list carries the card's Action: "legal", "illegal: <the engine's message>", or "absent". */
function listed(state: GameState, player: PlayerId, id: InstanceId): string {
  const actions = legalActions(state, player, deps);
  if (actions.kind !== "turn" && actions.kind !== "notYourTurn") return actions.kind;
  const ours = (ref: { readonly kind: string; readonly instanceId?: InstanceId }) =>
    ref.kind === "useAbility" && ref.instanceId === id;
  if (actions.legal.some((a) => ours(a.action))) return "legal";
  const illegal = actions.illegal.find((a) => ours(a.action));
  return illegal ? `illegal: ${illegal.message}` : "absent";
}
const listKind = (state: GameState, player: PlayerId): string => legalActions(state, player, deps).kind;

describe("an 'any player may trigger this' Action on another player's card (Plot Convenience)", () => {
  /** p1 controls the Stash. */
  const table = () => playerCardIntoPlay(start(), STASH.id, P1);

  it("is listed for its controller and for the other player, on either player's turn", () => {
    const { state, id } = table();
    expect(activePlayer(state)).toBe(P1);
    expect([listKind(state, P1), listKind(state, P2)]).toEqual(["turn", "notYourTurn"]);
    expect([listed(state, P1, id), listed(state, P2, id)]).toEqual(["legal", "legal"]);
    const p2Turn = after(state, endTurn(P1));
    expect(activePlayer(p2Turn)).toBe(P2);
    expect([listKind(p2Turn, P1), listKind(p2Turn, P2)]).toEqual(["notYourTurn", "turn"]);
    expect([listed(p2Turn, P1, id), listed(p2Turn, P2, id)]).toEqual(["legal", "legal"]);
  });

  it("the other player's listed example is the command: it resolves for them and the card stays its controller's", () => {
    const { state, id } = table();
    const p2Turn = after(state, endTurn(P1));
    const actions = legalActions(p2Turn, P2, deps);
    if (actions.kind !== "turn") throw new Error(actions.kind);
    const entry = actions.legal.find((a) => a.action.kind === "useAbility" && a.action.instanceId === id);
    expect(entry?.example).toEqual(use(P2, id, STASH_ACTION));
    const used = after(p2Turn, entry!.example);
    expect(mustInstance(used, id)).toMatchObject({ exhausted: true, controllerId: P1, counters: { used: 1 } });
    // Its cost is spent for everybody: neither player's list offers it again.
    expect([listed(used, P1, id), listed(used, P2, id)]).toEqual([
      "illegal: the card is already exhausted",
      "illegal: the card is already exhausted",
    ]);
  });

  it("is not legal for the other player during the Merc player's own turn, and is again on their own turn", () => {
    const stash = table();
    const { state } = attachedTo(stash.state, HUSH, identityOf(stash.state, P1));
    expect(activePlayer(state)).toBe(P1);
    expect([listed(state, P1, stash.id), listed(state, P2, stash.id)]).toEqual([
      "legal",
      "illegal: that ability cannot be resolved right now",
    ]);
    expect(applyCommand(state, use(P2, stash.id, STASH_ACTION), deps).ok).toBe(false);
    const p2Turn = after(state, endTurn(P1));
    expect(activePlayer(p2Turn)).toBe(P2);
    expect([listed(p2Turn, P1, stash.id), listed(p2Turn, P2, stash.id)]).toEqual(["legal", "legal"]);
  });

  it("its condition reads the triggering player: listed as legal only for the player whose own hand meets it", () => {
    const cache = playerCardIntoPlay(start(), CACHE.id, P1);
    // p2 holds the event; p1 holds none (any drawn copy is set aside in their discard pile).
    const given = giveCard(cache.state, P2, TOKEN.id);
    const isToken = (id: InstanceId) => mustInstance(given.state, id).cardId === TOKEN.id;
    const state: GameState = {
      ...given.state,
      players: given.state.players.map((p) =>
        p.playerId === P1
          ? { ...p, hand: p.hand.filter((id) => !isToken(id)), discard: [...p.discard, ...p.hand.filter(isToken)] }
          : p,
      ),
    };
    expect([listed(state, P1, cache.id), listed(state, P2, cache.id)]).toEqual([
      "illegal: that ability cannot be triggered: its condition is not met",
      "legal",
    ]);
    expect(applyCommand(state, use(P1, cache.id, CACHE_ACTION), deps).ok).toBe(false);
    expect(applyCommand(state, use(P2, cache.id, CACHE_ACTION), deps).ok).toBe(true);
  });
});

describe("an Action with nobody named on another player's card", () => {
  it("is absent from the other player's list on either turn, and refused if sent", () => {
    const { state, id } = playerCardIntoPlay(start(), OWN.id, P1);
    expect([listed(state, P1, id), listed(state, P2, id)]).toEqual(["legal", "absent"]);
    const p2Turn = after(state, endTurn(P1));
    expect([listed(p2Turn, P1, id), listed(p2Turn, P2, id)]).toEqual(["legal", "absent"]);
    const tried = applyCommand(p2Turn, use(P2, id, OWN_ACTION), deps);
    expect(tried.ok).toBe(false);
    if (!tried.ok) expect(tried.error.message).toBe("you do not control that card");
  });
});

describe("a campaign environment's 'Any player can do this' Action", () => {
  it("is listed for each player on either turn, and its per-player limit is each player's own", () => {
    const { state, id } = encounterCardInVillainArea(start(), BEACON.id);
    expect([listed(state, P1, id), listed(state, P2, id)]).toEqual(["legal", "legal"]);
    // p2 uses it during p1's turn: spent for p2, still open to p1.
    const p2Used = after(state, use(P2, id, BEACON_ACTION));
    expect(activePlayer(p2Used)).toBe(P1);
    expect([listed(p2Used, P1, id), listed(p2Used, P2, id)]).toEqual(["legal", "illegal: limit 1 per round"]);
    const p2Turn = after(p2Used, endTurn(P1));
    expect([listed(p2Turn, P1, id), listed(p2Turn, P2, id)]).toEqual(["legal", "illegal: limit 1 per round"]);
  });
});

describe("an encounter attachment on a player's card (RRG 1.8 'Attachment', p. 8)", () => {
  it("with nobody named, only the attached card's controller has it as legal, on either turn", () => {
    const { state, id } = attachedTo(start(), SHACKLE, identityOf(start(), P1));
    const refused = "illegal: only the player it is attached to can use that card";
    expect([listed(state, P1, id), listed(state, P2, id)]).toEqual(["legal", refused]);
    const p2Turn = after(state, endTurn(P1));
    expect([listed(p2Turn, P1, id), listed(p2Turn, P2, id)]).toEqual(["legal", refused]);
  });

  it("naming any player, it is legal for both", () => {
    const { state, id } = attachedTo(start(), LATCH, identityOf(start(), P1));
    expect([listed(state, P1, id), listed(state, P2, id)]).toEqual(["legal", "legal"]);
  });
});

describe("the listing and command validation agree", () => {
  /** Every card above in play: p1's Stash, Cache and Own, p2's Stash and Own, the Beacon, a Shackle and a Latch on p1. */
  function crowded(hush: boolean): GameState {
    let state = start();
    for (const [card, player] of [
      [STASH, P1],
      [CACHE, P1],
      [OWN, P1],
      [STASH, P2],
      [OWN, P2],
    ] as const) {
      state = playerCardIntoPlay(state, card.id, player).state;
    }
    state = encounterCardInVillainArea(state, BEACON.id).state;
    state = attachedTo(state, SHACKLE, identityOf(state, P1)).state;
    state = attachedTo(state, LATCH, identityOf(state, P1)).state;
    return hush ? attachedTo(state, HUSH, identityOf(state, P1)).state : state;
  }

  /** `useAbility` commands `player` could send for one Action: unpaid, and paid with each card of their hand. */
  const attempts = (state: GameState, player: PlayerId, id: InstanceId, abilityId: string): readonly Command[] =>
    [[], ...mustPlayer(state, player).hand.map((card) => [{ fromHand: card }])].map((payment) => ({
      type: "useAbility",
      playerId: player,
      cardInstanceId: id,
      abilityId: abilityId as never,
      payment,
    }));

  /**
   * Both directions, for both seats: every listed entry's example is accepted, and an Action in play that is not
   * listed as legal is refused however it is paid. Returns how many of each were checked.
   */
  function check(state: GameState): { readonly accepted: number; readonly refused: number } {
    let accepted = 0;
    let refused = 0;
    for (const player of [P1, P2]) {
      const actions = legalActions(state, player, deps);
      if (actions.kind !== "turn" && actions.kind !== "notYourTurn") throw new Error(actions.kind);
      for (const entry of actions.legal) {
        const result = applyCommand(state, entry.example, deps);
        expect(result.ok, `${player} ${JSON.stringify(entry.action)}`).toBe(true);
        accepted++;
      }
      const legal = new Set(
        actions.legal.flatMap((a) =>
          a.action.kind === "useAbility" ? [`${a.action.instanceId}:${a.action.abilityId}`] : [],
        ),
      );
      for (const id of cardsInPlay(state)) {
        for (const ref of activeAbilityRefs(state, id, deps)) {
          if (deps.abilities[ref.id]?.trigger.kind !== "action" || legal.has(`${id}:${ref.id}`)) continue;
          for (const command of attempts(state, player, id, ref.id)) {
            expect(applyCommand(state, command, deps).ok, `${player} ${id} ${ref.id} is not listed`).toBe(false);
          }
          refused++;
        }
      }
    }
    return { accepted, refused };
  }

  /** Walks a game from `state`: each seat in turn uses every Action its list offers, then the active player ends. */
  function walk(state: GameState): { readonly accepted: number; readonly refused: number; readonly states: number } {
    let current = state;
    const total = { accepted: 0, refused: 0, states: 0 };
    const tally = () => {
      const counts = check(current);
      total.accepted += counts.accepted;
      total.refused += counts.refused;
      total.states++;
    };
    for (let turn = 0; turn < 2; turn++) {
      const active = activePlayer(current);
      if (!active) throw new Error("not a player turn");
      tally();
      for (const player of [P2, P1]) {
        for (let guard = 0; guard < 20; guard++) {
          const actions = legalActions(current, player, deps);
          if (actions.kind !== "turn" && actions.kind !== "notYourTurn") throw new Error(actions.kind);
          const next = actions.legal.find((a) => a.action.kind === "useAbility");
          if (!next) break;
          current = after(current, next.example);
          tally();
        }
      }
      current = after(current, endTurn(active));
    }
    return total;
  }

  it("without the Merc's rule: across two turns every listed entry is accepted and nothing unlisted is", () => {
    const state = crowded(false);
    // p1's first list: its own Stash and Own, p2's Stash, the Beacon, the Shackle and the Latch (the Cache when p1
    // holds an event); never p2's Own.
    const p2Own = mustPlayer(state, P2).playArea.find((id) => mustInstance(state, id).cardId === OWN.id)!;
    expect(listed(state, P1, p2Own)).toBe("absent");
    const total = walk(state);
    expect(total.states).toBeGreaterThan(10);
    expect(total.accepted).toBeGreaterThan(total.states);
    expect(total.refused).toBeGreaterThan(0);
  });

  it("with it on p1's identity: the same, and during p1's turn p2 has no player card's Action as legal", () => {
    const state = crowded(true);
    const actions = legalActions(state, P2, deps);
    if (actions.kind !== "notYourTurn") throw new Error(actions.kind);
    const cardOf = (id: InstanceId) => mustInstance(state, id).cardId;
    // Encounter cards are left alone by the rule: the Beacon and the any-player Latch. The Shackle is p1's alone.
    expect(
      actions.legal.flatMap((a) => (a.action.kind === "useAbility" ? [cardOf(a.action.instanceId)] : [])).sort(),
    ).toEqual([BEACON.id, LATCH.id]);
    const total = walk(state);
    expect(total.states).toBeGreaterThan(10);
    expect(total.refused).toBeGreaterThan(0);
  });
});
