/**
 * The `cannotAttach` ability timing: "Attach to [host]. If you cannot, [effects], then attach this card to [other
 * host]." resolves the card's own `cannotAttach` abilities in place of RRG 1.8 "Attach To"'s (p. 8) discard when a
 * revealed attachment has no legal `attachesTo` host. The card enters play if they attached it, and is discarded if
 * not. Proven with synthetic cards.
 */

import { flat, type AttachmentHost, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { Command } from "./commands.js";
import { createGame } from "./setup.js";
import type { InstanceId } from "./ids.js";
import { activeEncounterDeck, mustInstance } from "./query.js";
import { cardsInPlay } from "./select.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import { stubAttachment, stubMainScheme, stubMinion, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, HERO, seatIdentities, withEncounterPiles } from "./testing/scenario.js";

const self = { kind: "self" } as const;
const copies = (id: CardId, n: number): readonly CardId[] => Array.from({ length: n }, () => id);

const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const QUIET_VILLAIN = stubVillain({ id: "quiet", stages: [{ hp: flat(50), atk: 0, sch: 0 }] });
const LONG_SCHEME = stubMainScheme({
  id: "long",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});
const MINION = stubMinion({ id: "minion", atk: 0, sch: 0, hp: 4, boostIcons: 0 });

/** "Attach to the minion with the most printed hit points." */
const MINION_HOST: AttachmentHost = { kind: "superlative", among: "minion", order: "highest", measure: "printedHp" };
const PLACE_2: EffectSpec = {
  kind: "placeThreat",
  target: { kind: "mainScheme" },
  amount: { kind: "const", value: 2 },
};
/** "… If you cannot, place 2 threat on the main scheme, then attach this card to the villain." */
const FALLBACK = stubAbility("fallback.cannot-attach", {
  trigger: { kind: "cannotAttach" },
  effects: [PLACE_2, { kind: "attach", card: self, to: { kind: "villain" } }],
});
const FALLS_BACK = stubAttachment({ id: "falls-back", attachesTo: MINION_HOST, abilities: [FALLBACK.ref] });
/** A fallback whose effects never attach the card: it is discarded after they resolve. */
const NO_ATTACH = stubAbility("no-attach.cannot-attach", { trigger: { kind: "cannotAttach" }, effects: [PLACE_2] });
const STAYS_OUT = stubAttachment({ id: "stays-out", attachesTo: MINION_HOST, abilities: [NO_ATTACH.ref] });

const deps = depsOf(FALLBACK, NO_ATTACH);

function game(encounter: readonly CardId[]): GameState {
  const identities = seatIdentities(HERO, 1);
  const result = createGame(
    {
      seed: 6,
      cards: [...DEFAULT_CARDS, QUIET_VILLAIN, LONG_SCHEME, BLANK, MINION, FALLS_BACK, STAYS_OUT, ...identities],
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
const p1 = (state: GameState) => state.players[0]!.playerId;

const endTurn = (state: GameState): Command => ({ type: "endTurn", playerId: p1(state) });
const mainThreat = (state: GameState) => mustInstance(state, state.mainScheme.instanceId).threat;

describe("cannotAttach: an attachment's own 'If you cannot' fallback", () => {
  it("with no legal host, the fallback's effects resolve and it attaches where they put it, in play", () => {
    const start = game([FALLS_BACK.id]);
    const card = find(start, FALLS_BACK.id);
    const villain = start.villains[0]!.instanceId;
    const { state } = runCommands(dealtNext(start, card), deps, endTurn(start));

    expect(mainThreat(state)).toBe(mainThreat(start) + 2);
    expect(mustInstance(state, card).attachedTo).toBe(villain);
    expect(mustInstance(state, villain).attachments).toContain(card);
    expect(cardsInPlay(state)).toContain(card);
    expect(activeEncounterDeck(state).discard).not.toContain(card);
  });

  it("with a legal host, it attaches there and the fallback never resolves", () => {
    const start = withMinion(game([FALLS_BACK.id, MINION.id]));
    const card = find(start, FALLS_BACK.id);
    const { state } = runCommands(dealtNext(start, card), deps, endTurn(start));

    expect(mustInstance(state, card).attachedTo).toBe(find(start, MINION.id));
    expect(mainThreat(state)).toBe(mainThreat(start));
  });

  it("a fallback that leaves the card unattached still resolves, then the card is discarded (RRG 1.8 'Attach To')", () => {
    const start = game([STAYS_OUT.id]);
    const card = find(start, STAYS_OUT.id);
    const { state } = runCommands(dealtNext(start, card), deps, endTurn(start));

    expect(mainThreat(state)).toBe(mainThreat(start) + 2);
    expect(mustInstance(state, card).attachedTo).toBeNull();
    expect(activeEncounterDeck(state).discard).toContain(card);
  });
});
