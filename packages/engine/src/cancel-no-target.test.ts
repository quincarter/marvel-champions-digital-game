/**
 * docs/phase7-wave4.md §3.27 (§4 Q16, user decision 2026-09-24): a cancel whose only target cannot be canceled is not
 * offered, so no cost is paid. Synthetic cards shaped like Enhanced Spider-Sense / Kree Command Ship ("Interrupt: When a
 * treachery is revealed, exhaust this → cancel its 'When Revealed' effects") against a Cosmic Entity (`mts` 21042,
 * "This effect cannot be canceled.").
 *
 * Sources: RRG 1.8 "Initiating Abilities" (p. 24, step 2: an ability with no valid target cannot be initiated),
 * "Cancel" and "'Cannot'" (p. 11).
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { activeEncounterDeckId, mustInstance } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubSupport, stubTreachery } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, onTopOfEncounterDeck, P1, playerCardIntoPlay } from "./testing/wave3.js";

const self = { kind: "self" } as const;
const PLAIN_REVEALED = stubAbility("plain.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [
    {
      kind: "dealDamage",
      target: { kind: "identityOf", player: { kind: "controller" } },
      amount: { kind: "const", value: 1 },
    },
  ],
});
const PLAIN = stubTreachery({ id: "plain-treachery", boostIcons: 0, abilities: [PLAIN_REVEALED.ref] });
const ENTITY_REVEALED = stubAbility("entity.when-revealed", {
  trigger: { kind: "whenRevealed" },
  uncancellable: true,
  effects: [
    { kind: "dealDamage", target: { kind: "villain" }, amount: { kind: "const", value: 2 } },
    { kind: "moveCards", cards: { kind: "ref", ref: self }, to: "removedFromGame" },
  ],
});
const ENTITY = stubEvent({ id: "entity", cost: 0, abilities: [ENTITY_REVEALED.ref] });

const SENSE = stubAbility("sense.interrupt", {
  trigger: { kind: "interrupt", forced: false, on: { on: "encounterCardRevealing" } },
  cost: { exhaustSelf: true },
  effects: [{ kind: "cancelWhenRevealed" }],
});
const SENSE_CARD = stubSupport({ id: "sense", cost: 0, abilities: [SENSE.ref] });
const REVEAL_ACTION = stubAbility("reveal.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "revealEncounterCard", player: { kind: "controller" } }],
});
const REVEAL = stubEvent({ id: "reveal", cost: 0, abilities: [REVEAL_ACTION.ref] });
const deps: EngineDeps = depsOf(PLAIN_REVEALED, ENTITY_REVEALED, SENSE, REVEAL_ACTION);

function start(top: typeof PLAIN | typeof ENTITY): { state: GameState; sense: InstanceId } {
  const base = gameAtFirstTurn({
    cards: [PLAIN, ENTITY, SENSE_CARD, REVEAL],
    deps,
    encounter: [PLAIN.id, ...copiesOf(PLAIN.id, 5)],
    deck: [SENSE_CARD.id, ENTITY.id, ...copiesOf(REVEAL.id, 3)],
  });
  const placed = playerCardIntoPlay(base, SENSE_CARD.id);
  let state = placed.state;
  if (top === ENTITY) {
    // The entity as a Cosmic Entity shuffled in: in the encounter deck, owned, controlled by nobody.
    const given = giveCard(state, P1, ENTITY.id);
    const deckId = activeEncounterDeckId(given.state);
    const piles = given.state.encounterDecks[deckId]!;
    state = {
      ...given.state,
      players: given.state.players.map((p) => ({ ...p, hand: p.hand.filter((id) => id !== given.id) })),
      encounterDecks: { ...given.state.encounterDecks, [deckId]: { ...piles, deck: [given.id, ...piles.deck] } },
      instances: {
        ...given.state.instances,
        [given.id]: {
          ...mustInstance(given.state, given.id),
          controllerId: null,
          home: { kind: "encounterDeck", deckId } as never,
        },
      },
    };
  } else state = onTopOfEncounterDeck(state, PLAIN.id);
  return { state, sense: placed.id };
}

/** Plays the reveal, recording whether any choice offered Sense's interrupt, and takes it whenever offered. */
function reveal(state: GameState, sense: InstanceId): { offered: boolean; after: GameState } {
  let offered = false;
  const given = giveCard(state, P1, REVEAL.id);
  const pick = (s: GameState): readonly string[] => {
    const option = s.pendingChoice?.options.find((o) => o.ref?.kind === "ability" && o.ref.instanceId === sense);
    if (option) offered = true;
    return option ? [option.optionId] : defaultPick(s);
  };
  const { session } = driveSession(
    startSession(given.state),
    deps,
    [{ type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null }],
    pick,
  );
  return { offered, after: session.state };
}

describe("§3.27 a cancel with nothing it can cancel is not offered", () => {
  it("an ordinary treachery: the cancel is offered and its cost paid", () => {
    const { state, sense } = start(PLAIN);
    const { offered, after } = reveal(state, sense);
    expect(offered).toBe(true);
    expect(mustInstance(after, sense).exhausted).toBe(true);
  });

  it("a card that cannot be canceled: the cancel is never offered and nothing is exhausted", () => {
    const { state, sense } = start(ENTITY);
    const { offered, after } = reveal(state, sense);
    expect(offered).toBe(false);
    expect(mustInstance(after, sense).exhausted).toBe(false);
    expect(mustInstance(after, after.activeVillainId).damage).toBe(2);
  });
});
