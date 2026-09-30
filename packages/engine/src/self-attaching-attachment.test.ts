/**
 * An encounter attachment with no "attach to" text (`AttachmentCard.attachesTo` absent): RRG 1.8 "Reveal" (p. 38)
 * step 2 places it in front of the revealing player, not in play, and its own When Revealed attaches it (ruling,
 * Feb 20, 2026 (4): "If an attachment lacks 'attach to' text, it attaches when its 'When Revealed' ability
 * triggers"). Attached, it enters play; left unattached, it is discarded (RRG 1.8 "Attach To", p. 8). Old Grudge
 * (`sm` 27172) is the card this exists for. Proven with synthetic cards.
 */

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { Command } from "./commands.js";
import { createGame } from "./setup.js";
import type { InstanceId } from "./ids.js";
import { activeEncounterDeck, maxHitPoints, mustInstance } from "./query.js";
import { cardsInPlay } from "./select.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import { stubAttachment, stubMainScheme, stubMinion, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, HERO, seatIdentities, withEncounterPiles } from "./testing/scenario.js";

const self = { kind: "self" } as const;
const copies = (id: CardId, n: number): readonly CardId[] => Array.from({ length: n }, () => id);
const threat = (value: number): EffectSpec => ({
  kind: "placeThreat",
  target: { kind: "mainScheme" },
  amount: { kind: "const", value },
});

const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const QUIET_VILLAIN = stubVillain({ id: "quiet", stages: [{ hp: flat(50), atk: 0, sch: 0 }] });
const LONG_SCHEME = stubMainScheme({
  id: "long",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});
const MINION = stubMinion({ id: "minion", atk: 0, sch: 0, hp: 4, boostIcons: 0 });

/**
 * "When Revealed: [if this card is in play, place 5 threat]. Attach this card to the villain." The probe shows the
 * card is not in play while its When Revealed resolves.
 */
const ATTACH_SELF = stubAbility("self-attach.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [
    { kind: "if", condition: { kind: "exists", query: { self: true } }, then: [threat(5)] },
    { kind: "attach", card: self, to: { kind: "villain" } },
  ],
});
/** "Forced Response: After this card enters play, place 1 threat on the main scheme." Counts the announcements. */
const ENTERS = stubAbility("self-attach.enters", {
  trigger: { kind: "response", forced: true, on: { on: "cardEntersPlay", selfIs: "target" } },
  effects: [threat(1)],
});
const SELF_ATTACH = stubAttachment({
  id: "self-attach",
  statModifiers: { hp: 1 },
  abilities: [ATTACH_SELF.ref, ENTERS.ref],
});
/** A When Revealed that never attaches the card. */
const NO_ATTACH = stubAbility("never-attaches.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [threat(2)],
});
const NEVER_ATTACHES = stubAttachment({ id: "never-attaches", abilities: [NO_ATTACH.ref] });

const deps = depsOf(ATTACH_SELF, ENTERS, NO_ATTACH);

function game(encounter: readonly CardId[]): GameState {
  const identities = seatIdentities(HERO, 1);
  const result = createGame(
    {
      seed: 6,
      cards: [...DEFAULT_CARDS, QUIET_VILLAIN, LONG_SCHEME, BLANK, MINION, SELF_ATTACH, NEVER_ATTACHES, ...identities],
      villainCardId: QUIET_VILLAIN.id,
      mainSchemeCardId: LONG_SCHEME.id,
      encounterDeck: [...encounter, ...copies(BLANK.id, 16 - encounter.length)],
      includeIdentitySets: false,
      players: identities.map((identity) => ({ identityCardId: identity.id, deck: DEFAULT_DECK })),
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return runCommands(result.state, deps).state;
}

const find = (state: GameState, cardId: CardId): InstanceId => {
  const id = Object.keys(state.instances).find((key) => state.instances[key]?.cardId === cardId);
  if (!id) throw new Error(`no ${cardId}`);
  return id as InstanceId;
};

/** Stacks the deck so the villain's boost card comes first and `id` is the card dealt to the player. */
function dealtNext(state: GameState, id: InstanceId): GameState {
  const rest = activeEncounterDeck(state).deck.filter((candidate) => candidate !== id);
  return withEncounterPiles(state, { deck: [...rest.slice(0, 1), id, ...rest.slice(1)] });
}

const p1 = (state: GameState) => state.players[0]!.playerId;

/** Test surgery: the minion is in play, engaged with the player. */
function withMinion(state: GameState): GameState {
  const id = find(state, MINION.id);
  const deck = activeEncounterDeck(state).deck.filter((x) => x !== id);
  return {
    ...withEncounterPiles(state, { deck }),
    players: state.players.map((p) => ({ ...p, playArea: [...p.playArea, id] })),
    instances: { ...state.instances, [id]: { ...mustInstance(state, id), faceup: true, engagedWith: p1(state) } },
  };
}

const endTurn = (state: GameState): Command => ({ type: "endTurn", playerId: p1(state) });
const mainThreat = (state: GameState) => mustInstance(state, state.mainScheme.instanceId).threat;

describe("an attachment with no 'attach to' text attaches from its own When Revealed", () => {
  it("is not attached by the reveal step, is out of play during its When Revealed, then enters play once attached", () => {
    // A minion in play would be the first legal host of any generic `{ kind: "minion" }` rule: the reveal step must
    // not attach the card there.
    const start = withMinion(game([SELF_ATTACH.id, MINION.id]));
    const card = find(start, SELF_ATTACH.id);
    const villain = start.villains[0]!.instanceId;
    const minion = find(start, MINION.id);
    const { state } = runCommands(dealtNext(start, card), deps, endTurn(start));

    expect(state.pendingChoice).toBeNull();
    expect(mustInstance(state, card).attachedTo).toBe(villain);
    expect(mustInstance(state, villain).attachments).toEqual([card]);
    expect(mustInstance(state, minion).attachments).toEqual([]);
    expect(cardsInPlay(state)).toContain(card);
    // Not in play while its When Revealed ran (no +5), and announced as entering play exactly once (+1).
    expect(mainThreat(state)).toBe(mainThreat(start) + 1);
    // The printed stat box applies to its host.
    expect(maxHitPoints(state, villain)).toBe(51);
    expect(maxHitPoints(state, minion)).toBe(4);
    expect(activeEncounterDeck(state).discard).not.toContain(card);
  });

  it("left unattached by its When Revealed, it is discarded (RRG 1.8 'Attach To')", () => {
    const start = withMinion(game([NEVER_ATTACHES.id, MINION.id]));
    const card = find(start, NEVER_ATTACHES.id);
    const { state } = runCommands(dealtNext(start, card), deps, endTurn(start));

    expect(mainThreat(state)).toBe(mainThreat(start) + 2);
    expect(mustInstance(state, card).attachedTo).toBeNull();
    expect(mustInstance(state, find(start, MINION.id)).attachments).toEqual([]);
    expect(cardsInPlay(state)).not.toContain(card);
    expect(activeEncounterDeck(state).discard).toContain(card);
  });
});
