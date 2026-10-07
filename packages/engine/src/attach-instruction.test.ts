/**
 * docs/phase7-wave7.md §3.35: `AbilityDefinition.attachInstruction`, an attachment's "attach to" text when the host
 * depends on a condition ("If [a named card] is in play, attach to [one character]. Otherwise, attach to your
 * identity."). It resolves at the reveal's attach step (RRG 1.8 "Reveal", p. 38, step 2), before the card's When
 * Revealed abilities; a cancel of the card's "When Revealed" effects does not stop it, a cancel of all its effects
 * does (RRG 1.8 "Cancel", p. 13), and a card it leaves unattached is handled as an attachment with no legal data host
 * is (RRG 1.8 "Attach To", p. 8). Proven with synthetic cards.
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { activeEncounterDeck, characterProfile, mustInstance, mustPlayer } from "./query.js";
import { cardsInPlay } from "./select.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession, runCommands } from "./testing/drive.js";
import { stubAttachment, stubEnvironment, stubEvent, stubMinion, stubSupport } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  minionEngagedWith,
  onTopOfEncounterDeck,
  P1,
  P2,
  playerCardIntoPlay,
} from "./testing/wave3.js";

const self = { kind: "self" } as const;
const yourIdentity = { kind: "identityOf", player: { kind: "controller" } } as const;

/** The named card whose presence decides the host. */
const GRASP = stubEnvironment({ id: "grasp", name: "The Grasp" });
/** The character the card attaches to while The Grasp is in play (a stub minion's name is its id). */
const HOST = stubMinion({ id: "the-host", atk: 1, sch: 0, hp: 9, boostIcons: 0 });

/** "If The Grasp is in play, attach to the-host. Otherwise, attach to your identity." */
const ATTACH_EFFECTS: readonly EffectSpec[] = [
  {
    kind: "if",
    condition: { kind: "exists", query: { name: "The Grasp" } },
    then: [{ kind: "attach", card: self, to: { kind: "named", name: HOST.name } }],
    otherwise: [{ kind: "attach", card: self, to: yourIdentity }],
  },
];
const INSTRUCTION = stubAbility("transfer.attach", {
  trigger: { kind: "whenRevealed" },
  attachInstruction: true,
  effects: ATTACH_EFFECTS,
});
/** A real When Revealed on the same card: "When Revealed: Deal 2 damage to attached character." */
const REVEALED = stubAbility("transfer.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [{ kind: "dealDamage", target: { kind: "host" }, amount: { kind: "const", value: 2 } }],
});
const TRANSFER = stubAttachment({
  id: "transfer",
  statModifiers: { atk: 1 },
  abilities: [INSTRUCTION.ref, REVEALED.ref],
});

/** The same sentence with "If you cannot, attach this card to the villain." after it. */
const FALLBACK_INSTRUCTION = stubAbility("fallback.attach", {
  trigger: { kind: "whenRevealed" },
  attachInstruction: true,
  effects: ATTACH_EFFECTS,
});
const FALLBACK = stubAbility("fallback.cannot-attach", {
  trigger: { kind: "cannotAttach" },
  effects: [{ kind: "attach", card: self, to: { kind: "villain" } }],
});
const FALLS_BACK = stubAttachment({ id: "falls-back", abilities: [FALLBACK_INSTRUCTION.ref, FALLBACK.ref] });

/** "Interrupt: When an encounter card is revealed, cancel its 'When Revealed' effects." */
const SENSE = stubAbility("sense.interrupt", {
  trigger: { kind: "interrupt", forced: false, on: { on: "encounterCardRevealing" } },
  effects: [{ kind: "cancelWhenRevealed" }],
});
const SENSE_CARD = stubSupport({ id: "sense", cost: 0, abilities: [SENSE.ref] });
/** "Interrupt: When an encounter card is revealed, cancel the effects of that card and discard it." */
const WIDOW = stubAbility("widow.interrupt", {
  trigger: { kind: "interrupt", forced: false, on: { on: "encounterCardRevealing" } },
  effects: [{ kind: "cancelRevealedCard" }],
});
const WIDOW_CARD = stubSupport({ id: "widow", cost: 0, abilities: [WIDOW.ref] });

const REVEAL_ACTION = stubAbility("reveal.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "revealEncounterCard", player: { kind: "controller" } }],
});
const REVEAL = stubEvent({ id: "reveal", cost: 0, abilities: [REVEAL_ACTION.ref] });
/** "Resolve each 'When Revealed' ability on each attachment in play." */
const AGAIN_ACTION = stubAbility("again.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "resolveSpecials", cards: { name: TRANSFER.name }, trigger: "whenRevealed" }],
});
const AGAIN = stubEvent({ id: "again", cost: 0, abilities: [AGAIN_ACTION.ref] });

const deps: EngineDeps = depsOf(
  INSTRUCTION,
  REVEALED,
  FALLBACK_INSTRUCTION,
  FALLBACK,
  SENSE,
  WIDOW,
  REVEAL_ACTION,
  AGAIN_ACTION,
);

function game(players: 1 | 2 = 1): GameState {
  return gameAtFirstTurn({
    cards: [GRASP, HOST, TRANSFER, FALLS_BACK, SENSE_CARD, WIDOW_CARD, REVEAL, AGAIN],
    deps,
    players,
    encounter: [GRASP.id, HOST.id, TRANSFER.id, FALLS_BACK.id, ...copiesOf("treachery" as CardId, 12)],
    deck: [SENSE_CARD.id, WIDOW_CARD.id, AGAIN.id, ...copiesOf(REVEAL.id, 3)],
  });
}

const identityOf = (state: GameState, player: PlayerId): InstanceId => mustPlayer(state, player).identity.instanceId;
const find = (state: GameState, card: CardId): InstanceId => {
  const id = Object.keys(state.instances).find((key) => state.instances[key]?.cardId === card);
  if (!id) throw new Error(`no ${card}`);
  return id as InstanceId;
};

/** `player` plays an event that has them reveal the top card of the encounter deck; `use` is taken when offered. */
function reveal(
  state: GameState,
  card: CardId,
  player: PlayerId = P1,
  use?: InstanceId,
): { readonly after: GameState; readonly events: readonly GameEvent[] } {
  const given = giveCard(onTopOfEncounterDeck(state, card), player, REVEAL.id);
  const pick = (s: GameState): readonly string[] => {
    const option = s.pendingChoice?.options.find((o) => o.ref?.kind === "ability" && o.ref.instanceId === use);
    return option ? [option.optionId] : defaultPick(s);
  };
  const { session, events } = driveSession(
    startSession(given.state),
    deps,
    [{ type: "playCard", playerId: player, cardInstanceId: given.id, payment: [], attachToInstanceId: null }],
    pick,
  );
  return { after: session.state, events };
}

/** The Grasp and the host character are both in play. */
function withGraspAndHost(state: GameState): { readonly state: GameState; readonly host: InstanceId } {
  const grasp = encounterCardInVillainArea(state, GRASP.id);
  const host = minionEngagedWith(grasp.state, HOST.id);
  return { state: host.state, host: host.id };
}

describe("§3.35 an attach instruction ability picks the host at the reveal's attach step", () => {
  it("with the named card in play, it attaches to the first host, and its When Revealed then resolves on that host", () => {
    const start = withGraspAndHost(game());
    const card = find(start.state, TRANSFER.id);
    const { after } = reveal(start.state, TRANSFER.id);

    expect(mustInstance(after, card).attachedTo).toBe(start.host);
    expect(mustInstance(after, start.host).attachments).toEqual([card]);
    expect(cardsInPlay(after)).toContain(card);
    // The real When Revealed found the host: the card was attached before it resolved.
    expect(mustInstance(after, start.host).damage).toBe(2);
    expect(mustInstance(after, identityOf(after, P1)).damage).toBe(0);
  });

  it("without the named card, it attaches to the revealing player's identity although the first host is in play", () => {
    const base = game();
    const host = minionEngagedWith(base, HOST.id);
    const card = find(host.state, TRANSFER.id);
    const { after } = reveal(host.state, TRANSFER.id);

    expect(mustInstance(after, card).attachedTo).toBe(identityOf(after, P1));
    expect(mustInstance(after, host.id).attachments).toEqual([]);
    expect(mustInstance(after, identityOf(after, P1)).damage).toBe(2);
    expect(mustInstance(after, host.id).damage).toBe(0);
  });

  it("the attachment's constant modifier applies to the chosen host as soon as it is attached", () => {
    const start = withGraspAndHost(game());
    expect(characterProfile(start.state, start.host, deps)?.atk).toBe(1);
    const { after } = reveal(start.state, TRANSFER.id);
    expect(characterProfile(after, start.host, deps)?.atk).toBe(2);
  });

  it("the log shows the reveal, then the card moving onto its host", () => {
    const start = withGraspAndHost(game());
    const card = find(start.state, TRANSFER.id);
    const { events } = reveal(start.state, TRANSFER.id);

    const revealed = events.findIndex((e) => e.type === "encounterCardRevealed" && e.instanceId === card);
    const attached = events.findIndex(
      (e) =>
        e.type === "cardMoved" &&
        e.instanceId === card &&
        e.to.kind === "attachment" &&
        e.to.hostInstanceId === start.host,
    );
    const damaged = events.findIndex((e) => e.type === "damageDealt" && e.targetInstanceId === start.host);
    expect(revealed).toBeGreaterThanOrEqual(0);
    expect(attached).toBeGreaterThan(revealed);
    expect(damaged).toBeGreaterThan(attached);
  });

  it("in a 2-player game 'your identity' is the revealing player's, not the first player's", () => {
    const base = game(2);
    const { state: secondTurn } = runCommands(base, deps, { type: "endTurn", playerId: P1 });
    expect(secondTurn.step).toMatchObject({ kind: "turn", activePlayerId: P2 });
    const card = find(secondTurn, TRANSFER.id);
    const { after } = reveal(secondTurn, TRANSFER.id, P2);

    expect(mustInstance(after, card).attachedTo).toBe(identityOf(after, P2));
    expect(mustInstance(after, identityOf(after, P1)).attachments).toEqual([]);
    expect(mustInstance(after, identityOf(after, P2)).damage).toBe(2);
  });
});

describe("§3.35 an attach instruction and cancels", () => {
  it("a When Revealed cancel leaves the card attached and cancels only its real When Revealed", () => {
    const placed = playerCardIntoPlay(game(), SENSE_CARD.id);
    const start = withGraspAndHost(placed.state);
    const card = find(start.state, TRANSFER.id);
    const { after, events } = reveal(start.state, TRANSFER.id, P1, placed.id);

    expect(events).toContainEqual({ type: "revealCancelled", instanceId: card, scope: "whenRevealed" });
    expect(mustInstance(after, card).attachedTo).toBe(start.host);
    expect(cardsInPlay(after)).toContain(card);
    expect(characterProfile(after, start.host, deps)?.atk).toBe(2);
    expect(mustInstance(after, start.host).damage).toBe(0);
  });

  it("a cancel of all the card's effects discards it unattached: the instruction never resolves", () => {
    const placed = playerCardIntoPlay(game(), WIDOW_CARD.id);
    const start = withGraspAndHost(placed.state);
    const card = find(start.state, TRANSFER.id);
    const { after, events } = reveal(start.state, TRANSFER.id, P1, placed.id);

    expect(events).toContainEqual({ type: "revealCancelled", instanceId: card, scope: "allEffects" });
    expect(mustInstance(after, card).attachedTo).toBeNull();
    expect(mustInstance(after, start.host).attachments).toEqual([]);
    expect(mustInstance(after, start.host).damage).toBe(0);
    expect(activeEncounterDeck(after).discard).toContain(card);
    expect(events.some((e) => e.type === "cardMoved" && e.instanceId === card && e.to.kind === "attachment")).toBe(
      false,
    );
  });
});

describe("§3.35 an attach instruction that yields no legal host", () => {
  it("is discarded, as an attachment with no legal data host is (RRG 1.8 'Attach To', p. 8), with no replacement card", () => {
    // The Grasp is in play but the character it names is not.
    const grasp = encounterCardInVillainArea(game(), GRASP.id);
    const card = find(grasp.state, TRANSFER.id);
    const { after, events } = reveal(grasp.state, TRANSFER.id);

    expect(mustInstance(after, card).attachedTo).toBeNull();
    expect(cardsInPlay(after)).not.toContain(card);
    expect(activeEncounterDeck(after).discard).toContain(card);
    expect(mustInstance(after, identityOf(after, P1)).attachments).toEqual([]);
    expect(events.filter((e) => e.type === "encounterCardRevealed")).toHaveLength(1);
  });

  it("resolves the card's own cannotAttach abilities in place of the discard, as a data host does", () => {
    const grasp = encounterCardInVillainArea(game(), GRASP.id);
    const card = find(grasp.state, FALLS_BACK.id);
    const { after } = reveal(grasp.state, FALLS_BACK.id);

    expect(mustInstance(after, card).attachedTo).toBe(after.villains[0]!.instanceId);
    expect(cardsInPlay(after)).toContain(card);
    expect(activeEncounterDeck(after).discard).not.toContain(card);
  });
});

describe("§3.35 an attach instruction is not a When Revealed ability", () => {
  it("flipped as a boost card, the card is discarded without running the instruction", () => {
    const base = game();
    const card = find(base, TRANSFER.id);
    const { state, events } = runCommands(onTopOfEncounterDeck(base, TRANSFER.id), deps, {
      type: "endTurn",
      playerId: P1,
    });

    expect(events.some((e) => e.type === "boostCardDealt" && e.instanceId === card)).toBe(true);
    expect(events.some((e) => e.type === "encounterCardRevealed" && e.instanceId === card)).toBe(false);
    expect(events.some((e) => e.type === "cardMoved" && e.instanceId === card && e.to.kind === "attachment")).toBe(
      false,
    );
    expect(mustInstance(state, card).attachedTo).toBeNull();
    expect(activeEncounterDeck(state).discard).toContain(card);
    expect(mustInstance(state, identityOf(state, P1)).attachments).toEqual([]);
  });

  it("'resolve its When Revealed ability' resolves the real one only and does not move the card", () => {
    const start = withGraspAndHost(game());
    const card = find(start.state, TRANSFER.id);
    const attached = reveal(start.state, TRANSFER.id).after;
    // The Grasp leaves play: the instruction, resolved again, would move the card to the identity.
    const grasp = find(attached, GRASP.id);
    const without: GameState = { ...attached, villainArea: attached.villainArea.filter((id) => id !== grasp) };
    const given = giveCard(without, P1, AGAIN.id);
    const { state: after } = runCommands(given.state, deps, {
      type: "playCard",
      playerId: P1,
      cardInstanceId: given.id,
      payment: [],
      attachToInstanceId: null,
    });

    expect(mustInstance(after, card).attachedTo).toBe(start.host);
    expect(mustInstance(after, start.host).damage).toBe(4);
  });

  it.todo(
    "put into play without a reveal (putIntoPlay, Setup): enterPlayOnReveal is synchronous and discards a card with no data host; the instruction is not run there",
  );
});
