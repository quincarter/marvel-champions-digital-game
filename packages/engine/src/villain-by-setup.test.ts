/**
 * docs/phase7-wave7.md §3.42 and §3.13 (schema §1.21, `Scenario.startingVillain: "bySetup"`): a single-villain game in
 * which every villain card starts set aside (`GameSetupConfig.villainsStartSetAside` without `villains`), and the main
 * scheme's stage 1A Setup puts one into play and removes the rest, and the minion that shares its title, from the game.
 *
 * Synthetic cards shaped like the scenario that needs it: seven one-stage villains with hit points per player, each
 * printed again as a second card for expert mode and once more as a minion of the same title, and a 1A Setup reading
 * "Put 1 random villain into play. Remove the minion with the same title as the villain, along with each other villain,
 * from the game." The Setup below is the composition a card script uses: `selectCards` over the set-aside area at
 * random, `addVillain`, and `moveCards` to the removed-from-game area with `sharesTitleWith` (§3.8).
 *
 * Sources: RRG 1.8 Appendix II (p. 51), steps 8 to 12: the villain deck enters at step 8 and its hit points are set at
 * step 9, the encounter deck is made at step 10, and step 12 resolves "a. … 'Setup' abilities on main scheme card 1A.
 * b. Flip the main scheme card to side 1B and resolve any 'When Revealed' abilities on that side. c. Resolve any
 * 'Setup' and 'When Revealed' abilities on the villain." "When Revealed Abilities" (p. 48): an encounter card that
 * enters play during setup resolves its When Revealed "during the 'Resolve Scenario Setup and When Revealed Abilities'
 * step". So a villain 12a puts into play enters undamaged, into a shuffled encounter deck, and its own abilities
 * resolve at 12c, after 1B's.
 */

import { flat, type AnyCard, type CardId, type MinionCard, type VillainCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { maxHitPoints, mustInstance, undefeatedVillains, villainOf } from "./query.js";
import { resolveRef } from "./select.js";
import { createGame, type GameSetupConfig } from "./setup.js";
import type { EffectSpec, TargetQuery } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { syntheticCampaignInput, syntheticInstruction } from "./testing/campaign.js";
import { driveSession } from "./testing/drive.js";
import { stubMainScheme, stubMinion, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, HERO, seatIdentities } from "./testing/scenario.js";
import { copiesOf } from "./testing/wave3.js";

type Mode = "standard" | "expert";
const TITLES = ["Ash", "Brine", "Cinder", "Dusk", "Ember", "Flint", "Gale"] as const;
const HP_PER_PLAYER: Record<Mode, number> = { standard: 6, expert: 9 };
const THE_VILLAIN = { kind: "villain" } as const;
const MAIN_SCHEME = { kind: "mainScheme" } as const;

/** The villain's own abilities, marking the main scheme so a test can read what resolved: 100 and 10 threat. */
const VILLAIN_SETUP = stubAbility("raider.setup", {
  trigger: { kind: "setup" },
  effects: [{ kind: "placeThreat", target: MAIN_SCHEME, amount: { kind: "const", value: 100 } }],
});
const VILLAIN_REVEALED = stubAbility("raider.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [{ kind: "placeThreat", target: MAIN_SCHEME, amount: { kind: "const", value: 10 } }],
});
/** Each villain is two cards, one per mode, as a double-sided villain card with a mode on each face is emitted. */
const villainCard = (title: string, mode: Mode): VillainCard =>
  stubVillain({
    id: `${title.toLowerCase()}-${mode}`,
    name: title,
    stages: [
      {
        hp: { base: 0, perPlayer: HP_PER_PLAYER[mode] },
        atk: 0,
        sch: 0,
        abilities: [VILLAIN_SETUP.ref, VILLAIN_REVEALED.ref],
      },
    ],
  });
const VILLAINS: Record<Mode, readonly VillainCard[]> = {
  standard: TITLES.map((title) => villainCard(title, "standard")),
  expert: TITLES.map((title) => villainCard(title, "expert")),
};
const MINIONS: readonly MinionCard[] = TITLES.map((title) => ({
  ...stubMinion({ id: `${title.toLowerCase()}-minion`, atk: 0, sch: 0, hp: 3 }),
  name: title,
}));
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });

const setAsideVillains = { kind: "encounterSetAside", filter: { categories: ["villain"] } } as const;
const startingVillain = { kind: "slot", slot: "starting" } as const;
/** "Remove the minion with the same title as the villain, along with each other villain, from the game." */
const REMOVE_THE_REST: EffectSpec = {
  kind: "moveCards",
  cards: {
    kind: "anyOf",
    of: [
      setAsideVillains,
      {
        kind: "encounter",
        zones: ["deck", "discard"],
        filter: { categories: ["minion"], sharesTitleWith: startingVillain },
      },
    ],
  },
  to: "removedFromGame",
};
/** "Setup: Put 1 random villain into play. Remove the minion with the same title …" */
const SETUP = stubAbility("getaway.setup", {
  trigger: { kind: "setup" },
  effects: [
    { kind: "selectCards", slot: "starting", cards: { ...setAsideVillains, random: { kind: "const", value: 1 } } },
    { kind: "addVillain", villain: startingVillain },
    REMOVE_THE_REST,
  ],
});
/** The same Setup with the villain chosen by the first player: it stops for a choice before any villain is in play. */
const SETUP_CHOSEN = stubAbility("getaway.setup-chosen", {
  trigger: { kind: "setup" },
  effects: [
    { kind: "chooseCards", slot: "starting", from: setAsideVillains, chooser: { kind: "controller" }, min: 1, max: 1 },
    { kind: "addVillain", villain: startingVillain },
    REMOVE_THE_REST,
  ],
});
/** Stage 1B's When Revealed: 1 threat, and it cancels out nothing, so the order of the three marks is readable. */
const STAGE_REVEALED = stubAbility("getaway.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [{ kind: "placeThreat", target: MAIN_SCHEME, amount: { kind: "const", value: 1 } }],
});
const mainScheme = (id: string, setup: typeof SETUP) =>
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
const GETAWAY = mainScheme("getaway", SETUP);
const GETAWAY_CHOSEN = mainScheme("getaway-chosen", SETUP_CHOSEN);

const deps: EngineDeps = depsOf(VILLAIN_SETUP, VILLAIN_REVEALED, SETUP, SETUP_CHOSEN, STAGE_REVEALED);

interface Options {
  readonly mode?: Mode;
  readonly players?: 1 | 2 | 3 | 4;
  readonly seed?: number;
  readonly mainScheme?: CardId;
  /** Villain titles the campaign removes from the game before 1A's Setup resolves (MC40 p. 11). */
  readonly removedBeforeSetup?: readonly string[];
}

function configOf(options: Options = {}): GameSetupConfig {
  const mode = options.mode ?? "standard";
  const players = options.players ?? 1;
  const identities = seatIdentities(HERO, players);
  const [first, ...others] = VILLAINS[mode] as readonly [VillainCard, ...VillainCard[]];
  const removed = options.removedBeforeSetup ?? [];
  const removal: TargetQuery = { categories: ["villain"], anyOf: removed.map((name) => ({ name })) };
  return {
    seed: options.seed ?? 7,
    cards: [
      ...DEFAULT_CARDS,
      ...identities,
      ...VILLAINS.standard,
      ...VILLAINS.expert,
      ...MINIONS,
      FILLER,
      GETAWAY,
      GETAWAY_CHOSEN,
    ] satisfies readonly AnyCard[],
    villainCardId: first.id,
    setAsideVillainCardIds: others.map((card) => card.id),
    villainsStartSetAside: true,
    victory: "cardAbility",
    mainSchemeCardId: options.mainScheme ?? GETAWAY.id,
    encounterDeck: [...MINIONS.map((card) => card.id), ...copiesOf(FILLER.id, 12)],
    includeIdentitySets: false,
    ...(mode === "expert" ? { difficulty: "expert" as const } : {}),
    players: identities.map((identity) => ({ identityCardId: identity.id, deck: DEFAULT_DECK })),
    ...(options.removedBeforeSetup
      ? {
          campaign: syntheticCampaignInput({
            seats: identities.map((identity, index) => ({
              seatNumber: index + 1,
              identityCardId: identity.id,
              deck: [],
              aspects: [],
              grantedCardIds: [],
            })),
            instructions: [
              syntheticInstruction("remove-defeated", "beforeScenarioSetup", [
                { kind: "moveCards", cards: { kind: "encounterSetAside", filter: removal }, to: "removedFromGame" },
              ]),
            ],
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

/** A game played through setup to the first player's turn, every choice answered with its first options. */
function start(options: Options = {}) {
  const { state: baseline, events: setupEvents } = created(options);
  const { session, events } = driveSession(startSession(baseline), deps);
  return { baseline, session, state: session.state, events: [...setupEvents, ...events] };
}

const titleOf = (state: GameState, id: InstanceId): string => state.cardPool[mustInstance(state, id).cardId]!.name;
const typeOf = (state: GameState, id: InstanceId): string => state.cardPool[mustInstance(state, id).cardId]!.type;
const allIds = (state: GameState): readonly InstanceId[] => Object.keys(state.instances) as InstanceId[];
const villainCards = (state: GameState) => allIds(state).filter((id) => typeOf(state, id) === "villain");
const minionCards = (state: GameState) => allIds(state).filter((id) => typeOf(state, id) === "minion");
const encounterPiles = (state: GameState): readonly InstanceId[] =>
  state.encounterDeckOrder.flatMap((deckId) => {
    const piles = state.encounterDecks[deckId]!;
    return [...piles.deck, ...piles.discard];
  });
const theVillain = (state: GameState): readonly InstanceId[] =>
  resolveRef(state, THE_VILLAIN, {
    controllerId: state.firstPlayerId,
    selfInstanceId: null,
    scopedPlayerId: null,
    event: null,
    bindings: {},
  });
/** The setup steps the game moved to, in order. */
const stepsOf = (events: readonly GameEvent[]): readonly string[] =>
  events.flatMap((event) => (event.type === "stepChanged" ? [event.to.kind] : []));
/** The ability ids that resolved, in order. */
const resolved = (events: readonly GameEvent[]): readonly string[] =>
  events.flatMap((event) => (event.type === "abilityResolved" ? [event.abilityId as string] : []));

/**
 * What must hold once setup has finished, whoever was chosen: one villain in play as the active villain, undamaged at
 * its hit points for the player count, its own abilities resolved once each after stage 1B's; every other villain and
 * the minion of its title removed from the game; every other minion still in the encounter deck.
 */
function expectSetUp(run: ReturnType<typeof start>, options: Options = {}): string {
  const { state, events } = run;
  const mode = options.mode ?? "standard";
  const players = options.players ?? 1;
  expect(state.outcome).toBeNull();
  expect(state.step.kind).toBe("turn");
  expect(state.villainsEnteringAtSetup).toBeUndefined();

  const inPlay = undefeatedVillains(state);
  expect(inPlay).toHaveLength(1);
  const villain = inPlay[0]!;
  const title = titleOf(state, villain.instanceId);
  expect(VILLAINS[mode].map((card) => card.id)).toContain(villain.cardId);
  expect(state.activeVillainId).toBe(villain.instanceId);
  expect(theVillain(state)).toEqual([villain.instanceId]);
  expect(villain.stageIndex).toBe(0);
  const instance = mustInstance(state, villain.instanceId);
  expect(instance.faceup).toBe(true);
  expect(instance.damage).toBe(0);
  expect(maxHitPoints(state, villain.instanceId, deps)).toBe(HP_PER_PLAYER[mode] * players);

  // Every other villain card of the mode is removed from the game, and none is left set aside.
  const others = villainCards(state).filter((id) => id !== villain.instanceId);
  expect(others).toHaveLength(TITLES.length - 1);
  for (const id of others) {
    expect(state.removedFromGame).toContain(id);
    expect(villainOf(state, id)?.defeated ?? true).toBe(true);
  }
  expect(state.encounterSetAside.filter((id) => typeOf(state, id) === "villain")).toEqual([]);

  // The minion of the villain's title is removed; the other six are where the encounter deck was built with them.
  const removedMinions = minionCards(state).filter((id) => state.removedFromGame.includes(id));
  expect(removedMinions.map((id) => titleOf(state, id))).toEqual([title]);
  const inDeck = encounterPiles(state).filter((id) => typeOf(state, id) === "minion");
  expect(inDeck.map((id) => titleOf(state, id)).sort()).toEqual(TITLES.filter((other) => other !== title));
  expect(new Set([...encounterPiles(state), ...state.removedFromGame]).size).toBe(
    encounterPiles(state).length + state.removedFromGame.length,
  );

  // Step 12a, then 12b, then 12c for the villain 12a put into play: its Setup, then its When Revealed, once each.
  const setupId = (options.mainScheme ?? GETAWAY.id) === GETAWAY.id ? SETUP.ref.id : SETUP_CHOSEN.ref.id;
  expect(resolved(events).filter((id) => id.startsWith("raider.") || id.startsWith("getaway."))).toEqual([
    setupId,
    STAGE_REVEALED.ref.id,
    VILLAIN_SETUP.ref.id,
    VILLAIN_REVEALED.ref.id,
  ]);
  expect(mustInstance(state, state.mainScheme.instanceId).threat).toBe(111);
  return title;
}

describe("§3.42 createGame: a single-villain game with every villain set aside", () => {
  it("is accepted; until 1A's Setup chooses, no villain is in play and 'the villain' is nobody", () => {
    const { state, events } = created({ mainScheme: GETAWAY_CHOSEN.id });
    // The Setup has stopped for its choice: step 12a is resolving and nothing has entered play.
    expect(state.pendingChoice?.options.map((option) => option.label).sort()).toEqual([...TITLES]);
    expect(undefeatedVillains(state)).toEqual([]);
    expect(theVillain(state)).toEqual([]);
    expect(state.villainsEnteringAtSetup).toEqual([]);
    expect(state.step).toEqual({ phase: "setup", kind: "villainSetupAbilities" });
    const setAside = state.encounterSetAside.filter((id) => typeOf(state, id) === "villain");
    expect(setAside.map((id) => titleOf(state, id)).sort()).toEqual([...TITLES]);
    for (const id of setAside) expect(mustInstance(state, id).faceup).toBe(false);
    expect(state.removedFromGame).toEqual([]);
    // The encounter deck is already made and shuffled (step 10) with all seven minions in it.
    expect(events.some((e) => e.type === "villainAdded")).toBe(false);
    expect(encounterPiles(state).filter((id) => typeOf(state, id) === "minion")).toHaveLength(TITLES.length);
    // Only the listed villain card holds the active counter's place and the encounter deck; it is out of play.
    expect(state.villains).toHaveLength(1);
    expect(state.villains[0]).toMatchObject({ instanceId: state.activeVillainId, defeated: true });
  });

  it("the first player's choice enters play, and the window closes after step 12c", () => {
    const run = start({ mainScheme: GETAWAY_CHOSEN.id });
    expectSetUp(run, { mainScheme: GETAWAY_CHOSEN.id });
    expect(stepsOf(run.events).slice(0, 2)).toEqual(["villainSetupAbilities", "drawStartingHands"]);
  });

  it("refuses a random starting villain drawn by the game setup as well", () => {
    const result = createGame({ ...configOf(), randomStartingVillain: true }, deps);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error.message).toMatch(/not with randomStartingVillain/);
  });

  it("refuses a side or stage the villain would not enter on", () => {
    const twoStage = stubVillain({
      id: "two-stage",
      stages: [
        { hp: flat(5), atk: 0, sch: 0 },
        { hp: flat(9), atk: 0, sch: 0 },
      ],
    });
    const config = configOf();
    const withTwoStage = { ...config, cards: [...config.cards, twoStage], villainCardId: twoStage.id };
    expect(createGame(withTwoStage, deps).ok).toBe(true);
    for (const over of [{ villainStartStageIndex: 1 }, { villainLastStageIndex: 0 }, { villainSide: "B" as const }]) {
      const result = createGame({ ...withTwoStage, ...over }, deps);
      expect(result.ok, JSON.stringify(over)).toBe(false);
    }
  });
});

describe("§3.13 the Setup: one random villain, the rest and the minion of its title removed from the game", () => {
  for (const mode of ["standard", "expert"] as const) {
    for (const players of [1, 2, 4] as const) {
      it(`${mode}, ${players} player${players === 1 ? "" : "s"}: one villain of the mode at its hit points`, () => {
        expectSetUp(start({ mode, players }), { mode, players });
      });
    }
  }

  it("the setup is logged in order and replays to the same state", () => {
    const run = start({ seed: 11 });
    const title = expectSetUp(run);
    const added = run.events.filter((e) => e.type === "villainAdded");
    expect(added).toHaveLength(1);
    // Appendix II step 10 before step 12a: the encounter deck was shuffled before the villain entered, and removing
    // one card from it does not shuffle it again.
    const shuffles = run.events.flatMap((e, index) =>
      e.type === "deckShuffled" && e.zone.kind === "encounterDeck" ? [index] : [],
    );
    expect(shuffles).toHaveLength(1);
    expect(shuffles[0]!).toBeLessThan(run.events.indexOf(added[0]!));
    // The same seed chooses the same villain.
    expect(expectSetUp(start({ seed: 11 }))).toBe(title);
    const replayed = replay(run.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(run.session.state);
  });

  it("across 200 seeds every villain is chosen at least once, none from outside the pool, and setup always holds", () => {
    for (const mode of ["standard", "expert"] as const) {
      const chosen = new Map<string, number>();
      for (let seed = 1; seed <= 200; seed++) {
        const title = expectSetUp(start({ mode, seed, players: 2 }), { mode, players: 2 });
        chosen.set(title, (chosen.get(title) ?? 0) + 1);
      }
      expect([...chosen.keys()].sort(), mode).toEqual([...TITLES]);
      // Uniform over seven: about 29 each. A villain chosen fewer than 10 times in 200 would not be a fair draw.
      for (const count of chosen.values()) expect(count).toBeGreaterThanOrEqual(10);
    }
  }, 120_000);
});

describe("§3.42 an instruction that resolves before 1A's Setup narrows the choice (MC40 p. 11)", () => {
  // "Ash" is the villain card the game lists while none is in play (`villainCardId`): removing it is the hard case.
  const REMOVED = ["Ash", "Dusk", "Gale"] as const;

  it("the removed villains are gone before any is chosen, and their minions stay in the encounter deck", () => {
    const run = start({ removedBeforeSetup: REMOVED, seed: 5 });
    const { state, events } = run;
    const title = titleOf(state, state.activeVillainId);
    expect(REMOVED).not.toContain(title);
    expect(undefeatedVillains(state).map((v) => v.instanceId)).toEqual([state.activeVillainId]);
    // The campaign's removal, then scenario setup, then step 12c.
    expect(stepsOf(events).slice(0, 3)).toEqual(["scenarioSetup", "villainSetupAbilities", "campaignWindow"]);
    expect(villainCards(state).filter((id) => state.removedFromGame.includes(id))).toHaveLength(TITLES.length - 1);
    const inDeck = encounterPiles(state).filter((id) => typeOf(state, id) === "minion");
    expect(inDeck.map((id) => titleOf(state, id)).sort()).toEqual(TITLES.filter((other) => other !== title));
    expect(state.villainsEnteringAtSetup).toBeUndefined();
  });

  it("across 200 seeds a removed villain never starts, and each remaining one does", () => {
    const chosen = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      const { state } = start({ removedBeforeSetup: REMOVED, seed });
      const title = titleOf(state, state.activeVillainId);
      expect(undefeatedVillains(state)).toHaveLength(1);
      chosen.add(title);
      const minionsInDeck = encounterPiles(state)
        .filter((id) => typeOf(state, id) === "minion")
        .map((id) => titleOf(state, id));
      for (const removed of REMOVED) expect(minionsInDeck).toContain(removed);
    }
    expect([...chosen].sort()).toEqual(TITLES.filter((title) => !(REMOVED as readonly string[]).includes(title)));
  }, 120_000);
});
