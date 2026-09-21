/**
 * The in-game campaign primitives (design §6.1, §11 step 3): reading the frozen campaign log, writing back to it,
 * removing a card face from the campaign, and where a campaign's setup instructions sit inside RRG 1.8 Appendix II.
 *
 * Everything here runs against the **synthetic** campaign in `testing/campaign.ts` and the stub cards in
 * `testing/fixtures.ts`: no published box, scenario or card is named, because none of this is about a box — a real
 * campaign is content (`@mc/cards`), and the engine must never need to know which one it is playing.
 */

import { describe, expect, it } from "vitest";
import { cardId, flat, type AnyCard, type CardId } from "@mc/content";
import { DEFAULT_DEPS } from "./abilities.js";
import { CAMPAIGN_WINDOW_ORDER, type CampaignGameInput, type CampaignLogView } from "./campaign.js";
import type { GameEvent } from "./events.js";
import { playerId, type PlayerId } from "./ids.js";
import { evaluate, resolveValue, type EffectContext } from "./select.js";
import { createGame, type GameSetupConfig } from "./setup.js";
import type { Predicate, ValueSpec } from "./spec.js";
import type { GameState, GameStep } from "./state.js";
import { syntheticCampaignInput, syntheticInstruction, SYNTHETIC_CAMPAIGN_ID } from "./testing/campaign.js";
import { stubAlly, stubMainScheme, stubUpgrade } from "./testing/fixtures.js";
import { runCommands } from "./testing/drive.js";
import { DEFAULT_CARDS, DEFAULT_DECK, HERO, newGame, seatIdentities, VILLAIN } from "./testing/scenario.js";

// --- the synthetic pieces these tests play with -------------------------------------------------------------------

/** The card the synthetic log's `keepsakes` field names. Three copies exist; the log names fewer than that. */
const WARD = stubAlly({ id: "syn-ward", cost: 1, atk: 1, thw: 1, hp: 1, resources: 1 });

/**
 * A card that starts in play (RRG Appendix II step 11) and has a second face, so a removal has a face to record.
 * Both halves matter: ruling April 30, 2026 (4) answer 2 is precisely about the *other* face staying available.
 */
const RELIC = {
  ...stubUpgrade({ id: "syn-relic-a", cost: 0, keywords: [{ name: "setup" }] }),
  flipSide: {
    name: "Improved Relic",
    traits: [],
    keywords: [],
    text: { printed: "", current: "" },
    abilities: [],
  },
} satisfies AnyCard;

const SCHEME = stubMainScheme({
  id: "syn-scheme",
  stages: [{ startingThreat: flat(2), targetThreat: flat(40), acceleration: flat(0) }],
});

const P1 = playerId("p1");
const P2 = playerId("p2");

/**
 * The log this game reads, as the runner froze it.
 *
 * The seat numbers are **7 and 9**, not 1 and 2: MC10 p. 17's "player number" is the campaign log's own numbering,
 * so a per-seat read has to go through `CampaignGameInput.seats` rather than assume the table order.
 */
const LOG: CampaignLogView = {
  shared: {
    errands: { kind: "strikeList", struck: ["north", "south"] },
    warden: { kind: "choice", option: "warden-one" },
    favors: { kind: "instructionList", ids: ["syn.favor.ward"] },
  },
  perSeat: [
    { seatNumber: 7, fields: { stamina: { kind: "number", value: 4 }, keepsakes: wardList(2) } },
    { seatNumber: 9, fields: { stamina: { kind: "number", value: 1 }, keepsakes: wardList(0) } },
  ],
};

/** A `cardList` naming the ward `count` times — duplicates are legal (ruling June 2, 2026 (3) answer 3). */
function wardList(count: number): { readonly kind: "cardList"; readonly cardIds: readonly CardId[] } {
  return { kind: "cardList", cardIds: Array.from({ length: count }, () => cardId("syn-ward")) };
}

const seatsFor = (players: number): CampaignGameInput["seats"] =>
  [7, 9].slice(0, players).map((seatNumber, index) => ({
    seatNumber,
    identityCardId: cardId(`hero-p${index + 1}`),
    deck: [],
    aspects: [],
    grantedCardIds: [],
  }));

const campaignInput = (instructions: readonly ReturnType<typeof syntheticInstruction>[], players = 2) =>
  syntheticCampaignInput({ log: LOG, seats: seatsFor(players), instructions });

/** A two-seat game of the synthetic campaign, settled past the mulligan, with every event it produced. */
function playCampaignGame(
  input: CampaignGameInput,
  options: { readonly players?: number; readonly deck?: readonly CardId[] } = {},
): { readonly state: GameState; readonly events: readonly GameEvent[] } {
  const players = options.players ?? 2;
  const identities = seatIdentities(HERO, players);
  const config: GameSetupConfig = {
    seed: 1234,
    cards: [...DEFAULT_CARDS, SCHEME, WARD, RELIC, ...identities],
    villainCardId: VILLAIN.id,
    mainSchemeCardId: SCHEME.id,
    encounterDeck: [],
    players: identities.map((identity) => ({
      identityCardId: identity.id,
      deck: options.deck ?? DEFAULT_DECK,
    })),
    campaign: input,
  };
  const created = createGame(config, DEFAULT_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  // Answers the mulligan prompts, so the run reaches the windows on the far side of Appendix II step 15.
  const driven = runCommands(created.state, DEFAULT_DEPS);
  return { state: driven.state, events: [...created.events, ...driven.events] };
}

const contextFor = (player: PlayerId = P1): EffectContext => ({
  selfInstanceId: null,
  controllerId: player,
  event: null,
  bindings: {},
  deps: DEFAULT_DEPS,
});

const readValue = (state: GameState, value: ValueSpec, player: PlayerId = P1): number =>
  resolveValue(state, value, contextFor(player), DEFAULT_DEPS);

const readPredicate = (state: GameState, predicate: Predicate, player: PlayerId = P1): boolean =>
  evaluate(state, predicate, contextFor(player));

/** The setup steps the game passed through, in order; a step that repeats per player (the mulligan) counts once. */
const stepsOf = (events: readonly GameEvent[]): readonly string[] =>
  events
    .flatMap((event) => (event.type === "stepChanged" ? [describeStep(event.to)] : []))
    .filter((step, index, all) => step !== all[index - 1]);

const describeStep = (step: GameStep): string => (step.kind === "campaignWindow" ? step.window : step.kind);

const mainSchemeThreat = (state: GameState): number => state.instances[state.mainScheme.instanceId]?.threat ?? 0;

// --- a game with no campaign is the game it always was -------------------------------------------------------------

describe("a game with no campaign input", () => {
  /**
   * The rest of the suite is the real proof (765 tests, untouched): every assertion about a standalone game's state
   * and events still holds. This pins the one thing those tests cannot see — that no campaign *field* appears in a
   * standalone game's state at all, so an already-saved game deserializes into exactly the state it was saved from.
   */
  it("carries no campaign state, so its serialized state is unchanged", () => {
    const state = newGame();
    expect(Object.hasOwn(state, "campaign")).toBe(false);
    expect(Object.hasOwn(state, "campaignWrites")).toBe(false);
    expect(JSON.stringify(state)).not.toContain("campaign");
  });

  it("runs the setup steps it always has, with no campaign step among them", () => {
    const identities = seatIdentities(HERO, 1);
    const created = createGame(
      {
        seed: 1234,
        cards: [...DEFAULT_CARDS, SCHEME, ...identities],
        villainCardId: VILLAIN.id,
        mainSchemeCardId: SCHEME.id,
        encounterDeck: [],
        players: identities.map((identity) => ({ identityCardId: identity.id, deck: DEFAULT_DECK })),
      },
      DEFAULT_DEPS,
    );
    if (!created.ok) throw new Error(created.error.message);
    const driven = runCommands(created.state, DEFAULT_DEPS);
    const events = [...created.events, ...driven.events];
    expect(stepsOf(events)).toEqual(["mulligan", "playerSetupAbilities", "turn"]);
    expect(events.some((event) => event.type.startsWith("campaign"))).toBe(false);
  });

  it("reads every campaign primitive as nothing at all", () => {
    const state = newGame();
    expect(readValue(state, { kind: "campaignLog", field: "stamina" })).toBe(0);
    expect(readPredicate(state, { kind: "campaignLog", field: "stamina" })).toBe(false);
    expect(readPredicate(state, { kind: "campaignLog", field: "stamina", isSet: false })).toBe(false);
    expect(readPredicate(state, { kind: "exists", query: { inCampaignLogField: { field: "keepsakes" } } })).toBe(false);
  });
});

// --- the five windows ----------------------------------------------------------------------------------------------

describe("campaign setup windows", () => {
  const oneThreatAt = (window: (typeof CAMPAIGN_WINDOW_ORDER)[number]) =>
    syntheticInstruction(`syn.${window}`, window, [
      { kind: "placeThreat", target: { kind: "mainScheme" }, amount: { kind: "const", value: 1 } },
    ]);

  it("resolves all five windows, in CAMPAIGN_WINDOW_ORDER, inside the setup flow", () => {
    const { state, events } = playCampaignGame(campaignInput(CAMPAIGN_WINDOW_ORDER.map(oneThreatAt)));
    const resolved = events.flatMap((event) => (event.type === "campaignInstructionResolved" ? [event.window] : []));
    expect(resolved).toEqual([...CAMPAIGN_WINDOW_ORDER]);
    // Every window's effects really resolved: 2 starting threat (SCHEME) + 1 per window.
    expect(mainSchemeThreat(state)).toBe(2 + CAMPAIGN_WINDOW_ORDER.length);
  });

  it("places each window between the Appendix II steps it names", () => {
    const { events } = playCampaignGame(campaignInput(CAMPAIGN_WINDOW_ORDER.map(oneThreatAt)));
    expect(stepsOf(events).slice(0, 8)).toEqual([
      // MC60 p. 9 steps 1-7: before Appendix II begins. (The game *starts* on `beforeScenarioSetup`, so the first
      // step change is the one leaving it.)
      "scenarioSetup",
      // The three that share the gap after step 12 and before step 14.
      "afterScenarioSetup",
      "beforeStartingHands",
      "beforePlayerSetup",
      "drawStartingHands",
      "mulligan",
      // MC50 p. 11: "After resolving mulligans", before step 16's player setup abilities.
      "afterMulligans",
      "playerSetupAbilities",
    ]);
  });

  it("resolves `beforeScenarioSetup` before the scenario is set up, and the default window after it", () => {
    const record = (window: (typeof CAMPAIGN_WINDOW_ORDER)[number]) =>
      syntheticInstruction(`syn.${window}.read`, window, [
        {
          kind: "recordInCampaignLog",
          field: `threat-${window}`,
          mode: "set",
          value: { kind: "number", amount: { kind: "threat", of: { kind: "mainScheme" } } },
        },
      ]);
    const { state } = playCampaignGame(campaignInput([record("beforeScenarioSetup"), record("afterScenarioSetup")]));
    const writes = state.campaignWrites?.logWrites ?? [];
    // Starting threat is Appendix II step 9-ish work, inside `scenarioSetup`: 0 before it, 2 after it.
    expect(writes.map((write) => [write.field, write.value])).toEqual([
      ["threat-beforeScenarioSetup", { kind: "number", value: 0 }],
      ["threat-afterScenarioSetup", { kind: "number", value: 2 }],
    ]);
  });

  it("names each instruction it resolved, with the printed text and citation for the trace", () => {
    const { events } = playCampaignGame(campaignInput([oneThreatAt("afterScenarioSetup")]));
    const resolved = events.find((event) => event.type === "campaignInstructionResolved");
    expect(resolved).toMatchObject({
      instructionId: "syn.afterScenarioSetup",
      window: "afterScenarioSetup",
      citation: "MC00 p. 1",
    });
  });
});

// --- reading the log -------------------------------------------------------------------------------------------

describe("reading the campaign log in game", () => {
  const stateWithLog = (): GameState => playCampaignGame(campaignInput([])).state;

  it("reads a shared number, a flag-like list and an absent field", () => {
    const state = stateWithLog();
    expect(readValue(state, { kind: "campaignLog", field: "errands", of: "count" })).toBe(2);
    // Without `of`, a list has no numeric value: only `number` and `flag` fields do.
    expect(readValue(state, { kind: "campaignLog", field: "errands" })).toBe(0);
    expect(readValue(state, { kind: "campaignLog", field: "no-such-field" })).toBe(0);
  });

  it("reads a per-seat field through the campaign's own seat numbers, not the table's", () => {
    const state = stateWithLog();
    const stamina = (player: PlayerId): number =>
      readValue(state, { kind: "campaignLog", field: "stamina", seat: { kind: "id", playerId: player } });
    expect(stamina(P1)).toBe(4); // seat 7
    expect(stamina(P2)).toBe(1); // seat 9
    expect(state.campaign?.seats.map((seat) => seat.seatNumber)).toEqual([7, 9]);
  });

  it("counts a per-seat list, and reads a seat that recorded nothing as 0", () => {
    const state = stateWithLog();
    const keepsakes = (player: PlayerId): number =>
      readValue(state, {
        kind: "campaignLog",
        field: "keepsakes",
        seat: { kind: "id", playerId: player },
        of: "count",
      });
    expect(keepsakes(P1)).toBe(2);
    expect(keepsakes(P2)).toBe(0);
  });

  it("tests a field with has / atLeast / isSet, ANDing whatever is asked", () => {
    const state = stateWithLog();
    const ask = (predicate: Predicate): boolean => readPredicate(state, predicate);
    expect(ask({ kind: "campaignLog", field: "errands", has: "north" })).toBe(true);
    expect(ask({ kind: "campaignLog", field: "errands", has: "east" })).toBe(false);
    expect(ask({ kind: "campaignLog", field: "warden", has: "warden-one", isSet: true })).toBe(true);
    expect(ask({ kind: "campaignLog", field: "errands", atLeast: 2, of: "count" })).toBe(true);
    expect(ask({ kind: "campaignLog", field: "errands", atLeast: 3, of: "count" })).toBe(false);
    expect(ask({ kind: "campaignLog", field: "favors", has: "syn.favor.ward" })).toBe(true);
    // A field the frozen view does not carry is "nothing recorded", and only `isSet: false` holds for it.
    expect(ask({ kind: "campaignLog", field: "no-such-field" })).toBe(false);
    expect(ask({ kind: "campaignLog", field: "no-such-field", isSet: false })).toBe(true);
    // A per-seat read of a shared field, and a shared read of a per-seat field, both find nothing.
    expect(ask({ kind: "campaignLog", field: "stamina", isSet: true })).toBe(false);
  });

  it("filters cards by the field that names them (`inCampaignLogField`)", () => {
    const state = stateWithLog();
    const wardsNamed = readValue(state, {
      kind: "count",
      query: { categories: ["ally"], inCampaignLogField: { field: "keepsakes", seat: { kind: "id", playerId: P1 } } },
    });
    // Nothing is in play yet, so the filter is exercised where the selector below is not: it says nothing about
    // where a card is, only whether the log names its title.
    expect(wardsNamed).toBe(0);
  });
});

// --- the card selector -----------------------------------------------------------------------------------------

describe("the cards a campaign-log field names", () => {
  const deckWithWards = [...DEFAULT_DECK.slice(0, 20), WARD.id, WARD.id, WARD.id];

  it("names one card per recorded entry, duplicates included, and no more", () => {
    // `keepsakes` names the ward twice for seat 7; three copies are in the deck.
    const instruction = syntheticInstruction("syn.pool", "afterScenarioSetup", [
      {
        kind: "moveCards",
        cards: { kind: "campaignLog", field: "keepsakes", seat: { kind: "id", playerId: P1 } },
        to: "removedFromGame",
      },
    ]);
    const { state, events } = playCampaignGame(campaignInput([instruction]), { deck: deckWithWards });
    const removed = state.removedFromGame.filter((id) => state.instances[id]?.cardId === WARD.id);
    expect(removed).toHaveLength(2);
    const read = events.find((event) => event.type === "campaignLogRead");
    expect(read).toMatchObject({ field: "keepsakes", seatNumber: 7 });
    expect(read?.type === "campaignLogRead" && read.cardIds).toEqual([WARD.id, WARD.id]);
    expect(read?.type === "campaignLogRead" && read.instanceIds).toHaveLength(2);
  });

  it("names nothing for a seat that recorded nothing", () => {
    const instruction = syntheticInstruction("syn.pool", "afterScenarioSetup", [
      {
        kind: "moveCards",
        cards: { kind: "campaignLog", field: "keepsakes", seat: { kind: "id", playerId: P2 } },
        to: "removedFromGame",
      },
    ]);
    const { state } = playCampaignGame(campaignInput([instruction]), { deck: deckWithWards });
    expect(state.removedFromGame.filter((id) => state.instances[id]?.cardId === WARD.id)).toHaveLength(0);
  });
});

// --- writing back ----------------------------------------------------------------------------------------------

describe("writing the campaign log from inside a game", () => {
  it("accumulates writes in game state, one per addressed seat, and traces each", () => {
    const instruction = syntheticInstruction("syn.write", "afterScenarioSetup", [
      {
        kind: "recordInCampaignLog",
        field: "errands",
        mode: "strike",
        value: { kind: "choice", option: "east" },
      },
      {
        kind: "recordInCampaignLog",
        field: "stamina",
        seat: { kind: "each" },
        mode: "set",
        value: { kind: "number", amount: { kind: "const", value: 5 } },
      },
    ]);
    const { state, events } = playCampaignGame(campaignInput([instruction]));
    expect(state.campaignWrites?.logWrites).toEqual([
      { field: "errands", seatNumber: null, mode: "strike", value: { kind: "choice", option: "east" } },
      { field: "stamina", seatNumber: 7, mode: "set", value: { kind: "number", value: 5 } },
      { field: "stamina", seatNumber: 9, mode: "set", value: { kind: "number", value: 5 } },
    ]);
    expect(events.filter((event) => event.type === "campaignLogWritten")).toHaveLength(3);
    // The frozen input is never edited by a write: that is what keeps a replay reading the same log forever.
    expect(state.campaign?.log).toEqual(LOG);
  });

  it("writes a card list from a selector, keeping duplicates", () => {
    const instruction = syntheticInstruction("syn.write.cards", "afterScenarioSetup", [
      {
        kind: "recordInCampaignLog",
        field: "keepsakes",
        mode: "append",
        value: { kind: "cardList", cards: { kind: "zone", zone: "deck", player: { kind: "id", playerId: P1 } } },
      },
    ]);
    const { state } = playCampaignGame(campaignInput([instruction]), { deck: [WARD.id, WARD.id] });
    expect(state.campaignWrites?.logWrites[0]?.value).toEqual({ kind: "cardList", cardIds: [WARD.id, WARD.id] });
  });

  it("writes nothing when a cardRef write names no card", () => {
    const instruction = syntheticInstruction("syn.write.none", "afterScenarioSetup", [
      {
        kind: "recordInCampaignLog",
        field: "warden",
        mode: "set",
        value: {
          kind: "cardRef",
          card: { kind: "ref", ref: { kind: "each", query: { categories: ["environment"] } } },
        },
      },
    ]);
    const { state } = playCampaignGame(campaignInput([instruction]));
    expect(state.campaignWrites?.logWrites).toEqual([]);
  });
});

// --- removal, by face ------------------------------------------------------------------------------------------

describe("removing a card from the campaign", () => {
  const relicSelector = { kind: "ref", ref: { kind: "each", query: { categories: ["upgrade"] } } } as const;

  it("records the face the card is showing (ruling April 30, 2026 (4))", () => {
    const flipped = syntheticInstruction("syn.remove.flipped", "afterScenarioSetup", [
      { kind: "flipCard", target: { kind: "each", query: { categories: ["upgrade"] } } },
      { kind: "removeFromCampaign", cards: relicSelector },
    ]);
    const { state, events } = playCampaignGame(campaignInput([flipped], 1), { players: 1, deck: [RELIC.id] });
    expect(state.campaignWrites?.removedFromCampaign).toEqual([{ cardId: RELIC.id, face: "Improved Relic" }]);
    expect(events.some((event) => event.type === "campaignCardRemoved")).toBe(true);
  });

  it("records no face for a card showing its front, and never the same face twice", () => {
    const twice = syntheticInstruction("syn.remove.twice", "afterScenarioSetup", [
      { kind: "removeFromCampaign", cards: relicSelector },
      { kind: "removeFromCampaign", cards: relicSelector },
    ]);
    const { state, events } = playCampaignGame(campaignInput([twice], 1), { players: 1, deck: [RELIC.id] });
    expect(state.campaignWrites?.removedFromCampaign).toEqual([{ cardId: RELIC.id }]);
    expect(events.filter((event) => event.type === "campaignCardRemoved")).toHaveLength(1);
  });

  it("keeps the removal after the game is lost (RRG 1.8 p. 29)", () => {
    const remove = syntheticInstruction("syn.remove", "afterScenarioSetup", [
      { kind: "removeFromCampaign", cards: relicSelector },
      {
        kind: "recordInCampaignLog",
        field: "errands",
        mode: "strike",
        value: { kind: "choice", option: "east" },
      },
    ]);
    const { state } = playCampaignGame(campaignInput([remove], 1), { players: 1, deck: [RELIC.id] });
    const conceded = runCommands(state, DEFAULT_DEPS, { type: "concede", playerId: P1 });
    expect(conceded.state.outcome?.result).toBe("conceded");
    // Both in-game writes survive the loss, and stay where only this game put them — the runner applies them
    // whatever the outcome, while `LossPolicy.retryBaseline` rolls the between-games writes back.
    expect(conceded.state.campaignWrites).toEqual(state.campaignWrites);
    expect(conceded.state.campaignWrites?.removedFromCampaign).toEqual([{ cardId: RELIC.id }]);
    expect(conceded.state.campaignWrites?.logWrites).toHaveLength(1);
  });

  it("does nothing at all in a game with no campaign", () => {
    // The same scripted card in a standalone game: no log to write to, and no state to corrupt.
    const state = newGame({ extraCards: [RELIC], deck: [RELIC.id] });
    const { state: after, events } = runCommands(state, DEFAULT_DEPS);
    expect(Object.hasOwn(after, "campaignWrites")).toBe(false);
    expect(events.some((event) => event.type.startsWith("campaign"))).toBe(false);
  });
});

// --- determinism and serialization -------------------------------------------------------------------------------

describe("a campaign game is still deterministic and still plain data", () => {
  const instructions = [
    syntheticInstruction("syn.det.threat", "afterScenarioSetup", [
      {
        kind: "placeThreat",
        target: { kind: "mainScheme" },
        amount: { kind: "campaignLog", field: "errands", of: "count" },
      },
    ]),
    syntheticInstruction("syn.det.write", "afterMulligans", [
      {
        kind: "recordInCampaignLog",
        field: "stamina",
        seat: { kind: "each" },
        mode: "set",
        value: { kind: "number", amount: { kind: "threat", of: { kind: "mainScheme" } } },
      },
    ]),
  ];

  it("produces the same state and the same events from the same input", () => {
    const first = playCampaignGame(campaignInput(instructions));
    const second = playCampaignGame(campaignInput(instructions));
    expect(second.state).toEqual(first.state);
    expect(second.events).toEqual(first.events);
    expect(mainSchemeThreat(first.state)).toBe(4); // 2 starting + 2 struck errands
  });

  it("round-trips through JSON with the campaign input and the writes intact", () => {
    const { state } = playCampaignGame(campaignInput(instructions));
    const after = JSON.parse(JSON.stringify(state)) as GameState;
    expect(after).toEqual(state);
    expect(after.campaign?.campaignId).toBe(SYNTHETIC_CAMPAIGN_ID);
    expect(after.campaignWrites?.logWrites).toEqual([
      { field: "stamina", seatNumber: 7, mode: "set", value: { kind: "number", value: 4 } },
      { field: "stamina", seatNumber: 9, mode: "set", value: { kind: "number", value: 4 } },
    ]);
  });

  it("refuses a table the campaign did not compose seats for", () => {
    const identities = seatIdentities(HERO, 2);
    const created = createGame(
      {
        seed: 1234,
        cards: [...DEFAULT_CARDS, SCHEME, ...identities],
        villainCardId: VILLAIN.id,
        mainSchemeCardId: SCHEME.id,
        encounterDeck: [],
        players: identities.map((identity) => ({ identityCardId: identity.id, deck: DEFAULT_DECK })),
        campaign: syntheticCampaignInput({ log: LOG, seats: seatsFor(1) }),
      },
      DEFAULT_DEPS,
    );
    expect(created.ok).toBe(false);
    expect(created.ok === false && created.error.code).toBe("invalid_setup");
  });
});
