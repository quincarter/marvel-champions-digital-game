/**
 * RRG 1.8 Appendix II step 11 (p. 51): "Put Setup Cards Into Play. Search each deck and the set aside area for any
 * cards with the setup keyword and put them into play." Owner decision docs/phase7-wave7.md §4.1 Q20 = B: as written,
 * so a setup-keyword card in the encounter set-aside area begins the game in play ("Setup (Keyword)", p. 40), unless
 * the scenario's own printed text keeps it aside until called (`GameSetupConfig.setAsideUntilCalled`; MC40 p. 16, "The
 * setup keyword on the Flight, Super Strength, and Telepathy attachments is ignored in this scenario because these
 * cards are set aside during setup"). The audit of every shipped scenario is docs/setup-keyword-set-aside-audit.md.
 *
 * Synthetic cards only. Set aside: a Skiff (a player-typed support of the scenario, like a scenario's vehicle), a
 * Beacon environment, a Harness that reads "Attach to the villain", a Leash that attaches to a card the game never
 * has, a plain Crate with no keyword, and three cards a scenario rule holds back (a Vault by card id, a Relic by its
 * encounter set, a Barge by the set its `specificTo` names). A Trophy is a campaign-specific upgrade, as a campaign's
 * supply copy of an earned card is.
 *
 * Readings pinned here that the RRG does not spell out:
 * - Order. Step 11 names "each deck and the set aside area"; the cards are found in that order: encounter decks, each
 *   player's deck (with that player's own permanent set-aside cards), then the encounter set-aside area.
 * - A set-aside attachment with no card to attach to, in a game whose villains all start set aside, follows the rule a
 *   deck's attachment already has (`resolve/setup-cards.ts`): it waits where it is and attaches as the villain enters.
 */

import { encounterSetId, flat, type AnyCard, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { locateCard, mustInstance, mustPlayer, undefeatedVillains } from "./query.js";
import { createGame, type GameSetupConfig } from "./setup.js";
import type { GameState, SetAsideUntilCalled } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { syntheticCampaignInput } from "./testing/campaign.js";
import { driveSession } from "./testing/drive.js";
import {
  stubAttachment,
  stubEnvironment,
  stubMainScheme,
  stubSupport,
  stubTreachery,
  stubUpgrade,
  stubVillain,
} from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, HERO, seatIdentities, VILLAIN } from "./testing/scenario.js";
import { copiesOf } from "./testing/wave3.js";

const SETUP_KEYWORD = [{ name: "setup" }] as const;
const HELD_SET = encounterSetId("held-set");
const BARGE_SET = encounterSetId("barge-set");

const SKIFF = stubSupport({ id: "skiff", cost: 0, keywords: SETUP_KEYWORD });
const BEACON = stubEnvironment({ id: "beacon", keywords: SETUP_KEYWORD });
const HARNESS = stubAttachment({ id: "harness", attachesTo: { kind: "villain" }, keywords: SETUP_KEYWORD });
const LEASH = stubAttachment({
  id: "leash",
  attachesTo: { kind: "namedCard", name: "A Card Not In This Game" },
  keywords: SETUP_KEYWORD,
});
const CRATE = stubEnvironment({ id: "crate" });
const VAULT = stubEnvironment({ id: "vault", keywords: SETUP_KEYWORD });
const RELIC = {
  ...stubAttachment({ id: "relic", attachesTo: { kind: "villain" }, keywords: SETUP_KEYWORD }),
  encounterSetIds: [HELD_SET],
};
const BARGE = {
  ...stubSupport({ id: "barge", cost: 0, keywords: SETUP_KEYWORD }),
  specificTo: { kind: "scenario" as const, encounterSetId: BARGE_SET },
};
/** A campaign-specific card (a campaign upgrade's supply copy): never a scenario's set-aside card. */
const TROPHY = {
  ...stubUpgrade({ id: "trophy", cost: 0, keywords: SETUP_KEYWORD }),
  specificTo: { kind: "campaign" as const, encounterSetId: encounterSetId("campaign-set") },
};
/** In the encounter deck, and in a player's deck: the two sources step 11 already swept. */
const DECK_BEACON = stubEnvironment({ id: "deck-beacon", keywords: SETUP_KEYWORD });
const DECK_HARNESS = stubAttachment({ id: "deck-harness", attachesTo: { kind: "villain" }, keywords: SETUP_KEYWORD });
const PLAYER_GEAR = stubUpgrade({ id: "player-gear", cost: 0, keywords: SETUP_KEYWORD });
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });

const setAsideVillains = { kind: "encounterSetAside", filter: { categories: ["villain"] } } as const;
const VILLAINS = ["Ash", "Brine"].map((name) =>
  stubVillain({ id: name.toLowerCase(), name, stages: [{ hp: flat(9), atk: 0, sch: 0 }] }),
);
const SETUP_RANDOM = stubAbility("set-aside-sweep.setup", {
  trigger: { kind: "setup" },
  effects: [
    { kind: "selectCards", slot: "starting", cards: { ...setAsideVillains, random: { kind: "const", value: 1 } } },
    { kind: "addVillain", villain: { kind: "slot", slot: "starting" } },
    { kind: "moveCards", cards: setAsideVillains, to: "removedFromGame" },
  ],
});
const STAGE_REVEALED = stubAbility("set-aside-sweep.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [{ kind: "placeThreat", target: { kind: "mainScheme" }, amount: { kind: "const", value: 1 } }],
});
const stage = (aSideAbilities: readonly (typeof SETUP_RANDOM.ref)[]) => ({
  startingThreat: flat(0),
  targetThreat: flat(999),
  acceleration: flat(0),
  aSideAbilities,
  abilities: [STAGE_REVEALED.ref],
});
const PLAIN_SCHEME = stubMainScheme({ id: "plain-scheme", stages: [stage([])] });
const BY_SETUP_SCHEME = stubMainScheme({ id: "by-setup-scheme", stages: [stage([SETUP_RANDOM.ref])] });

const deps: EngineDeps = depsOf(SETUP_RANDOM, STAGE_REVEALED);

const HELD: SetAsideUntilCalled = { cardIds: [VAULT.id], encounterSetIds: [HELD_SET, BARGE_SET] };
const EVERY_SET_ASIDE: readonly CardId[] = [
  SKIFF.id,
  BEACON.id,
  HARNESS.id,
  LEASH.id,
  CRATE.id,
  VAULT.id,
  RELIC.id,
  BARGE.id,
];

interface Options {
  readonly villainBySetup?: boolean;
  readonly campaign?: boolean;
  readonly setAside?: readonly CardId[];
  /** `null`: the scenario states no rule. Absent: `HELD`. */
  readonly setAsideUntilCalled?: SetAsideUntilCalled | null;
  readonly encounterDeck?: readonly CardId[];
  readonly seats?: number;
  readonly firstPlayerIndex?: number;
}

function configOf(options: Options = {}): GameSetupConfig {
  const identities = seatIdentities(HERO, options.seats ?? 2);
  const [first, ...others] = VILLAINS;
  return {
    seed: 7,
    cards: [
      ...DEFAULT_CARDS,
      ...identities,
      ...VILLAINS,
      PLAIN_SCHEME,
      BY_SETUP_SCHEME,
      SKIFF,
      BEACON,
      HARNESS,
      LEASH,
      CRATE,
      VAULT,
      RELIC,
      BARGE,
      DECK_BEACON,
      DECK_HARNESS,
      PLAYER_GEAR,
      TROPHY,
      FILLER,
    ] satisfies readonly AnyCard[],
    ...(options.villainBySetup
      ? {
          villainCardId: first!.id,
          setAsideVillainCardIds: others.map((card) => card.id),
          villainsStartSetAside: true as const,
          mainSchemeCardId: BY_SETUP_SCHEME.id,
        }
      : { villainCardId: VILLAIN.id, mainSchemeCardId: PLAIN_SCHEME.id }),
    encounterDeck: options.encounterDeck ?? [DECK_BEACON.id, DECK_HARNESS.id, ...copiesOf(FILLER.id, 12)],
    setAside: options.setAside ?? EVERY_SET_ASIDE,
    ...(options.setAsideUntilCalled === null ? {} : { setAsideUntilCalled: options.setAsideUntilCalled ?? HELD }),
    includeIdentitySets: false,
    firstPlayerIndex: options.firstPlayerIndex ?? 1,
    players: identities.map((identity, seat) => ({
      identityCardId: identity.id,
      deck: seat === 0 ? [...DEFAULT_DECK, PLAYER_GEAR.id] : DEFAULT_DECK,
    })),
    ...(options.campaign
      ? {
          campaign: syntheticCampaignInput({
            seats: identities.map((identity, index) => ({
              seatNumber: index + 1,
              identityCardId: identity.id,
              deck: [],
              aspects: [],
              grantedCardIds: [],
            })),
            instructions: [],
          }),
        }
      : {}),
  };
}

function created(options: Options = {}): { readonly state: GameState; readonly events: readonly GameEvent[] } {
  const result = createGame(configOf(options), deps);
  if (!result.ok) throw new Error(result.error.message);
  return result;
}

function start(options: Options = {}) {
  const { state: baseline, events: setupEvents } = created(options);
  const { session, events } = driveSession(startSession(baseline), deps);
  return { session, state: session.state, events: [...setupEvents, ...events] };
}

const instanceOf = (state: GameState, cardId: string): InstanceId => {
  const found = Object.values(state.instances).filter((instance) => instance.cardId === cardId);
  expect(found).toHaveLength(1);
  return found[0]!.instanceId;
};
const movesOf = (events: readonly GameEvent[], id: InstanceId): readonly string[] =>
  events.flatMap((event) => (event.type === "cardMoved" && event.instanceId === id ? [event.to.kind] : []));
const indexOfMove = (events: readonly GameEvent[], id: InstanceId, to: string): number =>
  events.findIndex((event) => event.type === "cardMoved" && event.instanceId === id && event.to.kind === to);
const enteredPlayCount = (events: readonly GameEvent[], id: InstanceId): number =>
  events.filter(
    (event) =>
      event.type === "triggerEvent" &&
      event.phase === "resolved" &&
      event.event.kind === "cardEntersPlay" &&
      event.event.instanceId === id,
  ).length;

describe("step 11 searches the encounter set-aside area (Q20 = B)", () => {
  it("a set-aside setup-keyword card begins the game in play, where its type goes", () => {
    const { state, events } = created();
    const first = state.firstPlayerId;
    expect(first).toBe(state.players[1]!.playerId);
    const [villain] = undefeatedVillains(state);

    // A player-typed support nobody owns: the first player's play area, under their control, and theirs to own (RRG
    // 1.8 "Ownership and Control", p. 31), exactly as a Setup ability's "put into play" places it.
    const skiff = instanceOf(state, SKIFF.id);
    expect(locateCard(state, skiff)).toEqual({ kind: "playArea", playerId: first });
    expect(mustInstance(state, skiff).controllerId).toBe(first);
    expect(mustInstance(state, skiff).ownerId).toBe(first);
    expect(mustInstance(state, skiff).faceup).toBe(true);
    expect(mustPlayer(state, first).playArea).toContain(skiff);

    const beacon = instanceOf(state, BEACON.id);
    expect(locateCard(state, beacon)).toEqual({ kind: "villainArea" });
    expect(movesOf(events, beacon)).toEqual(["villainArea"]);

    const harness = instanceOf(state, HARNESS.id);
    expect(locateCard(state, harness)).toEqual({ kind: "attachment", hostInstanceId: villain!.instanceId });
    expect(movesOf(events, harness)).toEqual(["attachment"]);

    // Each enters play once, and is announced as any card entering play is.
    for (const id of [skiff, beacon, harness]) {
      expect(enteredPlayCount(events, id)).toBe(1);
      expect(state.encounterSetAside).not.toContain(id);
    }
  });

  it("a set-aside attachment with nothing to attach to is discarded (RRG 'Attach To', p. 8), as a deck's is", () => {
    const { state, events } = created();
    const leash = instanceOf(state, LEASH.id);
    expect(locateCard(state, leash)?.kind).toBe("encounterDiscard");
    expect(movesOf(events, leash)).toEqual(["encounterDiscard"]);
  });

  it("a set-aside card without the setup keyword stays set aside, facedown as it was", () => {
    const { state, events } = created();
    const crate = instanceOf(state, CRATE.id);
    expect(locateCard(state, crate)).toEqual({ kind: "encounterSetAside" });
    expect(movesOf(events, crate)).toEqual([]);
  });

  it("the cards are found in the order step 11 names: encounter deck, players' decks, then the set-aside area", () => {
    const { state, events } = created();
    const entry = (cardId: string, to: string) => indexOfMove(events, instanceOf(state, cardId), to);
    const deckCards = [entry(DECK_BEACON.id, "villainArea"), entry(DECK_HARNESS.id, "attachment")];
    const playerCard = entry(PLAYER_GEAR.id, "attachment");
    // In the order they sat in the set-aside area.
    const setAsideCards = [
      entry(SKIFF.id, "playArea"),
      entry(BEACON.id, "villainArea"),
      entry(HARNESS.id, "attachment"),
      entry(LEASH.id, "encounterDiscard"),
    ];
    for (const index of [...deckCards, playerCard, ...setAsideCards]) expect(index).toBeGreaterThan(-1);
    expect(Math.max(...deckCards)).toBeLessThan(playerCard);
    expect(playerCard).toBeLessThan(setAsideCards[0]!);
    expect(setAsideCards).toEqual([...setAsideCards].sort((a, b) => a - b));
    // All of it is step 11: before the main scheme's When Revealed (step 12b).
    const revealed = events.findIndex(
      (event) => event.type === "abilityResolved" && event.abilityId === STAGE_REVEALED.ref.id,
    );
    expect(revealed).toBeGreaterThan(Math.max(...setAsideCards));
  });

  it("the game replays to the same state", () => {
    const run = start();
    expect(run.state.step.kind).toBe("turn");
    const replayed = replay(run.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(run.state);
  });

  it("a campaign game, whose scenario setup is a flow step, ends in the same place", () => {
    const { state } = start({ campaign: true });
    expect(locateCard(state, instanceOf(state, SKIFF.id))).toEqual({ kind: "playArea", playerId: state.firstPlayerId });
    expect(locateCard(state, instanceOf(state, BEACON.id))).toEqual({ kind: "villainArea" });
    for (const held of [VAULT, RELIC, BARGE])
      expect(locateCard(state, instanceOf(state, held.id))).toEqual({ kind: "encounterSetAside" });
  });
});

describe("a scenario rule keeps set-aside cards aside until called (`setAsideUntilCalled`)", () => {
  it("a card named by id, by its encounter set, or by the set its `specificTo` names does not enter play", () => {
    const { state, events } = start();
    expect(state.scenarioRules.setAsideUntilCalled).toEqual(HELD);
    for (const held of [VAULT, RELIC, BARGE]) {
      const id = instanceOf(state, held.id);
      expect(locateCard(state, id)).toEqual({ kind: "encounterSetAside" });
      expect(movesOf(events, id)).toEqual([]);
      expect(enteredPlayCount(events, id)).toBe(0);
      // Untouched: not turned faceup, nobody's.
      expect(mustInstance(state, id).faceup).toBe(false);
      expect(mustInstance(state, id).controllerId).toBeNull();
    }
  });

  it("without the rule, the same cards enter play at step 11", () => {
    const { state } = created({ setAsideUntilCalled: null });
    expect(state.scenarioRules.setAsideUntilCalled).toBeUndefined();
    const [villain] = undefeatedVillains(state);
    expect(locateCard(state, instanceOf(state, VAULT.id))).toEqual({ kind: "villainArea" });
    expect(locateCard(state, instanceOf(state, RELIC.id))).toEqual({
      kind: "attachment",
      hostInstanceId: villain!.instanceId,
    });
    expect(locateCard(state, instanceOf(state, BARGE.id))).toEqual({ kind: "playArea", playerId: state.firstPlayerId });
  });

  it("the rule is about the set-aside area: the same card in the encounter deck still enters play", () => {
    const { state } = created({
      setAside: [CRATE.id],
      encounterDeck: [VAULT.id, RELIC.id, ...copiesOf(FILLER.id, 12)],
    });
    expect(locateCard(state, instanceOf(state, VAULT.id))).toEqual({ kind: "villainArea" });
    expect(locateCard(state, instanceOf(state, RELIC.id))?.kind).toBe("attachment");
  });

  it("a rule that names nothing is not stored, and one naming an unknown card is refused", () => {
    expect(
      created({ setAsideUntilCalled: { cardIds: [], encounterSetIds: [] } }).state.scenarioRules,
    ).not.toHaveProperty("setAsideUntilCalled");
    const result = createGame(configOf({ setAsideUntilCalled: { cardIds: ["no-such-card" as CardId] } }), deps);
    expect(result.ok).toBe(false);
  });
});

describe("a campaign-specific card in the set-aside area is the campaign's supply", () => {
  it("is left aside at step 11 with no scenario rule naming it, in a standalone and in a campaign game", () => {
    for (const campaign of [false, true]) {
      const { state, events } = start({ campaign, setAside: [TROPHY.id, SKIFF.id], setAsideUntilCalled: null });
      const trophy = instanceOf(state, TROPHY.id);
      expect(locateCard(state, trophy)).toEqual({ kind: "encounterSetAside" });
      expect(movesOf(events, trophy)).toEqual([]);
      expect(mustInstance(state, trophy).controllerId).toBeNull();
      // The scenario's own setup-keyword card beside it still enters play.
      expect(locateCard(state, instanceOf(state, SKIFF.id))?.kind).toBe("playArea");
    }
  });
});

describe("with every villain set aside, a set-aside attachment waits for the villain as a deck's does", () => {
  const options: Options = { villainBySetup: true, seats: 1, firstPlayerIndex: 0 };

  it("'Attach to the villain' stays where it is at step 11 and attaches as 12a's villain enters", () => {
    const run = start(options);
    const { state, events } = run;
    expect(state.step.kind).toBe("turn");
    const [villain] = undefeatedVillains(state);
    const fromDeck = instanceOf(state, DECK_HARNESS.id);
    const fromSetAside = instanceOf(state, HARNESS.id);
    expect(movesOf(events, fromDeck)).toEqual(["encounterSetAside", "attachment"]);
    // Already in the set-aside area: it is not moved there again, only onto the villain.
    expect(movesOf(events, fromSetAside)).toEqual(["attachment"]);
    expect(mustInstance(state, fromSetAside).faceup).toBe(true);
    // In the order step 11 found them: the deck's, then the set-aside area's.
    expect(mustInstance(state, villain!.instanceId).attachments).toEqual([fromDeck, fromSetAside]);
    const added = events.findIndex((event) => event.type === "villainAdded");
    expect(indexOfMove(events, fromSetAside, "attachment")).toBeGreaterThan(added);
    expect(enteredPlayCount(events, fromSetAside)).toBe(1);
    expect(state.setupCardsAwaitingHost).toBeUndefined();

    // One with nothing to attach to when step 12c begins is discarded then; a held one is still aside.
    expect(movesOf(events, instanceOf(state, LEASH.id))).toEqual(["encounterDiscard"]);
    expect(locateCard(state, instanceOf(state, RELIC.id))).toEqual({ kind: "encounterSetAside" });
    // The set-aside villains are not setup cards: one entered by 12a's text, the other was removed by it.
    expect(undefeatedVillains(state)).toHaveLength(1);

    const replayed = replay(run.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(state);
  });

  it("a set-aside card that needs no villain still enters at step 11, before the villain does", () => {
    const { state, events } = start(options);
    const beacon = instanceOf(state, BEACON.id);
    expect(locateCard(state, beacon)).toEqual({ kind: "villainArea" });
    expect(indexOfMove(events, beacon, "villainArea")).toBeLessThan(
      events.findIndex((event) => event.type === "villainAdded"),
    );
  });
});
