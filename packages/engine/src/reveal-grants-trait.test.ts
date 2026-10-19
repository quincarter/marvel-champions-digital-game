/**
 * docs/phase7-wave10.md §3.16: "a card is revealed that gives heroes a trait". `EventPattern.grantsTrait` (with
 * `grantedToIs`) on a `cardRevealed` response, the event's `grantedTo`, and `TargetRef grantedTo`. Synthetic cards
 * shaped like
 *
 * - Hunting Rebel Heroes (`cw` 56097b): "Each hero gains the Unregistered trait. Forced Response: After another card
 *   is revealed that gives 1 or more heroes the Unregistered trait, deal 2 damage to each of those heroes." (`hunt`, a
 *   side scheme here);
 * - Government Contractor (`cw` 56120): "Each identity gains the Unregistered trait." (`contractor`).
 *
 * Sources: RRG 1.8 "Reveal" (p. 38): "Responses … to any step of the revealing of an encounter card are not resolved
 * until after all steps of the reveal process have been completed", so the revealed side scheme is in play, its
 * constant ability active (RRG 1.8 "Ability", p. 4), when the response reads what it gives; "Gains" (p. 21). Which
 * heroes "those heroes" are when they already had the trait is the owner's question 12 (docs/phase7-wave10.md §4.1),
 * answered A (provisional): every hero the revealed card's text gives the trait to.
 *
 * The villain has 0 ATK and 0 SCH and every other encounter card is a blank with no boost icon, so the only damage a
 * villain phase deals is the response's.
 */

import { flat, trait, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { activeEncounterDeckId, mustInstance, mustPlayer } from "./query.js";
import { traitGrantReach, traitsOf } from "./select.js";
import type { TargetQuery } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { stubSideScheme, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { defaultPick } from "./testing/scenario.js";
import { copiesOf, encounterCardInVillainArea, gameAtFirstTurn, P1, P2 } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const UNREGISTERED = trait("UNREGISTERED");
const AERIAL = trait("AERIAL");
const heroes: TargetQuery = { categories: ["hero"] };
const identities: TargetQuery = { categories: ["identity"] };

const grants = (id: string, granted: typeof UNREGISTERED, target: TargetQuery): StubAbility =>
  stubAbility(id, def({ trigger: { kind: "constant", traitGrants: [{ trait: granted, target }] }, effects: [] }));

const HUNT_CONSTANT = grants("hunt.constant", UNREGISTERED, heroes);
const HUNT_RESPONSE = stubAbility(
  "hunt.response",
  def({
    trigger: {
      kind: "response",
      forced: true,
      on: { on: "cardRevealed", targetIs: { self: false }, grantsTrait: UNREGISTERED, grantedToIs: heroes },
    },
    effects: [
      {
        kind: "dealDamage",
        target: { kind: "grantedTo", trait: UNREGISTERED, filter: heroes },
        amount: { kind: "const", value: 2 },
      },
    ],
  }),
);
const CONTRACTOR_CONSTANT = grants("contractor.constant", UNREGISTERED, identities);
const FLYERS_CONSTANT = grants("flyers.constant", AERIAL, identities);
const MUSTER_CONSTANT = grants("muster.constant", UNREGISTERED, { categories: ["minion"] });

const scheme = (id: string, ...abilities: readonly StubAbility[]) =>
  stubSideScheme({ id, startingThreat: 3, boostIcons: 0, abilities: abilities.map((a) => a.ref) });
const HUNT = scheme("hunt", HUNT_CONSTANT, HUNT_RESPONSE);
const CONTRACTOR = scheme("contractor", CONTRACTOR_CONSTANT);
/** "Each identity gains the Aerial trait." */
const FLYERS = scheme("flyers", FLYERS_CONSTANT);
/** "Each minion gains the Unregistered trait.": no minion is in play, so it gives the trait to no card. */
const MUSTER = scheme("muster", MUSTER_CONSTANT);
const PLAIN = scheme("plain");
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const MEEK = stubVillain({ id: "meek", stages: [{ hp: flat(30), atk: 0, sch: 0 }] });

const deps: EngineDeps = depsOf(HUNT_CONSTANT, HUNT_RESPONSE, CONTRACTOR_CONSTANT, FLYERS_CONSTANT, MUSTER_CONSTANT);
/** The same cards in a registry where no ability asks what a revealed card grants. */
const unasked: EngineDeps = depsOf(HUNT_CONSTANT, CONTRACTOR_CONSTANT);
const CARDS = [HUNT, CONTRACTOR, FLYERS, MUSTER, PLAIN, BLANK];

interface Table {
  readonly state: GameState;
  readonly identities: readonly [InstanceId, InstanceId];
}

/**
 * Two players, each in the form given; `hunt` in the villain's area unless it is the card revealed. The villain phase
 * takes one boost card for each player's activation and then deals player 1 `revealed`, player 2 a blank.
 */
function table(forms: readonly ["hero" | "alterEgo", "hero" | "alterEgo"], revealed: CardId, using = deps): Table {
  const base = gameAtFirstTurn({
    cards: CARDS,
    deps: using,
    players: 2,
    villain: MEEK,
    encounter: [HUNT.id, CONTRACTOR.id, FLYERS.id, MUSTER.id, PLAIN.id, ...copiesOf(BLANK.id, 16)],
  });
  let state: GameState = {
    ...base,
    players: base.players.map((p, seat) => ({ ...p, identity: { ...p.identity, form: forms[seat]! } })),
  };
  if (revealed !== HUNT.id) state = encounterCardInVillainArea(state, HUNT.id).state;
  // Third from the top, behind the two boost cards; everything else in the deck is a blank.
  const deckId = activeEncounterDeckId(state);
  const piles = state.encounterDecks[deckId]!;
  const isBlank = (id: InstanceId) => mustInstance(state, id).cardId === BLANK.id;
  const wanted = piles.deck.find((id) => mustInstance(state, id).cardId === revealed)!;
  const blanks = piles.deck.filter(isBlank);
  state = {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [deckId]: { ...piles, deck: [...blanks.slice(0, 2), wanted, ...blanks.slice(2)] },
    },
  };
  const identity = (player: PlayerId) => mustPlayer(state, player).identity.instanceId;
  return { state, identities: [identity(P1), identity(P2)] };
}

const undefended = (state: GameState): readonly string[] =>
  state.pendingChoice?.prompt.kind === "declareDefender" ? ["decline"] : defaultPick(state);
const endTurns: readonly Command[] = [
  { type: "endTurn", playerId: P1 },
  { type: "endTurn", playerId: P2 },
];
const villainPhase = (t: Table, using = deps) => runCommandsPicking(t.state, using, undefended, ...endTurns);

const damage = (state: GameState, t: Table) => t.identities.map((id) => mustInstance(state, id).damage);
const responses = (events: readonly GameEvent[]) =>
  events.filter((e) => e.type === "abilityResolved" && e.abilityId === HUNT_RESPONSE.ref.id).length;
const revealedAs = (events: readonly GameEvent[], card: InstanceId) =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.event.kind === "cardRevealed" && e.event.instanceId === card ? [e.event] : [],
  );
const inPlayAs = (state: GameState, card: CardId): InstanceId =>
  Object.values(state.instances).find((i) => i.cardId === card)!.instanceId;

describe("§3.16 a card is revealed that gives heroes a trait", () => {
  it("question 12 = A: both heroes already had the trait, and each of those heroes is dealt 2 damage", () => {
    const t = table(["hero", "hero"], CONTRACTOR.id);
    // Before the reveal each hero already has the trait, from the card that asks.
    expect(t.identities.map((id) => traitsOf(t.state, id, deps).includes(UNREGISTERED))).toEqual([true, true]);
    const { state, events, session } = villainPhase(t);
    expect(damage(state, t)).toEqual([2, 2]);
    expect(responses(events)).toBe(1);
    const contractor = inPlayAs(state, CONTRACTOR.id);
    expect(state.villainArea).toContain(contractor);
    const [revealed] = revealedAs(events, contractor);
    expect(revealed).toEqual({
      kind: "cardRevealed",
      instanceId: contractor,
      playerId: P1,
      grantedTo: { [UNREGISTERED]: [...t.identities] },
      // Dealt from the encounter deck in the villain phase (docs/phase7-wave11-scenarios.md §S3.10).
      from: "encounterDeck",
    });
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("'each of those heroes': an identity in alter-ego form is given the trait and is not dealt damage", () => {
    const t = table(["alterEgo", "hero"], CONTRACTOR.id);
    const { state, events } = villainPhase(t);
    expect(damage(state, t)).toEqual([0, 2]);
    expect(responses(events)).toBe(1);
    // The grant itself reaches both identities (listed in play order, which follows the first player).
    const reach = traitGrantReach(state, deps, inPlayAs(state, CONTRACTOR.id));
    expect(Object.keys(reach)).toEqual([UNREGISTERED]);
    expect([...reach[UNREGISTERED]!].sort()).toEqual([...t.identities].sort());
  });

  it("'1 or more heroes': with every identity in alter-ego form the response does not trigger", () => {
    const t = table(["alterEgo", "alterEgo"], CONTRACTOR.id);
    const { state, events } = villainPhase(t);
    expect(damage(state, t)).toEqual([0, 0]);
    expect(responses(events)).toBe(0);
    expect(state.villainArea).toContain(inPlayAs(state, CONTRACTOR.id));
  });

  it("a card that gives another trait, gives the trait to no card, or gives nothing does not trigger it", () => {
    for (const card of [FLYERS.id, MUSTER.id, PLAIN.id]) {
      const t = table(["hero", "hero"], card);
      const { state, events } = villainPhase(t);
      expect(damage(state, t)).toEqual([0, 0]);
      expect(responses(events)).toBe(0);
      expect(state.villainArea).toContain(inPlayAs(state, card));
    }
  });

  it("'another card': the card's own reveal gives each hero the trait and deals no damage", () => {
    const t = table(["hero", "hero"], HUNT.id);
    const { state, events } = villainPhase(t);
    const hunt = inPlayAs(state, HUNT.id);
    expect(state.villainArea).toContain(hunt);
    expect(t.identities.map((id) => traitsOf(state, id, deps).includes(UNREGISTERED))).toEqual([true, true]);
    expect(damage(state, t)).toEqual([0, 0]);
    expect(responses(events)).toBe(0);
  });

  it("what a card gives is read only while its constant abilities are: not from the encounter deck", () => {
    const t = table(["hero", "hero"], CONTRACTOR.id);
    const contractor = inPlayAs(t.state, CONTRACTOR.id);
    expect(traitGrantReach(t.state, deps, contractor)).toEqual({});
    expect(traitGrantReach(t.state, deps, inPlayAs(t.state, HUNT.id))).toEqual({ [UNREGISTERED]: [...t.identities] });
  });

  it("a game in which no ability asks keeps its reveal event as it was", () => {
    const t = table(["hero", "hero"], CONTRACTOR.id, unasked);
    const { state, session } = villainPhase(t, unasked);
    expect(damage(state, t)).toEqual([0, 0]);
    expect(JSON.stringify(session.log)).not.toContain("grantedTo");
    expect(JSON.stringify(state)).not.toContain("grantedTo");
  });
});
