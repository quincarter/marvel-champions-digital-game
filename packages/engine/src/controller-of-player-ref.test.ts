/**
 * docs/phase7-wave3.md §3.39: `PlayerRef controllerOf`, "the player who controls X". Synthetic cards shaped like
 * Single-Minded Fury (`gmw` 16114): "When Revealed: Ronan the Accuser attacks the player who controls the Power Stone
 * (even if that player is in alter-ego form). If no attack was made this way, this card gains surge." — with §4 Q11's
 * reading of "controls the Power Stone": the stone is attached to that player's identity, which is
 * `controllerOf(each({ categories: ["identity"], hasAttachment: { name: "stone" } }))` (§3.40).
 *
 * Sources: RRG 1.8 "Ownership and Control" (p. 31): "Encounter cards are considered to be under the control of the
 * scenario", so the stone on the villain names no player, no attack is made, and the card surges.
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { activeEncounterDeck, mustInstance, mustPlayer } from "./query.js";
import { resolvePlayers, type EffectContext } from "./select.js";
import type { EffectSpec, PlayerRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubAttachment, stubEvent, stubTreachery } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, P1, P2, playFree } from "./testing/wave3.js";

const STONE_HOLDER: PlayerRef = {
  kind: "controllerOf",
  target: { kind: "each", query: { categories: ["identity"], hasAttachment: { name: "stone" } } },
};

const FURY_REVEALED = stubAbility("fury.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [
    { kind: "enemyAttack", enemies: { kind: "villain" }, against: STONE_HOLDER, bind: "fury" },
    {
      kind: "if",
      condition: { kind: "not", of: { kind: "varAtLeast", name: "fury.made", amount: 1 } },
      then: [{ kind: "gainSurge" }],
    },
  ],
});
const FURY = stubTreachery({ id: "fury", boostIcons: 0, abilities: [FURY_REVEALED.ref] });
const STONE = stubAttachment({ id: "stone", attachesTo: { kind: "villain" } });
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });

/** A player event that reveals Fury from the encounter deck, so the test controls exactly when it is revealed. */
const SUMMON_EFFECTS: readonly EffectSpec[] = [
  { kind: "selectCards", slot: "fury", cards: { kind: "encounter", zones: ["deck"], filter: { name: "fury" } } },
  { kind: "revealCard", cards: { kind: "slot", slot: "fury" }, player: { kind: "controller" } },
];
const SUMMON_ACTION = stubAbility("summon.action", { trigger: { kind: "action" }, effects: SUMMON_EFFECTS });
const SUMMON = stubEvent({ id: "summon", cost: 0, abilities: [SUMMON_ACTION.ref] });

const deps: EngineDeps = depsOf(FURY_REVEALED, SUMMON_ACTION);
const CARDS = [FURY, STONE, BLANK, SUMMON];
const ENCOUNTER: readonly CardId[] = [FURY.id, STONE.id, ...copiesOf(BLANK.id, 20)];

/** Two players: p1 in hero form, p2 in alter-ego form. The stone goes onto `host` (surgery). */
function start(host: "p2" | "villain"): { state: GameState; stone: InstanceId } {
  const base = gameAtFirstTurn({ cards: CARDS, deps, encounter: ENCOUNTER, deck: copiesOf(SUMMON.id, 2), players: 2 });
  const withForms: GameState = {
    ...base,
    players: base.players.map((p) => ({
      ...p,
      identity: { ...p.identity, form: p.playerId === P1 ? "hero" : "alterEgo" },
    })),
  };
  const piles = activeEncounterDeck(withForms);
  const stone = piles.deck.find((id) => withForms.instances[id]?.cardId === STONE.id)!;
  const hostId = host === "p2" ? mustPlayer(withForms, P2).identity.instanceId : withForms.villains[0]!.instanceId;
  const deckId = withForms.encounterDeckOrder[0]!;
  return {
    stone,
    state: {
      ...withForms,
      encounterDecks: {
        ...withForms.encounterDecks,
        [deckId]: { ...piles, deck: piles.deck.filter((id) => id !== stone) },
      },
      instances: {
        ...withForms.instances,
        [hostId]: {
          ...mustInstance(withForms, hostId),
          attachments: [...mustInstance(withForms, hostId).attachments, stone],
        },
        [stone]: { ...mustInstance(withForms, stone), attachedTo: hostId, faceup: true },
      },
    },
  };
}

/** The identity each resolved enemy attack was against. */
const attacked = (state: GameState, events: readonly GameEvent[]) =>
  events.flatMap((e) =>
    e.type === "attackResolved"
      ? state.players.filter((p) => p.identity.instanceId === e.targetInstanceId).map((p) => p.playerId)
      : [],
  );
const furySurged = (state: GameState, events: readonly GameEvent[]) =>
  events.some((e) => e.type === "surgeTriggered" && state.instances[e.instanceId]?.cardId === FURY.id);

describe("§3.39 PlayerRef controllerOf", () => {
  it("names the player whose identity holds the stone, and nobody for a card the scenario controls", () => {
    const onP2 = start("p2");
    const context: EffectContext = { selfInstanceId: null, controllerId: P1, event: null, bindings: {}, deps };
    expect(resolvePlayers(onP2.state, STONE_HOLDER, context)).toEqual([P2]);
    const onVillain = start("villain");
    expect(resolvePlayers(onVillain.state, STONE_HOLDER, context)).toEqual([]);
    // The stone itself is an encounter card: controlled by the scenario, so it names nobody either.
    expect(
      resolvePlayers(onP2.state, { kind: "controllerOf", target: { kind: "named", name: "stone" } }, context),
    ).toEqual([]);
  });

  it("the villain attacks the player holding the stone, even in alter-ego form, and the card does not surge", () => {
    const { state: start2 } = start("p2");
    const { state, events, session } = playFree(start2, deps, SUMMON.id);
    expect(attacked(state, events)).toEqual([P2]);
    expect(mustPlayer(state, P2).identity.form).toBe("alterEgo");
    expect(mustInstance(state, mustPlayer(state, P2).identity.instanceId).damage).toBeGreaterThan(0);
    expect(furySurged(state, events)).toBe(false);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("with the stone attached to no identity no attack is made, so the card gains surge", () => {
    const { state: onVillain } = start("villain");
    const { state, events } = playFree(onVillain, deps, SUMMON.id);
    expect(events.some((e) => e.type === "attackResolved")).toBe(false);
    expect(furySurged(state, events)).toBe(true);
  });
});
