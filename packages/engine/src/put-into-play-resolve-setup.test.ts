/**
 * docs/phase7-wave11-scenarios.md §S3.15: `putIntoPlay.resolveSetup` and `putIntoPlay.otherFace`, for a campaign
 * instruction shaped like MC60 p. 9 step 12 ("Place the environment for each Completed scenario into play Completed
 * side faceup and the environment for each Failed scenario into play Failed side faceup. Resolve the 'Setup' abilities
 * on each of these cards."), in the `afterMulligans` window (owner answer Q202 = A).
 *
 * Synthetic cards and the synthetic campaign only: two double-sided environments, each face with its own Setup.
 */

import { flat, type AnyCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import { DEFAULT_DEPS, type EngineDeps } from "./abilities.js";
import type { CampaignGameInput } from "./campaign.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { createGame } from "./setup.js";
import { cardsInPlay } from "./select.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { registryOf, stubAbility } from "./testing/abilities.js";
import { syntheticCampaignInput, syntheticInstruction } from "./testing/campaign.js";
import { runCommandsPicking } from "./testing/drive.js";
import { stubEnvironment, stubMainScheme } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, defaultPick, HERO, seatIdentities, VILLAIN } from "./testing/scenario.js";
import type { Ctx } from "./ctx.js";
import { settleEntryFaces, turnBeforeEntry } from "./resolve/put-into-play-setup.js";

const threat = (amount: number): EffectSpec => ({
  kind: "placeThreat",
  target: { kind: "mainScheme" },
  amount: { kind: "const", value: amount },
});

const WON_SETUP = stubAbility("syn-env.won.setup", { trigger: { kind: "setup" }, effects: [threat(1)] });
const LOST_SETUP = stubAbility("syn-env.lost.setup", { trigger: { kind: "setup" }, effects: [threat(10)] });
const OTHER_SETUP = stubAbility("syn-env2.setup", { trigger: { kind: "setup" }, effects: [threat(100)] });
/** "Forced Response: After this card enters play, …": the entry's own window, which resolves before the Setup. */
const ON_ENTRY = stubAbility("syn-env2.entry", {
  trigger: { kind: "response", forced: true, on: { on: "cardEntersPlay", selfIs: "target" } },
  effects: [threat(1000)],
});

const ENV = stubEnvironment({
  id: "syn-env",
  name: "Synthetic Venue",
  abilities: [WON_SETUP.ref],
  flipSide: { name: "Synthetic Venue", abilities: [LOST_SETUP.ref] },
});
const ENV2 = stubEnvironment({
  id: "syn-env2",
  name: "Second Venue",
  abilities: [OTHER_SETUP.ref, ON_ENTRY.ref],
});

const SCHEME = stubMainScheme({
  id: "syn-scheme",
  stages: [{ startingThreat: flat(0), targetThreat: flat(10_000), acceleration: flat(0) }],
});

const deps: EngineDeps = {
  ...DEFAULT_DEPS,
  abilities: { ...DEFAULT_DEPS.abilities, ...registryOf(WON_SETUP, LOST_SETUP, OTHER_SETUP, ON_ENTRY) },
};

const selectByName = (slot: string, name: string): EffectSpec => ({
  kind: "selectCards",
  slot,
  cards: { kind: "encounterSetAside", filter: { name } },
});

const putIntoPlay = (
  slot: string,
  opts: { otherFace?: true; resolveSetup?: true; into?: { scenarioPlayArea: string } } = {},
): EffectSpec => ({
  kind: "putIntoPlay",
  card: { kind: "slot", slot },
  controller: { kind: "firstPlayer" },
  ...opts,
});

/** Every Setup-ordering prompt asked, and the order picked: `setupOrder` (ability ids) when given, else the default. */
const asked: string[][] = [];
function pickerFor(setupOrder?: readonly string[]) {
  return (state: GameState): readonly string[] => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "orderTriggers" && choice.frameId !== null) {
      const ids = choice.options.map((option) => option.optionId);
      asked.push(ids);
      if (setupOrder)
        return setupOrder
          .map((ability) => ids.find((id) => id.endsWith(`:${ability}`)))
          .filter((id) => id !== undefined);
    }
    return defaultPick(state);
  };
}

function play(
  effects: readonly EffectSpec[],
  setupOrder?: readonly string[],
): { readonly state: GameState; readonly events: readonly GameEvent[] } {
  const identities = seatIdentities(HERO, 2);
  const input: CampaignGameInput = {
    ...syntheticCampaignInput({
      instructions: [syntheticInstruction("syn.environments", "afterMulligans", effects)],
      seats: identities.map((identity, index) => ({
        seatNumber: index + 1,
        identityCardId: identity.id,
        deck: [],
        aspects: [],
        grantedCardIds: [],
      })),
    }),
    setAsideCards: [ENV.id, ENV2.id],
  };
  const cards: AnyCard[] = [...DEFAULT_CARDS, SCHEME, ENV, ENV2, ...identities];
  const created = createGame(
    {
      seed: 1234,
      cards,
      villainCardId: VILLAIN.id,
      mainSchemeCardId: SCHEME.id,
      encounterDeck: [],
      players: identities.map((identity) => ({ identityCardId: identity.id, deck: DEFAULT_DECK })),
      campaign: input,
    },
    deps,
  );
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const driven = runCommandsPicking(created.state, deps, pickerFor(setupOrder));
  return { state: driven.state, events: [...created.events, ...driven.events] };
}

const schemeThreat = (state: GameState): number => state.instances[state.mainScheme.instanceId]?.threat ?? 0;
const instanceOf = (state: GameState, cardId: string): InstanceId => {
  const found = Object.values(state.instances).find((instance) => instance.cardId === cardId);
  if (!found) throw new Error(`no instance of ${cardId}`);
  return found.instanceId;
};
const resolvedAbilities = (events: readonly GameEvent[]): readonly string[] =>
  events.flatMap((event) => (event.type === "abilityResolved" ? [String(event.abilityId)] : []));

describe("putIntoPlay.resolveSetup (§S3.15)", () => {
  it("resolves the Setup ability of a card a campaign instruction put into play", () => {
    const { state } = play([selectByName("env", "Synthetic Venue"), putIntoPlay("env", { resolveSetup: true })]);
    expect(cardsInPlay(state)).toContain(instanceOf(state, ENV.id));
    expect(schemeThreat(state)).toBe(1);
  });

  it("resolves no Setup ability without the option (RRG 1.8 p. 40: Setup abilities belong to setup steps 12, 16)", () => {
    const { state, events } = play([selectByName("env", "Synthetic Venue"), putIntoPlay("env")]);
    expect(cardsInPlay(state)).toContain(instanceOf(state, ENV.id));
    expect(schemeThreat(state)).toBe(0);
    expect(resolvedAbilities(events)).not.toContain(WON_SETUP.ref.id);
  });

  it("resolves it in the afterMulligans window, before the first round (Q202 = A)", () => {
    const { events } = play([selectByName("env", "Synthetic Venue"), putIntoPlay("env", { resolveSetup: true })]);
    const setupAt = events.findIndex(
      (event) => event.type === "abilityResolved" && String(event.abilityId) === WON_SETUP.ref.id,
    );
    const windowAt = events.findIndex(
      (event) =>
        event.type === "stepChanged" && event.to.kind === "campaignWindow" && event.to.window === "afterMulligans",
    );
    // Step 16's frames are built once the window's frames have resolved; the first round begins after them.
    const roundAt = events.findIndex((event) => event.type === "roundStarted");
    expect(windowAt).toBeGreaterThan(-1);
    expect(setupAt).toBeGreaterThan(windowAt);
    expect(setupAt).toBeLessThan(roundAt);
  });

  // RRG 1.8 "Simultaneous Resolution" (p. 40): the Setups of two cards share a timing, so the first player orders them.
  const both: readonly EffectSpec[] = [
    {
      kind: "selectCards",
      slot: "both",
      cards: { kind: "encounterSetAside", filter: { categories: ["environment"] } },
    },
    putIntoPlay("both", { resolveSetup: true }),
  ];
  const watched: readonly string[] = [ON_ENTRY.ref.id, OTHER_SETUP.ref.id, WON_SETUP.ref.id];
  const watchedOrder = (events: readonly GameEvent[]) => resolvedAbilities(events).filter((id) => watched.includes(id));

  it("resolves the entries' own windows first, then the Setups in the order the first player picks", () => {
    asked.length = 0;
    const { state, events } = play(both, [WON_SETUP.ref.id, OTHER_SETUP.ref.id]);
    expect(schemeThreat(state)).toBe(1101);
    expect(asked).toHaveLength(1);
    expect(asked[0]).toHaveLength(2);
    expect(watchedOrder(events)).toEqual([ON_ENTRY.ref.id, WON_SETUP.ref.id, OTHER_SETUP.ref.id]);
  });

  it("resolves them the other way round when the first player picks that order", () => {
    const { events } = play(both, [OTHER_SETUP.ref.id, WON_SETUP.ref.id]);
    expect(watchedOrder(events)).toEqual([ON_ENTRY.ref.id, OTHER_SETUP.ref.id, WON_SETUP.ref.id]);
  });

  it("asks nothing for one card's Setup", () => {
    asked.length = 0;
    play([selectByName("env", "Synthetic Venue"), putIntoPlay("env", { resolveSetup: true })]);
    expect(asked).toEqual([]);
  });
});

describe("putIntoPlay.otherFace (§S3.15)", () => {
  it("enters on its other face, resolves that face's Setup, and is logged as no flip", () => {
    const { state, events } = play([
      selectByName("env", "Synthetic Venue"),
      putIntoPlay("env", { otherFace: true, resolveSetup: true }),
    ]);
    const id = instanceOf(state, ENV.id);
    expect(state.instances[id]?.flipped).toBe(true);
    expect(schemeThreat(state)).toBe(10);
    expect(events.some((event) => event.type === "cardFlipped")).toBe(false);
    expect(events).toContainEqual(expect.objectContaining({ type: "cardEnteredOnOtherFace", instanceId: id }));
  });

  it("turns a card back to its front when it does not enter play (no such scenario area)", () => {
    const { state, events } = play([
      selectByName("env", "Synthetic Venue"),
      putIntoPlay("env", { otherFace: true, resolveSetup: true, into: { scenarioPlayArea: "nowhere" } }),
    ]);
    const id = instanceOf(state, ENV.id);
    expect(cardsInPlay(state)).not.toContain(id);
    expect(state.instances[id]?.flipped).toBe(false);
    expect(events.some((event) => event.type === "cardEnteredOnOtherFace")).toBe(false);
    expect(schemeThreat(state)).toBe(0);
  });

  it("keeps a hidden reverse hidden on a card turned for an entry that did not happen", () => {
    const { state } = play([]);
    const id = instanceOf(state, ENV.id);
    const hidden: GameState = {
      ...state,
      instances: { ...state.instances, [id]: { ...state.instances[id]!, reverseHidden: true } },
    };
    const ctx: Ctx = { state: hidden, events: [], deps };
    const turned = turnBeforeEntry(ctx, id);
    expect(turned).toEqual({ id, reverseHidden: true });
    expect(ctx.state.instances[id]?.flipped).toBe(true);
    settleEntryFaces(ctx, turned ? [turned] : [], state.firstPlayerId);
    expect(ctx.state.instances[id]?.flipped).toBe(false);
    expect(ctx.state.instances[id]?.reverseHidden).toBe(true);
    expect(ctx.events).toEqual([]);
  });

  it("leaves a card with one face on its front and logs nothing for it", () => {
    const { state, events } = play([
      selectByName("env", "Second Venue"),
      putIntoPlay("env", { otherFace: true, resolveSetup: true }),
    ]);
    expect(state.instances[instanceOf(state, ENV2.id)]?.flipped).toBe(false);
    expect(events.some((event) => event.type === "cardEnteredOnOtherFace")).toBe(false);
  });
});
