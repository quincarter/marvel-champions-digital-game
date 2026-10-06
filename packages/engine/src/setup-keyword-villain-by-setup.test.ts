/**
 * RRG 1.8 Appendix II step 11 (p. 51), "Put Setup Cards Into Play. Search each deck and the set aside area for any cards
 * with the setup keyword and put them into play", and "Setup (Keyword)" (p. 40), "A card with the setup keyword begins
 * the game in play", in a game whose villain the main scheme's stage 1A Setup chooses at step 12a
 * (`GameSetupConfig.villainsStartSetAside`, docs/phase7-wave7.md §3.42).
 *
 * Synthetic cards: three one-stage villains, all set aside; a 1A Setup reading "Put 1 random villain into play" (and
 * the same with the first player choosing); and a modular set of three setup-keyword cards: a Harness that reads
 * "Setup. Attach to the villain", a Beacon environment that attaches to nothing, and a Leash that attaches to a card
 * the game never has.
 *
 * The reading pinned here, which the RRG does not spell out: at step 11 no villain is in play, so the Harness cannot
 * attach yet. "Attach To" (p. 8) would discard it, and the card would not begin the game in play. It is instead taken
 * out of the encounter deck and held, faceup, in the set-aside area, and attaches the moment a villain enters play,
 * ahead of the rest of step 12. The Beacon needs no villain and enters at step 11. The Leash still has nothing to attach
 * to when step 12c begins and is discarded then, as "Attach To" has it.
 */

import { flat, type AnyCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { locateCard, mustInstance, undefeatedVillains } from "./query.js";
import { createGame, type GameSetupConfig } from "./setup.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { syntheticCampaignInput } from "./testing/campaign.js";
import { driveSession } from "./testing/drive.js";
import { stubAttachment, stubEnvironment, stubMainScheme, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, HERO, seatIdentities } from "./testing/scenario.js";
import { copiesOf } from "./testing/wave3.js";

const MAIN_SCHEME = { kind: "mainScheme" } as const;
const setAsideVillains = { kind: "encounterSetAside", filter: { categories: ["villain"] } } as const;
const startingVillain = { kind: "slot", slot: "starting" } as const;

const VILLAINS = ["Ash", "Brine", "Cinder"].map((name) =>
  stubVillain({ id: name.toLowerCase(), name, stages: [{ hp: flat(9), atk: 0, sch: 0 }] }),
);
const SETUP_RANDOM = stubAbility("escape.setup", {
  trigger: { kind: "setup" },
  effects: [
    { kind: "selectCards", slot: "starting", cards: { ...setAsideVillains, random: { kind: "const", value: 1 } } },
    { kind: "addVillain", villain: startingVillain },
    { kind: "moveCards", cards: setAsideVillains, to: "removedFromGame" },
  ],
});
const SETUP_CHOSEN = stubAbility("escape.setup-chosen", {
  trigger: { kind: "setup" },
  effects: [
    { kind: "chooseCards", slot: "starting", from: setAsideVillains, chooser: { kind: "controller" }, min: 1, max: 1 },
    { kind: "addVillain", villain: startingVillain },
    { kind: "moveCards", cards: setAsideVillains, to: "removedFromGame" },
  ],
});
const STAGE_REVEALED = stubAbility("escape.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [{ kind: "placeThreat", target: MAIN_SCHEME, amount: { kind: "const", value: 1 } }],
});
const mainScheme = (id: string, setup: typeof SETUP_RANDOM) =>
  stubMainScheme({
    id,
    stages: [
      {
        startingThreat: flat(0),
        targetThreat: flat(999),
        acceleration: flat(0),
        aSideAbilities: [setup.ref],
        abilities: [STAGE_REVEALED.ref],
      },
    ],
  });
const ESCAPE = mainScheme("escape", SETUP_RANDOM);
const ESCAPE_CHOSEN = mainScheme("escape-chosen", SETUP_CHOSEN);

const SETUP_KEYWORD = [{ name: "setup" }] as const;
const HARNESS = stubAttachment({ id: "harness", attachesTo: { kind: "villain" }, keywords: SETUP_KEYWORD });
const SECOND_HARNESS = stubAttachment({ id: "harness-2", attachesTo: { kind: "villain" }, keywords: SETUP_KEYWORD });
const LEASH = stubAttachment({
  id: "leash",
  attachesTo: { kind: "namedCard", name: "A Card Not In This Game" },
  keywords: SETUP_KEYWORD,
});
const BEACON = stubEnvironment({ id: "beacon", keywords: SETUP_KEYWORD });
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });

const deps: EngineDeps = depsOf(SETUP_RANDOM, SETUP_CHOSEN, STAGE_REVEALED);

interface Options {
  readonly chosen?: boolean;
  readonly villainInPlay?: boolean;
  readonly campaign?: boolean;
  readonly seed?: number;
}

function configOf(options: Options = {}): GameSetupConfig {
  const identities = seatIdentities(HERO, 1);
  const [first, ...others] = VILLAINS;
  return {
    seed: options.seed ?? 7,
    cards: [
      ...DEFAULT_CARDS,
      ...identities,
      ...VILLAINS,
      ESCAPE,
      ESCAPE_CHOSEN,
      HARNESS,
      SECOND_HARNESS,
      LEASH,
      BEACON,
      FILLER,
    ] satisfies readonly AnyCard[],
    villainCardId: first!.id,
    ...(options.villainInPlay
      ? {}
      : { setAsideVillainCardIds: others.map((card) => card.id), villainsStartSetAside: true as const }),
    mainSchemeCardId: options.chosen ? ESCAPE_CHOSEN.id : ESCAPE.id,
    encounterDeck: [HARNESS.id, SECOND_HARNESS.id, LEASH.id, BEACON.id, ...copiesOf(FILLER.id, 12)],
    includeIdentitySets: false,
    players: identities.map((identity) => ({ identityCardId: identity.id, deck: DEFAULT_DECK })),
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
const indexOfResolved = (events: readonly GameEvent[], abilityId: string): number =>
  events.findIndex((event) => event.type === "abilityResolved" && event.abilityId === abilityId);

describe("step 11 with every villain set aside: a setup-keyword attachment waits for the villain", () => {
  it("'Attach to the villain' begins the game attached to the villain 12a puts into play", () => {
    const run = start();
    const { state, events } = run;
    expect(state.step.kind).toBe("turn");
    const [villain] = undefeatedVillains(state);
    const harness = instanceOf(state, HARNESS.id);
    const second = instanceOf(state, SECOND_HARNESS.id);
    for (const id of [harness, second]) {
      expect(locateCard(state, id)).toEqual({ kind: "attachment", hostInstanceId: villain!.instanceId });
      expect(mustInstance(state, id).attachedTo).toBe(villain!.instanceId);
      expect(mustInstance(state, id).faceup).toBe(true);
      // Out of the deck at step 11, held set aside, then onto the villain: never discarded.
      expect(movesOf(events, id)).toEqual(["encounterSetAside", "attachment"]);
    }
    // In the order step 11 found them in the deck.
    const found = [harness, second].sort(
      (a, b) => indexOfMove(events, a, "encounterSetAside") - indexOfMove(events, b, "encounterSetAside"),
    );
    expect(mustInstance(state, villain!.instanceId).attachments).toEqual(found);
    expect(state.encounterSetAside).toEqual([]);
    expect(state.setupCardsAwaitingHost).toBeUndefined();
    expect(state.villainsEnteringAtSetup).toBeUndefined();

    // It attaches as the villain enters: after `villainAdded`, before 1A's Setup has finished and 1B is revealed.
    const added = events.findIndex((event) => event.type === "villainAdded");
    const attached = indexOfMove(events, harness, "attachment");
    expect(added).toBeGreaterThan(-1);
    expect(attached).toBeGreaterThan(added);
    expect(attached).toBeLessThan(indexOfResolved(events, STAGE_REVEALED.ref.id));
    // It enters play as any card does: announced once.
    expect(
      events.filter(
        (event) =>
          event.type === "triggerEvent" &&
          event.phase === "resolved" &&
          event.event.kind === "cardEntersPlay" &&
          event.event.instanceId === harness,
      ),
    ).toHaveLength(1);

    const replayed = replay(run.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(state);
  });

  it("while the Setup waits for the first player's choice, it is held faceup in the set-aside area, not in a pile", () => {
    const { state, events } = created({ chosen: true });
    expect(state.pendingChoice).not.toBeNull();
    expect(undefeatedVillains(state)).toEqual([]);
    const harness = instanceOf(state, HARNESS.id);
    const second = instanceOf(state, SECOND_HARNESS.id);
    const leash = instanceOf(state, LEASH.id);
    const waiting = [harness, second, leash].sort(
      (a, b) => indexOfMove(events, a, "encounterSetAside") - indexOfMove(events, b, "encounterSetAside"),
    );
    expect(state.setupCardsAwaitingHost).toEqual(waiting);
    for (const id of waiting) {
      expect(locateCard(state, id)).toEqual({ kind: "encounterSetAside" });
      expect(mustInstance(state, id).faceup).toBe(true);
    }
    // The villain choice is not offered the waiting cards.
    expect(state.pendingChoice!.options).toHaveLength(VILLAINS.length);

    const run = start({ chosen: true });
    const [villain] = undefeatedVillains(run.state);
    expect(mustInstance(run.state, instanceOf(run.state, HARNESS.id)).attachedTo).toBe(villain!.instanceId);
    expect(run.state.setupCardsAwaitingHost).toBeUndefined();
  });

  it("a setup-keyword card that needs no villain enters play at step 11, before 12a", () => {
    const { state, events } = created({ chosen: true });
    const beacon = instanceOf(state, BEACON.id);
    expect(locateCard(state, beacon)).toEqual({ kind: "villainArea" });
    expect(movesOf(events, beacon)).toEqual(["villainArea"]);
    expect(state.setupCardsAwaitingHost).not.toContain(beacon);
  });

  it("one with nothing to attach to when step 12c begins is discarded (RRG 'Attach To', p. 8)", () => {
    const { state, events } = start();
    const leash = instanceOf(state, LEASH.id);
    expect(locateCard(state, leash)?.kind).toBe("encounterDiscard");
    expect(movesOf(events, leash)).toEqual(["encounterSetAside", "encounterDiscard"]);
    // Settled as the window closes: after 1B's When Revealed, which is the last of steps 12a and 12b.
    expect(indexOfMove(events, leash, "encounterDiscard")).toBeGreaterThan(
      indexOfResolved(events, STAGE_REVEALED.ref.id),
    );
    expect(state.setupCardsAwaitingHost).toBeUndefined();
  });

  it("a campaign game, whose scenario setup is a flow step, ends in the same place", () => {
    const { state } = start({ campaign: true });
    const [villain] = undefeatedVillains(state);
    expect(mustInstance(state, instanceOf(state, HARNESS.id)).attachedTo).toBe(villain!.instanceId);
    expect(locateCard(state, instanceOf(state, BEACON.id))).toEqual({ kind: "villainArea" });
    expect(state.setupCardsAwaitingHost).toBeUndefined();
  });

  it("every seed begins with the attachment on whichever villain was chosen", () => {
    const hosts = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) {
      const { state } = start({ seed });
      const [villain] = undefeatedVillains(state);
      expect(mustInstance(state, instanceOf(state, HARNESS.id)).attachedTo).toBe(villain!.instanceId);
      hosts.add(villain!.cardId);
    }
    expect(hosts.size).toBe(VILLAINS.length);
  });
});

describe("step 11 with the villain in play from the start is unchanged", () => {
  it("the attachment goes straight from the deck onto the villain and nothing is held", () => {
    const { state, events } = created({ villainInPlay: true });
    const [villain] = undefeatedVillains(state);
    const harness = instanceOf(state, HARNESS.id);
    expect(mustInstance(state, harness).attachedTo).toBe(villain!.instanceId);
    expect(movesOf(events, harness)).toEqual(["attachment"]);
    // With no host and no villain still to come, "Attach To" discards at step 11 as before.
    expect(movesOf(events, instanceOf(state, LEASH.id))).toEqual(["encounterDiscard"]);
    expect(state.setupCardsAwaitingHost).toBeUndefined();
    expect(events.some((event) => event.type === "cardMoved" && event.to.kind === "encounterSetAside")).toBe(false);
  });
});
