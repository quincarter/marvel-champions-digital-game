/**
 * `encounterCardResolved`: "After you resolve a treachery" (Spider-Man Noir, `spdr` 31015).
 *
 * Sources: RRG 1.8 "Resolve" (p. 37: "A treachery card is resolved when it is revealed and one or more of its abilities
 * resolve"), "Reveal" (p. 38: step 3 resolves When Revealed abilities "including those provided by keywords", step 4
 * discards a treachery), "Surge" (p. 42: responses to the original card before the additional card is revealed),
 * "Cancel" (p. 11); FAQ "Spider-Man Noir (#15)" (p. 63: "If no part of the treachery card resolves, he cannot attach
 * it").
 */

import { describe, expect, it } from "vitest";
import type { CardId } from "@mc/content";
import type { EngineDeps } from "./abilities.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { activeEncounterDeck, locateCard, mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { stubEvent, stubMinion, stubSupport, stubTreachery } from "./testing/fixtures.js";
import { defaultPick, giveCard, TREACHERY } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, onTopOfEncounterDeck, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const treachery = (id: string, effects: readonly EffectSpec[] | null, surge = false) => {
  const ability = effects ? stubAbility(`${id}.when-revealed`, { trigger: { kind: "whenRevealed" }, effects }) : null;
  const card = stubTreachery({
    id,
    boostIcons: 0,
    abilities: ability ? [ability.ref] : [],
    keywords: surge ? [{ name: "surge" }] : [],
  });
  return { card, abilities: ability ? [ability] : [] };
};

// "When Revealed: draw 1 card" — an ability that resolves.
const DRAWS = treachery("draws", [
  { kind: "draw", player: { kind: "controller" }, amount: { kind: "const", value: 1 } },
]);
// Surge and nothing else: its keyword ability is the part that resolves.
const SURGE_ONLY = treachery("surge-only", null, true);
// No ability and no keyword: nothing on it can resolve.
const BLANK = treachery("blank", null);
const MINION_WR = stubAbility("minion.when-revealed", { trigger: { kind: "whenRevealed" }, effects: [] });
const MINION = stubMinion({ id: "minion", atk: 1, sch: 1, hp: 3, boostIcons: 0, abilities: [MINION_WR.ref] });

/** "Response: After you resolve a treachery, attach that treachery facedown here." */
const LISTEN = stubAbility("listener.response", {
  trigger: {
    kind: "response",
    forced: false,
    on: { on: "encounterCardResolved", playerIs: "controller", targetIs: { categories: ["treachery"] } },
  },
  effects: [{ kind: "attach", card: { kind: "eventTarget" }, to: { kind: "self" }, facedown: true }],
});
const LISTENER = stubSupport({ id: "listener", cost: 0, abilities: [LISTEN.ref] });

/** "Hero Interrupt: When you reveal a card from the encounter deck, … cancel the effects of that card" (30005's shape). */
const CANCEL_ALL = stubAbility("cancel-all.interrupt", {
  trigger: { kind: "interrupt", forced: false, on: { on: "encounterCardRevealing" } },
  effects: [{ kind: "cancelRevealedCard" }],
});
const CANCEL_ALL_CARD = stubSupport({ id: "cancel-all", cost: 0, abilities: [CANCEL_ALL.ref] });
const CANCEL_WR = stubAbility("cancel-wr.interrupt", {
  trigger: { kind: "interrupt", forced: false, on: { on: "encounterCardRevealing" } },
  effects: [{ kind: "cancelWhenRevealed" }],
});
const CANCEL_WR_CARD = stubSupport({ id: "cancel-wr", cost: 0, abilities: [CANCEL_WR.ref] });

const REVEAL = stubAbility("reveal.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "revealEncounterCard", player: { kind: "controller" } }],
});
const REVEAL_CARD = stubEvent({ id: "reveal", cost: 0, abilities: [REVEAL.ref] });

const deps: EngineDeps = depsOf(...DRAWS.abilities, MINION_WR, LISTEN, CANCEL_ALL, CANCEL_WR, REVEAL);
const CARDS = [DRAWS.card, SURGE_ONLY.card, BLANK.card, MINION, LISTENER, CANCEL_ALL_CARD, CANCEL_WR_CARD, REVEAL_CARD];

/** Accepts every optional trigger offered (`chooseTriggers`); otherwise the default pick. */
const accept = (state: GameState): readonly string[] => {
  const choice = state.pendingChoice;
  if (choice?.prompt.kind === "chooseTriggers") return choice.options.map((o) => o.optionId);
  return defaultPick(state);
};
/** Accepts only the cancel interrupts; declines the listener. */
const acceptOnlyCancels = (state: GameState): readonly string[] => {
  const choice = state.pendingChoice;
  if (choice?.prompt.kind === "chooseTriggers")
    return choice.options.filter((o) => o.optionId.includes("cancel-")).map((o) => o.optionId);
  return defaultPick(state);
};

interface Staged {
  readonly state: GameState;
  readonly listener: InstanceId;
}

function staged(top: CardId, opts: { listenerOf?: typeof P1; with?: readonly CardId[]; players?: 1 | 2 } = {}): Staged {
  const base = gameAtFirstTurn({
    cards: CARDS,
    deps,
    players: opts.players ?? 1,
    encounter: [DRAWS.card.id, SURGE_ONLY.card.id, BLANK.card.id, MINION.id, ...copiesOf(TREACHERY.id, 10)],
    deck: [REVEAL_CARD.id, LISTENER.id, CANCEL_ALL_CARD.id, CANCEL_WR_CARD.id],
  });
  const withListener = playerCardIntoPlay(base, LISTENER.id, opts.listenerOf ?? P1);
  let state = withListener.state;
  for (const extra of opts.with ?? []) state = playerCardIntoPlay(state, extra, P1).state;
  return { state: onTopOfEncounterDeck(state, top), listener: withListener.id };
}

function reveal(s: Staged, pick = accept) {
  const given = giveCard(s.state, P1, REVEAL_CARD.id);
  return runCommandsPicking(given.state, deps, pick, {
    type: "playCard",
    playerId: P1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  });
}

const revealedId = (state: GameState, card: CardId): InstanceId =>
  Object.values(state.instances).find((i) => i.cardId === card)!.instanceId;
const announced = (events: readonly GameEvent[]) =>
  events.filter(
    (e): e is Extract<GameEvent, { type: "triggerEvent" }> =>
      e.type === "triggerEvent" && e.event.kind === "encounterCardResolved",
  );

describe("encounterCardResolved (RRG 1.8 'Resolve', p. 37)", () => {
  it("a revealed treachery whose When Revealed resolved is announced from the encounter discard pile, and a response can attach it facedown", () => {
    const s = staged(DRAWS.card.id);
    const { state, events } = reveal(s);
    const id = revealedId(state, DRAWS.card.id);
    const [event] = announced(events);
    expect(event?.event).toMatchObject({ kind: "encounterCardResolved", instanceId: id, playerId: P1 });
    expect(event?.event).toMatchObject({ to: "encounterDiscard" });
    // The response took it out of the discard pile and attached it facedown.
    expect(locateCard(state, id)).toEqual({ kind: "attachment", hostInstanceId: s.listener });
    expect(mustInstance(state, id).facedownAs).toEqual({ kind: "blank", traits: [] });
    expect(mustInstance(state, s.listener).attachments).toEqual([id]);
    expect(activeEncounterDeck(state).discard).not.toContain(id);
  });

  it("declining the response leaves the treachery in the encounter discard pile", () => {
    const s = staged(DRAWS.card.id);
    const { state, events } = reveal(s, defaultPick);
    const id = revealedId(state, DRAWS.card.id);
    expect(announced(events)).toHaveLength(1);
    expect(activeEncounterDeck(state).discard).toContain(id);
    expect(mustInstance(state, s.listener).attachments).toEqual([]);
  });

  // Q22: the surge's card is dealt facedown and not revealed here. The deal is the surge's When Revealed, in reveal
  // step 3, so the response to the resolved treachery comes after it (RRG v1.8 p.42, p.38; owner decision 2026-10-16
  // (audit finding 16); this test had the response first until then).
  it("a keyword counts: a treachery with only surge resolved, and its response runs after the surge card is dealt (RRG 1.8 'Surge', p. 42)", () => {
    const s = staged(SURGE_ONLY.card.id);
    const { state, events } = reveal(s);
    const id = revealedId(state, SURGE_ONLY.card.id);
    expect(locateCard(state, id)).toEqual({ kind: "attachment", hostInstanceId: s.listener });
    const attachedAt = events.findIndex(
      (e) => e.type === "cardMoved" && e.instanceId === id && e.to.kind === "attachment",
    );
    const surgeDealtAt = events.findIndex((e) => e.type === "surgeTriggered");
    expect(attachedAt).toBeGreaterThan(-1);
    expect(surgeDealtAt).toBeGreaterThan(-1);
    expect(attachedAt).toBeGreaterThan(surgeDealtAt);
    expect(events.filter((e) => e.type === "encounterCardRevealed")).toHaveLength(1);
    expect(mustPlayer(state, P1).dealtEncounter).toHaveLength(1);
  });

  it("a treachery with no ability and no keyword has not resolved: nothing is announced", () => {
    const s = staged(BLANK.card.id);
    const { state, events } = reveal(s);
    expect(announced(events)).toHaveLength(0);
    expect(activeEncounterDeck(state).discard).toContain(revealedId(state, BLANK.card.id));
  });

  it("a treachery whose effects were cancelled has not resolved (RRG 1.8 'Cancel', p. 11; FAQ 'Spider-Man Noir (#15)', p. 63)", () => {
    const s = staged(DRAWS.card.id, { with: [CANCEL_ALL_CARD.id] });
    const { state, events } = reveal(s, accept);
    expect(events.some((e) => e.type === "revealCancelled")).toBe(true);
    expect(announced(events)).toHaveLength(0);
    expect(activeEncounterDeck(state).discard).toContain(revealedId(state, DRAWS.card.id));
    expect(mustInstance(state, s.listener).attachments).toEqual([]);
  });

  it("a treachery whose only ability was its cancelled When Revealed has not resolved", () => {
    const s = staged(DRAWS.card.id, { with: [CANCEL_WR_CARD.id] });
    const { events } = reveal(s, acceptOnlyCancels);
    expect(events.some((e) => e.type === "revealCancelled")).toBe(true);
    expect(announced(events)).toHaveLength(0);
  });

  it("another player's reveal does not trigger 'after *you* resolve'", () => {
    const s = staged(DRAWS.card.id, { players: 2, listenerOf: P2 });
    const { state, events } = reveal(s);
    const id = revealedId(state, DRAWS.card.id);
    // Nobody listens for P1's resolution, so nothing is announced at all, and the card stays discarded.
    expect(announced(events)).toHaveLength(0);
    expect(activeEncounterDeck(state).discard).toContain(id);
    expect(mustInstance(state, s.listener).attachments).toEqual([]);
  });

  it("a non-treachery encounter card is never 'resolved' (RRG 1.8 'Resolve', p. 37)", () => {
    const s = staged(MINION.id);
    const { state, events } = reveal(s);
    expect(announced(events)).toHaveLength(0);
    expect(mustInstance(state, s.listener).attachments).toEqual([]);
  });
});

/**
 * RRG 1.8 Appendix IV FAQ, "Spider-Man Noir (#15)" (p. 63): "Q: If a treachery's 'When Revealed' ability is canceled,
 * can Spider-Man Noir attach that treachery to himself? A: In order for Spider-Man Noir's response to trigger, some
 * part of the treachery card must be resolved. If the treachery card has a keyword on it that is resolved when the card
 * is revealed, like surge or incite X, Spider-Man Noir can trigger his response to attach that card to himself."
 * The engine drops surge (and incite) whenever the When Revealed ability is cancelled (resolve/reveal.ts `surgeLive`,
 * and the early return after "Incite and surge are 'When Revealed' effects too"). FFG ruling August 3, 2026 (3) (after
 * RRG 1.8) says Enhanced Spider-Sense can cancel surge, which is a different cancel; it does not overrule the FAQ.
 * INTERPRETATION proof, not a settled bug: the FAQ and that ruling pull in different directions.
 */
describe("a treachery with Surge whose printed When Revealed is cancelled (FAQ 'Spider-Man Noir (#15)', p. 63)", () => {
  // A treachery that prints "Surge." and a When Revealed ability ("draw 1 card").
  const DRAWS_WR = stubAbility("draws-surge.when-revealed", {
    trigger: { kind: "whenRevealed" },
    effects: [{ kind: "draw", player: { kind: "controller" }, amount: { kind: "const", value: 1 } }],
  });
  const SURGING = stubTreachery({
    id: "draws-surge",
    boostIcons: 0,
    abilities: [DRAWS_WR.ref],
    keywords: [{ name: "surge" }],
  });
  const surgeDeps: EngineDeps = depsOf(DRAWS_WR, CANCEL_WR, REVEAL);

  function revealWithWhenRevealedCancelled(top: CardId) {
    const base = gameAtFirstTurn({
      cards: [SURGING, CANCEL_WR_CARD, REVEAL_CARD],
      deps: surgeDeps,
      encounter: [SURGING.id, ...copiesOf(TREACHERY.id, 10)],
      deck: [REVEAL_CARD.id, CANCEL_WR_CARD.id],
    });
    const withCancel = playerCardIntoPlay(base, CANCEL_WR_CARD.id, P1).state;
    const given = giveCard(onTopOfEncounterDeck(withCancel, top), P1, REVEAL_CARD.id);
    return runCommandsPicking(given.state, surgeDeps, acceptOnlyCancels, {
      type: "playCard",
      playerId: P1,
      cardInstanceId: given.id,
      payment: [],
      attachToInstanceId: null,
    });
  }

  const typed = (events: readonly GameEvent[], type: GameEvent["type"]) => events.filter((e) => e.type === type);

  it.fails("a treachery with Surge whose printed When Revealed is cancelled still surges and counts as resolved", () => {
    const { events } = revealWithWhenRevealedCancelled(SURGING.id);
    expect(typed(events, "revealCancelled")).toHaveLength(1);
    // The printed ability did not resolve (the draw never happened) ...
    expect(typed(events, "cardDrawn")).toHaveLength(0);
    // ... but the keyword did: the player is dealt the surge card, and "After you resolve a treachery" is announced.
    expect(typed(events, "surgeTriggered")).toHaveLength(1);
    expect(events.filter((e) => e.type === "triggerEvent" && e.event.kind === "encounterCardResolved")).toHaveLength(1);
  });
});
